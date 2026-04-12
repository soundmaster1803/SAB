import * as net from 'net';
import { EventEmitter } from 'events';
import {
  buildInitCommandRequest,
  buildInitEventRequest,
  buildOperationRequest,
  buildOperationRequestWithData,
  DATA_PHASE_NONE,
  DATA_PHASE_READ,
} from './packet-builder';
import { SDI_CONTROL_TYPE, KELVIN_SCALE, OPCODES } from './constants';

export interface CameraState {
  id: string;
  ip: string;
  name: string;
  model?: string;
  connected: boolean;
  iso: number;
  fnumber: number;
  shutter: number;    // raw Sony UINT32: (num<<16)|den, e.g. 0x00010064 = 1/100
  expComp: number;    // INT16 raw, /1000 = EV
  colorTemp: number;  // Kelvin
  battery: number;    // 0–100 %
  charging: boolean;      // AC power / charging (battery > 100 heuristic or future prop)
  recState: number;       // 0=idle, 1=recording
  recRemainSec: number;   // remaining card capacity in seconds (0 = unknown)
  tally: number;      // 0=none, 1=program, 2=preview
  fps?: number;       // current frame rate (from camera or config)
  lastUpdate: number;
}

const TYPE_SIZE: Record<number, number> = {
  0x0001: 1, 0x0002: 1,
  0x0003: 2, 0x0004: 2,
  0x0005: 4, 0x0006: 4,
  0x0008: 8,
};

const PACKET_TIMEOUT_MS = 5000;

function ts(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

export class SonyPTPClient extends EventEmitter {
  public cmdSocket: net.Socket | null = null;
  public evtSocket: net.Socket | null = null;

  private rxBuf = Buffer.alloc(0);
  private waiters: Array<{ resolve: (b: Buffer) => void; reject: (e: Error) => void }> = [];

  public state: CameraState;
  private transactionId = 0;
  private guid: Buffer;
  private supportedLists = new Map<number, number[]>();  // propCode → enumeration list

  // Diagnostic fields — populated during connect() and polling.
  // Exposed for the debug endpoint; not used in the control path.
  public lastPollBlob: Buffer | null = null;
  public deviceManufacturer = '';
  public deviceFirmware = '';
  public deviceSerial = '';

  // Serial command queue — guarantees strict transactionId sequencing.
  // Each enqueued fn is chained onto the tail; a failed task doesn't poison the chain.
  private commandQueue: Promise<any> = Promise.resolve();

  private pollActive = false;
  private pollIntervalMs = 200;
  private pollErrorCount = 0;

  constructor(ip: string, guid: Buffer) {
    super();
    this.guid = guid;
    this.state = {
      id: '', ip, name: '',
      connected: false,
      iso: 0, fnumber: 0, shutter: 0,
      expComp: 0, colorTemp: 5500,
      battery: 0, charging: false, recState: 0, recRemainSec: 0,
      tally: 0, lastUpdate: 0,
    };
  }

  getState(): CameraState { return this.state; }

  public getSupportedList(propCode: number): number[] { return this.supportedLists.get(propCode) || []; }
  public getFps(): number { return this.state.fps || 25; }

  private log(msg: string)  { console.log(`[${ts()}] [SONY] [${this.state.ip}] ${msg}`); }
  private warn(msg: string) { console.warn(`[${ts()}] [SONY] [${this.state.ip}] WARN: ${msg}`); }
  private err(msg: string)  { console.error(`[${ts()}] [SONY] [${this.state.ip}] ERROR: ${msg}`); }
  private vlog(msg: string) { console.log(`[${ts()}] [SONY] [${this.state.ip}] [V] ${msg}`); }

  // ─── Connection ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    const ip = this.state.ip;

    // Tear down any stale sockets from a previous (possibly partially-successful)
    // attempt.  Without this, the evtSocket from an old session stays connected to
    // the camera, which makes the camera think a session is still alive and causes
    // it to RST every new InitCommandRequest.
    if (this.cmdSocket) {
      this.cmdSocket.removeAllListeners();
      this.cmdSocket.destroy();
      this.cmdSocket = null;
    }
    if (this.evtSocket) {
      this.evtSocket.removeAllListeners();
      this.evtSocket.destroy();
      this.evtSocket = null;
    }
    this.rxBuf = Buffer.alloc(0);
    this.waiters = [];
    this.transactionId = 0;

    this.log(`Connecting to ${ip}:15740…`);
    this.vlog(`GUID: ${this.guid.toString('hex')}`);

    // 1. Control socket
    const t0 = Date.now();
    this.cmdSocket = await this.connectTcp(ip, 15740);
    this.vlog(`[1] CMD socket open (${Date.now() - t0}ms)`);
    this.cmdSocket.on('data', (d: Buffer) => {
      this.rxBuf = Buffer.concat([this.rxBuf, d]);
      this.drainWaiters();
    });
    this.cmdSocket.on('error', (e) => {
      this.err(`Socket error: ${e.message}`);
      this._flushWaiters(new Error(`Socket error: ${e.message}`));
    });
    this.cmdSocket.on('close', () => {
      this._flushWaiters(new Error('Socket closed'));
      if (this.state.connected) {
        this.warn('Connection lost — disconnected');
        this.state.connected = false;
        this.stopPolling();
        // Close evtSocket too — camera must see both sockets gone to free the session
        if (this.evtSocket) {
          this.evtSocket.removeAllListeners();
          this.evtSocket.destroy();
          this.evtSocket = null;
        }
        this.emit('stateUpdate', this.state);
      }
    });

    // 2. InitCommandRequest — send immediately, no delay.
    //    Some cameras (ZVE10 II) RST the connection if InitCommandRequest
    //    doesn't arrive within ~200ms of TCP connect.
    const initReq = buildInitCommandRequest(this.guid, 'CineLink');
    this.vlog(`[2] → InitCommandRequest ${initReq.length} bytes`);
    this.cmdSocket.write(initReq);
    const initAck = await this.readPacket();
    const ackType = initAck.readUInt32LE(4);
    this.vlog(`[2] ← InitAck type=0x${ackType.toString(16).padStart(4,'0')} len=${initAck.length} hex=${initAck.slice(0,16).toString('hex')}`);
    if (ackType === 0x0005) {
      throw new Error('InitFail — confirm connection on camera screen, then retry');
    }
    if (ackType !== 0x0002) {
      throw new Error(`Expected InitCommandAck (type 0x0002), got 0x${ackType.toString(16)}`);
    }
    const sessionId = initAck.readUInt32LE(8);
    this.vlog(`[2] sessionId=0x${sessionId.toString(16).padStart(8,'0')}`);

    // 3. Event socket
    const t3 = Date.now();
    this.evtSocket = await this.connectTcp(ip, 15740);
    this.vlog(`[3] EVT socket open (${Date.now() - t3}ms) → InitEventRequest sessionId=0x${sessionId.toString(16)}`);
    this.evtSocket.write(buildInitEventRequest(sessionId));
    this.evtSocket.on('data', (d) => this.vlog(`EVT ← ${d.length} bytes: ${d.slice(0,8).toString('hex')}`));
    this.evtSocket.on('error', (e) => this.warn(`Event socket error: ${e.message}`));

    // 4. OpenSession (TID=0 already reset above, param1=1 per spec)
    this.vlog(`[4] → OpenSession op=0x1002 tid=0 param=1`);
    await this.sendCmd(0x1002, [1], DATA_PHASE_NONE);
    this.transactionId = 1;
    this.vlog(`[4] ← OpenSession OK`);

    // 5. GetDeviceInfo — extracts model, manufacturer, firmware version, serial number
    this.vlog(`[5] → GetDeviceInfo op=0x1001`);
    const infoData = await this.sendCmdReadData(0x1001, []);
    const devInfo = this.parseDeviceInfoBlob(infoData);
    this.state.model       = devInfo.model;
    this.deviceManufacturer = devInfo.manufacturer;
    this.deviceFirmware    = devInfo.firmware;
    this.deviceSerial      = devInfo.serial;
    this.vlog(`[5] ← GetDeviceInfo ${infoData.length} bytes, model="${devInfo.model}" fw="${devInfo.firmware}" sn="${devInfo.serial}"`);
    this.vlog(`[5] DeviceInfo hex (first 64): ${infoData.slice(0, 64).toString('hex')}`);

    // 6–9. PTP 3.00 four-step SDIO handshake (matches v60.py exactly)
    //   Phase 1 → Phase 2 → GetExtDeviceInfo(v=0x012C, 1 param) → Phase 3

    // 6. SDIO_Connect Phase 1
    this.vlog(`[6] → SDIO_Connect Phase 1 [1,0,0]`);
    await this.sendCmd(OPCODES.SDIO_CONNECT, [1, 0, 0], DATA_PHASE_NONE);
    this.vlog(`[6] ← Phase 1 done`);

    // 7. SDIO_Connect Phase 2
    this.vlog(`[7] → SDIO_Connect Phase 2 [2,0,0]`);
    await this.sendCmd(OPCODES.SDIO_CONNECT, [2, 0, 0], DATA_PHASE_NONE);
    this.vlog(`[7] ← Phase 2 done (0xA101 = already connected, expected on ZV-E10 II)`);

    // 8. GetExtDeviceInfo — strictly ONE parameter (0x012C = PTP v3.00), per v60.py
    this.vlog(`[8] → GetExtDeviceInfo op=0x9202 version=0x012C`);
    await this.sendCmd(OPCODES.SDIO_GET_EXT_DEVICE_INFO, [0x012C], DATA_PHASE_NONE);
    this.vlog(`[8] ← GetExtDeviceInfo done`);

    // 9. SDIO_Connect Phase 3 — finalises session
    this.vlog(`[9] → SDIO_Connect Phase 3 [3,0,0]`);
    await this.sendCmd(OPCODES.SDIO_CONNECT, [3, 0, 0], DATA_PHASE_NONE);
    this.vlog(`[9] ← Phase 3 done — PTP 3.00 handshake complete`);

    this.state.connected = true;
    this.log(`✓ Connected — ${devInfo.model} fw=${devInfo.firmware || '?'} sn=${devInfo.serial || '?'} (handshake ${Date.now() - t0}ms total)`);
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  startPolling(intervalMs = 200): void {
    this.pollIntervalMs = intervalMs;
    this.pollActive = true;
    this.pollErrorCount = 0;
    this.pollLoop();
  }

  stopPolling(): void {
    this.pollActive = false;
  }

  private pollCount = 0;

  private async pollLoop(): Promise<void> {
    while (this.pollActive) {
      try {
        const blob = await this.sendCmdReadData(0x9209, [0, 1]);
        this.pollCount++;
        if (blob.length > 20) {
          if (this.pollCount <= 5 || this.pollCount % 50 === 0) {
            this.vlog(`Poll #${this.pollCount} blob=${blob.length} bytes`);
          }
          this.parseSonyProps(blob);
          if (this.pollErrorCount > 0) {
            this.log(`Poll recovered after ${this.pollErrorCount} errors`);
            this.pollErrorCount = 0;
          }
        } else {
          this.warn(`Poll #${this.pollCount} blob too small: ${blob.length} bytes (need >20) — hex: ${blob.toString('hex')}`);
        }
      } catch (e: any) {
        this.pollErrorCount++;
        if (this.pollErrorCount === 1 || this.pollErrorCount % 10 === 0) {
          this.err(`Poll error #${this.pollErrorCount}: ${e.message}`);
        }
      }
      await this.delay(this.pollIntervalMs);
    }
  }

  // ─── Hunter parser (from v60.py) ───────────────────────────────────────────

  // Returns [currentValue, enumerationList] for a prop code in the polling blob.
  private hunterExtractWithList(blob: Buffer, propCode: number): [number | null, number[]] {
    const search = Buffer.alloc(2);
    search.writeUInt16LE(propCode, 0);
    let start = 0;
    while (start < blob.length - 6) {
      const idx = blob.indexOf(search, start);
      if (idx === -1) break;
      try {
        const dtype = blob.readUInt16LE(idx + 2);
        const size = TYPE_SIZE[dtype];
        if (!size) { start = idx + 1; continue; }

        // Layout: [propCode:2][dtype:2][defaultVal:size][currentVal:size][formFlag:1][...]
        const valOffset = idx + 6 + size;
        if (valOffset + size > blob.length) { start = idx + 1; continue; }

        const readVal = (off: number): number => {
          if (dtype === 0x0003) return blob.readInt16LE(off);
          if (dtype === 0x0001) return blob.readInt8(off);
          if (dtype === 0x0005) return blob.readUInt32LE(off);
          if (size === 4) return blob.readUInt32LE(off);
          if (size === 2) return blob.readUInt16LE(off);
          return blob.readUInt8(off);
        };

        const currentVal = readVal(valOffset);
        const list: number[] = [];

        const formFlagOffset = valOffset + size;
        if (formFlagOffset < blob.length && blob.readUInt8(formFlagOffset) === 0x02) {
          // Enumeration
          const enumStart = formFlagOffset + 1;
          if (enumStart + 2 <= blob.length) {
            const count = blob.readUInt16LE(enumStart);
            const valsStart = enumStart + 2;
            if (valsStart + count * size <= blob.length) {
              for (let i = 0; i < count; i++) {
                list.push(readVal(valsStart + i * size));
              }
            }
          }
        }

        if (propCode === 0xD21E) {
          // Sony extended UINT32: high bytes are flags (e.g. 0x10000280 → ISO 640).
          // Mask currentVal for state storage/display, but keep list unmasked so
          // the original value is sent back to the camera via SetExtDevicePropValue.
          const maskedCurrent = currentVal === 0x00FFFFFF ? currentVal : currentVal & 0xFFFF;
          return [maskedCurrent, list];
        }
        return [currentVal, list];
      } catch (_e) { /* try next match */ }
      start = idx + 1;
    }
    return [null, []];
  }

  /**
   * Scan a single property code from the last poll blob.
   * Returns [currentValue | null, enumerationList].
   * Used by the debug endpoint to read any prop without modifying the main poll path.
   */
  public scanProp(propCode: number): [number | null, number[]] {
    if (!this.lastPollBlob) return [null, []];
    return this.hunterExtractWithList(this.lastPollBlob, propCode);
  }

  private parsedOnce = false;

  private parseSonyProps(blob: Buffer): void {
    this.lastPollBlob = blob;
    const [iso,       isoList]     = this.hunterExtractWithList(blob, 0xD21E);
    const [fnumber,   fnList]      = this.hunterExtractWithList(blob, 0x5007);
    const [shutter,   shutList]    = this.hunterExtractWithList(blob, 0xD20D);
    const [expComp,   expList]     = this.hunterExtractWithList(blob, 0x5010);
    const [colorT,    colorList]   = this.hunterExtractWithList(blob, 0xD20F);
    const [battery]                = this.hunterExtractWithList(blob, 0xD218);
    const [recState]               = this.hunterExtractWithList(blob, 0xD21D);
    // Remaining recordable time in seconds — PTP3 cameras (ZV-E10 II, FX30, etc.)
    // 0xD3C4 = Slot3RemainingTime, 0xD3C2 = Slot1RemainingTime (inferred from SDK pattern)
    const [remSec3]                = this.hunterExtractWithList(blob, 0xD3C4);
    const [remSec1]                = this.hunterExtractWithList(blob, 0xD3C2);
    // Prefer slot1, fallback to slot3; value must be plausible (1s–24h)
    const remSecRaw = remSec1 ?? remSec3;
    const remSec = (remSecRaw !== null && remSecRaw > 0 && remSecRaw < 86400) ? remSecRaw : 0;

    // Log parsed values on first successful poll, then every 50 polls
    if (!this.parsedOnce || this.pollCount % 50 === 0) {
      this.vlog(
        `Props: iso=${iso ?? '?'} fn=${fnumber ?? '?'} shut=0x${(shutter ?? 0).toString(16)} ` +
        `ev=${expComp ?? '?'} ct=${colorT ?? '?'} bat=${battery ?? '?'} rec=${recState ?? '?'} ` +
        `| lists: iso=${isoList.length} fn=${fnList.length} shut=${shutList.length} ev=${expList.length} ct=${colorList.length}`
      );
      this.parsedOnce = true;
    }

    // Update supported lists (skip empty — camera may not send them every poll)
    if (isoList.length)   this.supportedLists.set(0xD21E, isoList);
    if (fnList.length)    this.supportedLists.set(0x5007, fnList);
    if (shutList.length)  this.supportedLists.set(0xD20D, shutList);
    if (expList.length)   this.supportedLists.set(0x5010, expList);
    if (colorList.length) this.supportedLists.set(0xD20F, colorList);

    // Battery > 100 → some Sony models report AC power / charging this way
    const batRaw     = battery;
    const batPct     = battery !== null ? Math.min(100, battery > 100 ? 100 : battery) : null;
    const isCharging = battery !== null && battery > 100;

    let changed = false;
    if (iso      !== null && iso      !== this.state.iso)       { this.state.iso       = iso;      changed = true; }
    if (fnumber  !== null && fnumber  !== this.state.fnumber)   { this.state.fnumber   = fnumber;  changed = true; }
    if (shutter  !== null && shutter  !== this.state.shutter)   { this.state.shutter   = shutter;  changed = true; }
    if (expComp  !== null && expComp  !== this.state.expComp)   { this.state.expComp   = expComp;  changed = true; }
    if (colorT   !== null && colorT   !== this.state.colorTemp) { this.state.colorTemp = colorT;   changed = true; }
    if (batPct   !== null && batPct   !== this.state.battery)   { this.state.battery   = batPct;   changed = true; }
    if (batRaw   !== null && isCharging !== this.state.charging)      { this.state.charging     = isCharging; changed = true; }
    if (recState !== null && recState !== this.state.recState)        { this.state.recState      = recState;   changed = true; }
    if (remSec   !== this.state.recRemainSec)                         { this.state.recRemainSec  = remSec;     changed = true; }

    if (changed) {
      this.state.lastUpdate = Date.now();
      this.emit('stateUpdate', this.state);
    }
  }

  // ─── Device control ────────────────────────────────────────────────────────

  async controlDevice(propCode: number, ctrlType: number, value: number, isInt16 = false): Promise<void> {
    // PTP 3.00 SDIO_ControlDevice format (verified against v60.py / v61.py):
    //   params[0] = propCode
    //   params[1] = FLAG_EXT_OPT (0x00000001) — REQUIRED in PTP 3.00; omitting it causes 0x2019
    //   data      = value as 4-byte little-endian (no ctrlType prefix byte in PTP 3.00)
    const FLAG_EXT_OPT = 0x00000001;
    const params = [propCode, FLAG_EXT_OPT];
    let data: Buffer;

    if (ctrlType === SDI_CONTROL_TYPE.BUTTON) {
      // BUTTON: value = BUTTON.DOWN (2) or BUTTON.UP (1) as UINT32
      data = Buffer.alloc(4);
      data.writeUInt32LE(value, 0);
    } else if (isInt16) {
      // NearFar NOTCH: signed step (-7..+7) as INT32
      data = Buffer.alloc(4);
      data.writeInt32LE(value, 0);
    } else {
      // Generic NOTCH: signed step as INT32
      data = Buffer.alloc(4);
      data.writeInt32LE(value, 0);
    }

    this.log(`ControlDevice propCode=0x${propCode.toString(16)} ctrlType=0x${ctrlType.toString(16)} value=0x${value.toString(16)} data=${data.toString('hex')}`);
    await this.sendCmdWithData(0x9207, params, data);
  }

  // Step a property up/down using the camera's own enumeration list.
  // Uses SDIO_SetExtDevicePropValue (0x9205) with an absolute value — same as v60.py.
  async stepProp(propCode: number, delta: number): Promise<void> {
    let list = this.supportedLists.get(propCode) ?? [];
    // FX30 and similar don't enumerate ColorTemp — fall back to hardcoded Kelvin scale
    if (list.length === 0 && propCode === 0xD20F) {
      list = [...KELVIN_SCALE];
    }
    if (list.length === 0) {
      this.warn(`stepProp 0x${propCode.toString(16)}: supported list not yet available — try again after next poll`);
      return;
    }

    const currentVal = this.getPropValue(propCode);
    if (!currentVal) {
      this.warn(`stepProp 0x${propCode.toString(16)}: currentVal not yet available — try again after next poll`);
      return;
    }
    // For ISO the list holds original extended UINT32s (e.g. 0x10000280) while
    // currentVal is already masked to the low 16 bits (e.g. 640). Compare masked.
    const cmpVal = (a: number, b: number) =>
      propCode === 0xD21E ? (a & 0xFFFF) === (b & 0xFFFF) : a === b;
    let idx = list.findIndex(v => cmpVal(v, currentVal));
    if (idx === -1) {
      idx = list.reduce((best, v, i) =>
        Math.abs((v & 0xFFFF) - (currentVal & 0xFFFF)) < Math.abs((list[best]! & 0xFFFF) - (currentVal & 0xFFFF)) ? i : best, 0);
    }
    const newIdx = Math.max(0, Math.min(list.length - 1, idx + delta));
    if (newIdx === idx) return;
    const newVal = list[newIdx]!;

    // Optimistic update so rapid presses don't see a stale current value
    this.setPropState(propCode, newVal);

    const data = this.packPropValue(propCode, newVal);
    await this.sendCmdWithData(0x9205, [propCode], data);
  }

  private getPropValue(propCode: number): number {
    switch (propCode) {
      case 0xD21E: return this.state.iso === 0x00FFFFFF ? 0x00FFFFFF : this.state.iso & 0xFFFF;
      case 0x5007: return this.state.fnumber;
      case 0xD20D: return this.state.shutter;
      case 0x5010: return this.state.expComp;
      case 0xD20F: return this.state.colorTemp;
      default: return 0;
    }
  }

  private setPropState(propCode: number, value: number): void {
    switch (propCode) {
      case 0xD21E: this.state.iso       = value === 0x00FFFFFF ? value : value & 0xFFFF; break;
      case 0x5007: this.state.fnumber   = value; break;
      case 0xD20D: this.state.shutter   = value; break;
      case 0x5010: this.state.expComp   = value; break;
      case 0xD20F: this.state.colorTemp = value; break;
    }
  }

  private packPropValue(propCode: number, value: number): Buffer {
    switch (propCode) {
      case 0xD21E: // ISO — UINT32
      case 0xD20D: { // Shutter — UINT32
        const b = Buffer.alloc(4);
        b.writeUInt32LE(value, 0);
        return b;
      }
      case 0x5007: // FNumber — UINT16
      case 0xD20F: { // ColorTemp — UINT16
        const b = Buffer.alloc(2);
        b.writeUInt16LE(value, 0);
        return b;
      }
      case 0x5010: { // ExpComp — INT16
        const b = Buffer.alloc(2);
        b.writeInt16LE(value, 0);
        return b;
      }
      default: {
        const b = Buffer.alloc(4);
        b.writeUInt32LE(value, 0);
        return b;
      }
    }
  }

  // Set an ext device property to an absolute value directly (bypasses enum list requirement).
  // Use when the target value is known exactly (e.g. WB Kelvin from ATEM) and the camera
  // does not return an enumeration list for the property.
  async setExtDeviceProp(propCode: number, value: number): Promise<void> {
    const data = this.packPropValue(propCode, value);
    this.setPropState(propCode, value);
    await this.sendCmdWithData(0x9205, [propCode], data);
  }

  // MovieRec = Hold mode (rule 5): DOWN → 100ms → UP (per docs/research/ref-sony.md)
  async toggleRecord(): Promise<void> {
    this.log(`REC toggle (recState=${this.state.recState})`);
    await this.controlDevice(0xD2C8, 0x81 /* BUTTON */, 0x0002 /* DOWN */);
    await this.delay(100);
    await this.controlDevice(0xD2C8, 0x81 /* BUTTON */, 0x0001 /* UP */);
  }

  // Push AutoFocus: S1 button DOWN → 150ms → UP
  async triggerAutoFocus(): Promise<void> {
    this.log('Push AF');
    await this.controlDevice(0xD2C1 /* S1_BUTTON */, 0x81 /* BUTTON */, 0x0002 /* DOWN */);
    await this.delay(150);
    await this.controlDevice(0xD2C1 /* S1_BUTTON */, 0x81 /* BUTTON */, 0x0001 /* UP */);
  }

  // ─── Low-level ─────────────────────────────────────────────────────────────

  private async sendCmd(op: number, params: number[], phase: number): Promise<Buffer> {
    return this.queue(async () => {
      this.cmdSocket!.write(buildOperationRequest(op, this.transactionId++, params, phase));
      return this.readUntilResponse();
    });
  }

  private async sendCmdReadData(op: number, params: number[]): Promise<Buffer> {
    return this.queue(async () => {
      this.cmdSocket!.write(buildOperationRequest(op, this.transactionId++, params, DATA_PHASE_READ));
      let blob = Buffer.alloc(0);
      while (true) {
        const pkt = await this.readPacket();
        const type = pkt.readUInt32LE(4);
        if (type === 0x0a || type === 0x0c) {
          if (pkt.length > 12) blob = Buffer.concat([blob, pkt.slice(12)]);
        }
        if (type === 0x07) break;
      }
      return blob;
    });
  }

  private async sendCmdWithData(op: number, params: number[], data: Buffer): Promise<void> {
    await this.queue(async () => {
      const tid = this.transactionId++;
      const packets = buildOperationRequestWithData(op, tid, params, data);
      for (const p of packets) this.cmdSocket!.write(p);
      const respCode = await this.readUntilResponseCode();
      if (respCode !== 0x2001) {
        throw new Error(`PTP 0x${op.toString(16)} response 0x${respCode.toString(16).toUpperCase()} (tid=${tid}) — not OK`);
      }
      return Buffer.alloc(0);
    });
  }

  // Returns the PTP response code. Accumulates and discards any data packets.
  // Throws only on socket errors (not on PTP error response codes — callers decide).
  private async readUntilResponseCode(): Promise<number> {
    while (true) {
      const pkt = await this.readPacket();
      const type = pkt.readUInt32LE(4);
      if (type === 0x07) {
        const respCode = pkt.length >= 10 ? pkt.readUInt16LE(8) : 0x2000;
        const tid = pkt.length >= 14 ? pkt.readUInt32LE(10) : -1;
        if (respCode !== 0x2001) {
          this.warn(`Response 0x${respCode.toString(16).toUpperCase()} tid=${tid}`);
        }
        return respCode;
      }
    }
  }

  private async readUntilResponse(): Promise<Buffer> {
    let blob = Buffer.alloc(0);
    while (true) {
      const pkt = await this.readPacket();
      const type = pkt.readUInt32LE(4);
      if (type === 0x0a || type === 0x0c) {
        if (pkt.length > 12) blob = Buffer.concat([blob, pkt.slice(12)]);
      }
      if (type === 0x07) {
        if (pkt.length >= 10) {
          const respCode = pkt.readUInt16LE(8);
          const tid = pkt.length >= 14 ? pkt.readUInt32LE(10) : -1;
          if (respCode !== 0x2001) {
            this.warn(`Response code 0x${respCode.toString(16).toUpperCase()} tid=${tid} (not OK)`);
          }
        }
        return blob.length > 0 ? blob : pkt;
      }
    }
  }

  // Serial promise chain — each task runs only after the previous one resolves or rejects.
  // commandQueue always holds a never-rejecting tail so new tasks can always be appended.
  private queue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.commandQueue.then(() => fn());
    this.commandQueue = next.catch(() => {});
    return next;
  }

  private readPacket(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w.resolve !== resolve);
        reject(new Error(`readPacket timeout (${PACKET_TIMEOUT_MS}ms) — camera may be offline`));
      }, PACKET_TIMEOUT_MS);

      this.waiters.push({
        resolve: (buf) => { clearTimeout(timer); resolve(buf); },
        reject:  (e)   => { clearTimeout(timer); reject(e); },
      });
      this.drainWaiters();
    });
  }

  // Immediately reject all pending readPacket waiters — called on socket error/close.
  private _flushWaiters(err: Error): void {
    const pending = this.waiters.splice(0);
    for (const w of pending) w.reject(err);
  }

  private drainWaiters(): void {
    while (this.waiters.length > 0 && this.rxBuf.length >= 4) {
      const len = this.rxBuf.readUInt32LE(0);
      if (len < 8 || this.rxBuf.length < len) break;
      const pkt = this.rxBuf.slice(0, len);
      this.rxBuf = this.rxBuf.slice(len);
      this.waiters.shift()!.resolve(pkt);
    }
  }

  private connectTcp(host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const s = net.connect(port, host);
      const timer = setTimeout(() => {
        s.destroy();
        reject(new Error(`TCP connect timeout → ${host}:${port}`));
      }, 5000);
      s.once('connect', () => {
        clearTimeout(timer);
        s.setTimeout(0);
        resolve(s);
      });
      s.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private parseDeviceInfoBlob(data: Buffer): { model: string; manufacturer: string; firmware: string; serial: string } {
    const result = { model: 'Sony Camera', manufacturer: '', firmware: '', serial: '' };
    if (!data || data.length < 10) return result;
    try {
      let offset = 8;
      const readStr = (off: number): [string, number] => {
        if (off >= data.length) return ['', off];
        const len = data.readUInt8(off);
        if (len === 0) return ['', off + 1];
        const end = off + 1 + len * 2;
        if (end > data.length) return ['', end];
        return [data.slice(off + 1, end).toString('utf16le').replace(/\0/g, ''), end];
      };
      // PTP arrays are UINT32 count + count × UINT16 elements
      const skipArr = (off: number): number => {
        if (off + 4 > data.length) return off;
        return off + 4 + data.readUInt32LE(off) * 2;
      };
      [, offset] = readStr(offset);    // VendorExtensionDesc
      offset += 2;                      // FunctionalMode (UINT16)
      offset = skipArr(offset);         // OperationsSupported
      offset = skipArr(offset);         // EventsSupported
      offset = skipArr(offset);         // DevicePropertiesSupported
      offset = skipArr(offset);         // CaptureFormats
      offset = skipArr(offset);         // ImageFormats
      [result.manufacturer, offset] = readStr(offset);  // Manufacturer
      [result.model,        offset] = readStr(offset);  // Model
      [result.firmware,     offset] = readStr(offset);  // DeviceVersion (firmware)
      [result.serial]               = readStr(offset);  // SerialNumber
      if (!result.model) result.model = 'Sony Camera';
    } catch (_e) {}
    return result;
  }

  /** @deprecated Use parseDeviceInfoBlob — kept to avoid breaking callers if any */
  private parseModelName(data: Buffer): string {
    return this.parseDeviceInfoBlob(data).model;
  }

  disconnect(): void {
    this.log('Disconnecting...');
    this.state.connected = false;
    this.stopPolling();
    this._flushWaiters(new Error('disconnected'));
    if (this.cmdSocket) { this.cmdSocket.destroy(); this.cmdSocket = null; }
    if (this.evtSocket) { this.evtSocket.destroy(); this.evtSocket = null; }
    this.log('Disconnected');
  }
}
