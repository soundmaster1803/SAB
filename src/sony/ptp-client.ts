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
import { isVendorMarker } from './protocol/prop-knowledge.js';

import {
  buildRuntimeCameraModel,
  updateRuntimeModel,
} from './runtime/builder.js';
import type { RuntimeCameraModel } from './runtime/types.js';
import { HIGH_PRIORITY_INTERVAL_MS } from './polling/high-priority.js';
import { LOW_PRIORITY_INTERVAL_MS } from './polling/low-priority.js';

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
  battery: number;      // 0–100 %
  powerSource: number;  // 0=unknown, 1=DC, 2=Battery, 3=PoE  (prop 0xD03A)
  batteryMinutes: number; // remaining minutes (prop 0xD038); 0=unknown
  charging: boolean;    // true when powerSource∈{1,3} or icon-bit fallback
  recState: number;       // 0=idle, 1=recording
  recRemainSec: number;   // remaining card capacity in seconds (0 = unknown)
  recDurationSec: number; // 0xD120: elapsed recording time in seconds; 0 = not recording
  slotStatus: number;     // 0xD248: 0=unknown, 1=OK, 2=NoCard, 3=Error, 4/6=Recognizing, 7=Locked
  slotStatus2: number;    // 0xD256: same codes as slotStatus, for slot 2
  recRemainSec2: number;  // 0xD258: remaining recordable seconds for slot 2; 0=unknown
  movieFileFormat: number;// 0xD241: file format code; 0=unknown
  movieFileFormatList: number[]; // 0xD241 enumeration — formats this camera supports; [] = unknown
  recSetting: number;     // 0xD242: framerate+bitrate code; 0=unknown
  recSettingList: number[];      // 0xD242 enumeration — recording modes this camera supports; [] = unknown
  recMedia: number;       // 0xD160: recording slot; 0=unknown (1=Slot1, 2=Slot2, 0x0101=Simultaneous)
  recFrameRate: number;   // 0xD286: frame rate code; 0=unknown
  recFrameRateList: number[]; // 0xD286 enumeration — frame rates this camera supports; [] = unknown
  tally: number;      // 0=none, 1=program, 2=preview
  fps?: number;       // current frame rate (from camera or config)
  lastUpdate: number;
  focusMode:      number;  // 0x500A: 0x0001=MF, 0x0002=AF-S, 0x8004=AF-C, 0x8005=AF-A, 0x8006=DMF, 0x8009=PF
  afStatus:       number;  // 0xD213: 0x01=not locked, 0x02=focused, 0x05=tracking
  focalDistanceM: number;  // 0xD004: raw value; /100 = meters, 0xFFFF = infinity
  focalDistanceMin:     number;   // 0xD004 range.min   — UINT32 raw (/100 = meters). 0 = unknown.
  focalDistanceMax:     number;   // 0xD004 range.max   — UINT32 raw (/100 = meters). 0 = unknown.
  focalDistanceStep:    number;   // 0xD004 range.step  — UINT32 raw. 0 = unknown.
  focalDistanceEnabled: boolean;  // 0xD004 IsEnabled flag — true when set via 0x9205 is allowed.
  focusPosition:  number;  // 0xE043: 0x0000=near, 0xFFFF=far; PTP3 only; 0=not available
  nearFarEnable:  number;  // 0xD235: 0x01=enabled (step commands allowed)
}

const TYPE_SIZE: Record<number, number> = {
  0x0001: 1, 0x0002: 1,
  0x0003: 2, 0x0004: 2,
  0x0005: 4, 0x0006: 4,
  0x0008: 8,
};

const PACKET_TIMEOUT_MS = 5000;

export interface SonyLivePropEntry {
  propCode: number;
  dataType: number;
  currentValue: number;
  defaultValue: number;
  formFlag: number;
  /** Raw IsEnabled byte (offset +5) — 0x01 = settable, 0x00 = not settable. */
  isEnabled: number;
  enumValues: number[];
  range?: { min: number; max: number; step: number };
}

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

  /**
   * Runtime-discovered camera model.
   * Built after the first successful poll cycle using live device data.
   * Null until the first complete poll succeeds.
   * Use this as the primary source of truth for what the camera supports.
   */
  public runtimeModel: RuntimeCameraModel | null = null;

  private runtimeModelBuilt = false;

  // Serial command queue — guarantees strict transactionId sequencing.
  // Each enqueued fn is chained onto the tail; a failed task doesn't poison the chain.
  private commandQueue: Promise<any> = Promise.resolve();

  private highPollActive = false;
  private lowPollActive  = false;
  private highPollIntervalMs = HIGH_PRIORITY_INTERVAL_MS;
  private lowPollIntervalMs  = LOW_PRIORITY_INTERVAL_MS;
  private pollErrorCount = 0;

  constructor(ip: string, guid: Buffer) {
    super();
    this.guid = guid;
    this.state = {
      id: '', ip, name: '',
      connected: false,
      iso: 0, fnumber: 0, shutter: 0,
      expComp: 0, colorTemp: 5500,
      battery: 0, powerSource: 0, batteryMinutes: 0, charging: false, recState: 0, recRemainSec: 0, recDurationSec: 0, slotStatus: 0, slotStatus2: 0, recRemainSec2: 0, movieFileFormat: 0, movieFileFormatList: [], recSetting: 0, recSettingList: [], recMedia: 0, recFrameRate: 0, recFrameRateList: [],
      tally: 0, lastUpdate: 0,
      focusMode: 0, afStatus: 0, focalDistanceM: 0, focusPosition: 0, nearFarEnable: 0,
      focalDistanceMin: 0, focalDistanceMax: 0, focalDistanceStep: 0, focalDistanceEnabled: false,
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
        this.runtimeModelBuilt = false;
        this.runtimeModel = null;
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
    this.vlog(`[8] → GetExtDeviceInfo op=0x9202 version=0x012C flag=0x00000001`);
    await this.sendCmd(OPCODES.SDIO_GET_EXT_DEVICE_INFO, [0x012C, 0x00000001], DATA_PHASE_NONE);
    this.vlog(`[8] ← GetExtDeviceInfo done`);

    // 9. SDIO_Connect Phase 3 — finalises session
    this.vlog(`[9] → SDIO_Connect Phase 3 [3,0,0]`);
    await this.sendCmd(OPCODES.SDIO_CONNECT, [3, 0, 0], DATA_PHASE_NONE);
    this.vlog(`[9] ← Phase 3 done — PTP 3.00 handshake complete`);

    this.state.connected = true;
    this.log(`✓ Connected — ${devInfo.model} fw=${devInfo.firmware || '?'} sn=${devInfo.serial || '?'} (handshake ${Date.now() - t0}ms total)`);
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  startPolling(highMs = HIGH_PRIORITY_INTERVAL_MS, lowMs = LOW_PRIORITY_INTERVAL_MS): void {
    this.highPollIntervalMs = highMs;
    this.lowPollIntervalMs  = lowMs;
    this.highPollActive = true;
    this.lowPollActive  = true;
    this.pollErrorCount = 0;
    this.highPriorityPollLoop();
    this.lowPriorityPollLoop();
  }

  stopPolling(): void {
    this.highPollActive = false;
    this.lowPollActive  = false;
  }

  private pollCount = 0;

  /**
   * High-priority poll cycle (~200 ms).
   *
   * Fetches the full prop blob via 0x9209 and parses all high-priority state
   * fields (ISO, shutter, aperture, battery, rec state, remaining time).
   * Stores the blob in lastPollBlob for the low-priority cycle to consume.
   */
  private async highPriorityPollLoop(): Promise<void> {
    while (this.highPollActive) {
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
      await this.delay(this.highPollIntervalMs);
    }
  }

  /**
   * Low-priority poll cycle (~1000 ms).
   *
   * Reads from the cached lastPollBlob written by the high-priority cycle.
   * Issues no additional PTP calls — the blob is always fresh enough for
   * low-priority props (WB mode, focus mode, metering mode, exposure mode).
   *
   * State fields for these props will be added in Phase 8.
   * This loop establishes the structural boundary and timing now.
   */
  private async lowPriorityPollLoop(): Promise<void> {
    while (this.lowPollActive) {
      await this.delay(this.lowPollIntervalMs);
      if (!this.lowPollActive) break;
      if (!this.lastPollBlob) continue;
      // Low-priority prop extraction will be wired here in Phase 8.
      // The blob is available via this.lastPollBlob for all prop codes.
    }
  }

  // ─── Hunter parser (from v60.py) ───────────────────────────────────────────

  // Returns [currentValue, enumerationList] for a prop code in the polling blob.
  private hunterExtractWithList(blob: Buffer, propCode: number): [number | null, number[]] {
    const entries = this.parseSonyPollEntries(blob);
    for (const entry of entries) {
      if (entry.propCode === propCode) {
        const value = propCode === 0xD21E
          ? (entry.currentValue === 0x00FFFFFF ? entry.currentValue : entry.currentValue & 0xFFFF)
          : entry.currentValue;
        return [value, entry.enumValues];
      }
    }
    return [null, []];
  }

  private parseSonyPollEntries(blob: Buffer): SonyLivePropEntry[] {
    if (!blob || blob.length < 8) return [];

    const count = this.detectSonyPollRecordCount(blob);
    if (count !== null) {
      const entries = this.parseSonyPollEntriesFromOffset(blob, 4, count);
      if (entries.length === count) return entries;
    }

    return this.parseSonyPollEntriesFromOffset(blob, 0);
  }

  private detectSonyPollRecordCount(blob: Buffer): number | null {
    if (blob.length < 4) return null;
    const count = blob.readUInt32LE(0);
    if (count > 0 && count < 4096 && blob.length >= 4 + count * 9) return count;
    return null;
  }

  private parseSonyPollEntriesFromOffset(blob: Buffer, startOffset: number, recordCount?: number): SonyLivePropEntry[] {
    const results = new Map<number, SonyLivePropEntry>();
    let offset = startOffset;
    let remaining = recordCount ?? Number.POSITIVE_INFINITY;

    while (offset < blob.length - 8 && remaining > 0) {
      const parsed = this.parseSonyPollRecord(blob, offset);
      if (!parsed) {
        if (recordCount != null) return [];
        offset += 1;
        continue;
      }

      if (!isVendorMarker(parsed.entry.propCode)) {
        const existing = results.get(parsed.entry.propCode);
        if (!existing || parsed.entry.enumValues.length > existing.enumValues.length || (!!parsed.entry.range && !existing.range)) {
          results.set(parsed.entry.propCode, parsed.entry);
        }
      }

      offset += parsed.length;
      remaining -= 1;
    }

    if (recordCount != null && remaining !== 0) return [];
    return [...results.values()].sort((a, b) => a.propCode - b.propCode);
  }

  private readPropValue(blob: Buffer, dtype: number, off: number): number {
    switch (dtype) {
      case 0x0001: return blob.readInt8(off);
      case 0x0002: return blob.readUInt8(off);
      case 0x0003: return blob.readInt16LE(off);
      case 0x0004: return blob.readUInt16LE(off);
      case 0x0005: return blob.readUInt32LE(off);
      case 0x0006: return blob.readInt32LE(off);
      default: return blob.readUInt8(off);
    }
  }

  private parseSonyPollRecord(blob: Buffer, offset: number): { entry: SonyLivePropEntry; length: number } | null {
    if (offset + 6 >= blob.length) return null;

    const propCode = blob.readUInt16LE(offset);
    if (!this.isValidSonyPropCode(propCode)) return null;

    const dataType = blob.readUInt16LE(offset + 2);
    const size = TYPE_SIZE[dataType];
    if (!size) return null;

    const getSet = blob.readUInt8(offset + 4);
    const isEnabled = blob.readUInt8(offset + 5);
    if (getSet > 0x03 || isEnabled > 0x03) return null;

    const defaultOff = offset + 6;
    const currentOff = defaultOff + size;
    const formFlagOff = currentOff + size;
    if (formFlagOff >= blob.length) return null;

    const formFlag = blob.readUInt8(formFlagOff);
    if (formFlag !== 0x00 && formFlag !== 0x01 && formFlag !== 0x02) return null;

    if (currentOff + size > blob.length) return null;
    const defaultValue = this.readPropValue(blob, dataType, defaultOff);
    const currentValue = this.readPropValue(blob, dataType, currentOff);

    let nextOffset = formFlagOff + 1;
    const enumValues: number[] = [];
    let range: SonyLivePropEntry['range'];

    if (formFlag === 0x02) {
      if (nextOffset + 2 > blob.length) return null;
      const count = blob.readUInt16LE(nextOffset);
      if (count > 128) return null;
      nextOffset += 2;
      if (nextOffset + count * size > blob.length) return null;
      for (let i = 0; i < count; i++) {
        enumValues.push(this.readPropValue(blob, dataType, nextOffset + i * size));
      }
      const deduped = [...new Set(enumValues)];
      enumValues.length = 0;
      enumValues.push(...deduped.slice(0, 64));
      nextOffset += count * size;
    } else if (formFlag === 0x01) {
      if (nextOffset + size * 3 > blob.length) return null;
      range = {
        min: this.readPropValue(blob, dataType, nextOffset),
        max: this.readPropValue(blob, dataType, nextOffset + size),
        step: this.readPropValue(blob, dataType, nextOffset + size * 2),
      };
      nextOffset += size * 3;
    }

    return {
      entry: {
        propCode,
        dataType,
        currentValue,
        defaultValue,
        formFlag,
        isEnabled,
        enumValues,
        ...(range ? { range } : {}),
      },
      length: nextOffset - offset,
    };
  }

  private isValidSonyPropCode(propCode: number): boolean {
    return (
      (propCode >= 0x5000 && propCode <= 0x5FFF) ||
      (propCode >= 0xD000 && propCode <= 0xDFFF) ||
      (propCode >= 0xE000 && propCode <= 0xEFFF)
    );
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

  /** Find a single parsed prop entry (with range / isEnabled / formFlag) in a poll blob. */
  private findPollEntry(blob: Buffer, propCode: number): SonyLivePropEntry | null {
    const entries = this.parseSonyPollEntries(blob);
    for (const e of entries) if (e.propCode === propCode) return e;
    return null;
  }

  /**
   * Parse all property records currently present in the last Sony poll blob.
   * This is used for diagnostics/debug UI only and must not affect the control path.
   */
  public scanAllProps(): SonyLivePropEntry[] {
    const blob = this.lastPollBlob;
    if (!blob || blob.length < 8) return [];
    return this.parseSonyPollEntries(blob);
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
    const [batteryIcon]            = this.hunterExtractWithList(blob, 0xD205);
    const [batteryStep]            = this.hunterExtractWithList(blob, 0xD20E);
    const [powerSource]            = this.hunterExtractWithList(blob, 0xD03A);
    const [batteryMinutes]         = this.hunterExtractWithList(blob, 0xD038);
    const [recState]               = this.hunterExtractWithList(blob, 0xD21D);
    const [focusMode]              = this.hunterExtractWithList(blob, 0x500A);
    const [afStatus]               = this.hunterExtractWithList(blob, 0xD213);
    const [focalDistM]             = this.hunterExtractWithList(blob, 0xD004);
    const [focusPos]               = this.hunterExtractWithList(blob, 0xE043);  // current lens position (PTP3)
    const [nearFarEn]              = this.hunterExtractWithList(blob, 0xD235);  // step enable flag
    // Remaining recordable time in seconds.
    // Priority: 0xD24A (Slot1 Remaining Time, confirmed on ZV-E10M2/FX30)
    //           0xD3C2/0xD3C4 (legacy prop codes, fallback for older models)
    const [remSecD24A]             = this.hunterExtractWithList(blob, 0xD24A);
    const [remSec3]                = this.hunterExtractWithList(blob, 0xD3C4);
    const [remSec1]                = this.hunterExtractWithList(blob, 0xD3C2);
    // Use first non-null, non-zero candidate (0xD24A preferred, fallback to legacy codes).
    // ?? would not fall through on value=0; using > 0 check avoids stale-zero masking.
    const remSecRaw = (remSecD24A !== null && remSecD24A > 0) ? remSecD24A
      : (remSec1  !== null && remSec1  > 0) ? remSec1
      : remSec3;
    const remSec = (remSecRaw !== null && remSecRaw > 0 && remSecRaw < 86400) ? remSecRaw : 0;
    // Recording duration (elapsed time) — 0xD120, UINT32 seconds
    const [recDuration]            = this.hunterExtractWithList(blob, 0xD120);
    // Media / recording settings — polled low-priority but extracted from same blob
    const [slotStatus]             = this.hunterExtractWithList(blob, 0xD248);
    const [slotStatus2]            = this.hunterExtractWithList(blob, 0xD256);
    const [remSec2Raw]             = this.hunterExtractWithList(blob, 0xD258);
    const remSec2 = (remSec2Raw !== null && remSec2Raw > 0 && remSec2Raw < 86400) ? remSec2Raw : 0;
    const [movieFileFormat, fileFormatList] = this.hunterExtractWithList(blob, 0xD241);
    const [recSetting, recSettingList]      = this.hunterExtractWithList(blob, 0xD242);
    const [recFrameRate, recFrameRateList]  = this.hunterExtractWithList(blob, 0xD286);
    const [recMedia]               = this.hunterExtractWithList(blob, 0xD160);

    // Log parsed values on first successful poll, then every 50 polls
    if (!this.parsedOnce || this.pollCount % 50 === 0) {
      const d004 = this.findPollEntry(blob, 0xD004);
      const d004Info = d004
        ? `0xD004: cur=${d004.currentValue} en=${d004.isEnabled} form=${d004.formFlag}` +
          (d004.range ? ` min=${d004.range.min} max=${d004.range.max >>> 0} step=${d004.range.step}` : ' (no range)')
        : '0xD004: absent';
      const e042 = this.findPollEntry(blob, 0xE042);
      const e042Info = e042 ? `0xE042: type=0x${e042.dataType.toString(16)} cur=${e042.currentValue} en=${e042.isEnabled} form=${e042.formFlag}` : '0xE042: absent';
      const e043 = this.findPollEntry(blob, 0xE043);
      const e043Info = e043 ? `0xE043: type=0x${e043.dataType.toString(16)} cur=${e043.currentValue}` : '0xE043: absent';
      const d235 = this.findPollEntry(blob, 0xD235);
      const d235Info = d235 ? `0xD235(nearFar): cur=${d235.currentValue} en=${d235.isEnabled}` : '0xD235: absent';
      this.vlog(
        `Props: iso=${iso ?? '?'} fn=${fnumber ?? '?'} shut=0x${(shutter ?? 0).toString(16)} ` +
        `ev=${expComp ?? '?'} ct=${colorT ?? '?'} bat=${battery ?? '?'} rec=${recState ?? '?'} ` +
        `focusMode=0x${(focusMode ?? 0).toString(16)} nearFar=0x${(nearFarEn ?? 0).toString(16)} ` +
        `| lists: iso=${isoList.length} fn=${fnList.length} shut=${shutList.length} ev=${expList.length} ct=${colorList.length} ` +
        `| ${d004Info} | ${e042Info} | ${e043Info} | ${d235Info}`
      );
      this.parsedOnce = true;
    }

    // Update supported lists (skip empty — camera may not send them every poll)
    if (isoList.length)       this.supportedLists.set(0xD21E, isoList);
    if (fnList.length)        this.supportedLists.set(0x5007, fnList);
    if (shutList.length)      this.supportedLists.set(0xD20D, shutList);
    if (expList.length)       this.supportedLists.set(0x5010, expList);
    if (colorList.length)     this.supportedLists.set(0xD20F, colorList);
    if (fileFormatList.length) {
      this.supportedLists.set(0xD241, fileFormatList);
      this.state.movieFileFormatList = fileFormatList;
    }
    if (recSettingList.length) {
      this.supportedLists.set(0xD242, recSettingList);
      this.state.recSettingList = recSettingList;
    }
    if (recFrameRateList.length) {
      this.supportedLists.set(0xD286, recFrameRateList);
      this.state.recFrameRateList = recFrameRateList;
    }

    // ── Power-source / charging detection ────────────────────────────────────
    // Evaluated in priority order — first truthy match wins:
    //
    // 1. 0xD03A (Power Source) — authoritative when present.
    //      0x01 = DC/AC adapter, 0x02 = Battery (not charging), 0x03 = PoE.
    //      If camera sends 0x02 explicitly → definitely NOT charging.
    //
    // 2. 0xD20E (Battery Level Indicator) — secondary:
    //      0x10 = USB Bus Power only (AC via USB).
    //      0x01 = Fake/dummy battery (DC coupler + AC adapter, common on FX30).
    //
    // 3. 0xD205 (Battery Level Icon) bit 3 (0x08) — confirmed ZV-E10M2 fw 1.02:
    //      AC: 0x0F (bit 3 set)  |  Battery only: 0x07 (bit 3 clear).
    //
    // 4. Legacy: battery > 100 or battery === 255 (older Sony models).
    const batPct = battery !== null ? Math.min(100, battery > 100 ? 100 : battery) : null;
    const ps = powerSource ?? 0;
    const bs = batteryStep ?? 0;

    let isCharging: boolean;
    if (ps === 0x01 || ps === 0x03) {
      isCharging = true;                                                       // 0xD03A: DC or PoE
    } else if (ps === 0x02) {
      isCharging = false;                                                      // 0xD03A: Battery (explicit)
    } else if (bs === 0x10 || bs === 0x01) {
      isCharging = true;                                                       // 0xD20E: USB Bus Power / DC coupler
    } else if (bs !== 0 && (bs & 0x08) !== 0) {
      isCharging = true;                                                       // 0xD20E bit 3: AC indicator (FX30 uses 0x0E, ZV-E10M2 uses 0x0F via 0xD205)
    } else if (batteryIcon !== null && (batteryIcon & 0x08) !== 0) {
      isCharging = true;                                                       // 0xD205 bit 3: ZV-E10M2 confirmed
    } else {
      isCharging = battery !== null && (battery > 100 || battery === 255);    // legacy fallback
    }

    const batMin = (batteryMinutes !== null && batteryMinutes > 0 && batteryMinutes < 9999)
      ? batteryMinutes : 0;

    let changed = false;
    if (iso      !== null && iso      !== this.state.iso)       { this.state.iso       = iso;      changed = true; }
    if (fnumber  !== null && fnumber  !== this.state.fnumber)   { this.state.fnumber   = fnumber;  changed = true; }
    if (shutter  !== null && shutter  !== this.state.shutter)   { this.state.shutter   = shutter;  changed = true; }
    if (expComp  !== null && expComp  !== this.state.expComp)   { this.state.expComp   = expComp;  changed = true; }
    if (colorT   !== null && colorT   !== this.state.colorTemp) { this.state.colorTemp = colorT;   changed = true; }
    if (batPct   !== null && batPct   !== this.state.battery)         { this.state.battery        = batPct;   changed = true; }
    if (ps !== 0 && ps !== this.state.powerSource)                    { this.state.powerSource    = ps;       changed = true; }
    if (batMin !== this.state.batteryMinutes)                         { this.state.batteryMinutes = batMin;   changed = true; }
    if (isCharging !== this.state.charging) {
      this.log(`[PWR] charging ${this.state.charging}→${isCharging}  d03a=0x${ps.toString(16)} d20e=0x${bs.toString(16)} d205=0x${(batteryIcon??0).toString(16)} bat=${battery} pct=${batPct}`);
      this.state.charging = isCharging; changed = true;
    }
    if (recState  !== null && recState  !== this.state.recState)       { this.state.recState      = recState;   changed = true; }
    if (remSec    !== this.state.recRemainSec)                        { this.state.recRemainSec  = remSec;     changed = true; }
    if (focusMode !== null && focusMode !== this.state.focusMode)           { this.state.focusMode     = focusMode;   changed = true; }
    if (afStatus  !== null && afStatus  !== this.state.afStatus)            { this.state.afStatus      = afStatus;    changed = true; }
    if (focalDistM !== null && focalDistM !== this.state.focalDistanceM)    { this.state.focalDistanceM = focalDistM; changed = true; }

    // ── Focal Distance in Meter (0xD004) range + IsEnabled ──────────────
    // Values in the dataset are UINT32 raw; divide by 100 for meters.
    // range is only populated when formFlag=0x01 (Range form).
    {
      const d004 = this.findPollEntry(blob, 0xD004);
      if (d004) {
        // Some Sony bodies report IsEnabled=0x02 for 0xD004 while still accepting
        // a direct set. Treat anything non-zero as "try it" and let the PTP
        // response code be the final arbiter.
        const en = d004.isEnabled !== 0x00;
        if (en !== this.state.focalDistanceEnabled) {
          this.state.focalDistanceEnabled = en;
          changed = true;
        }
        if (d004.range) {
          if (d004.range.min  !== this.state.focalDistanceMin)  { this.state.focalDistanceMin  = d004.range.min;  changed = true; }
          if (d004.range.max  !== this.state.focalDistanceMax)  { this.state.focalDistanceMax  = d004.range.max;  changed = true; }
          if (d004.range.step !== this.state.focalDistanceStep) { this.state.focalDistanceStep = d004.range.step; changed = true; }
        }
      }
    }
    if (focusPos  !== null && focusPos  !== this.state.focusPosition)       { this.state.focusPosition = focusPos;    changed = true; }
    if (nearFarEn !== null && nearFarEn !== this.state.nearFarEnable)       { this.state.nearFarEnable = nearFarEn;   changed = true; }
    if (recDuration !== null && recDuration !== this.state.recDurationSec)  { this.state.recDurationSec = recDuration; changed = true; }
    if (slotStatus  !== null && slotStatus  !== this.state.slotStatus)      { this.state.slotStatus     = slotStatus;  changed = true; }
    if (slotStatus2 !== null && slotStatus2 !== this.state.slotStatus2)    { this.state.slotStatus2    = slotStatus2; changed = true; }
    if (remSec2     !== this.state.recRemainSec2)                          { this.state.recRemainSec2  = remSec2;     changed = true; }
    if (movieFileFormat !== null && movieFileFormat !== this.state.movieFileFormat) { this.state.movieFileFormat = movieFileFormat; changed = true; }
    if (recSetting  !== null && recSetting  !== this.state.recSetting)      { this.state.recSetting     = recSetting;  changed = true; }
    if (recMedia     !== null && recMedia     !== this.state.recMedia)          { this.state.recMedia        = recMedia;     changed = true; }
    if (recFrameRate !== null && recFrameRate !== this.state.recFrameRate)     { this.state.recFrameRate    = recFrameRate; changed = true; }

    if (changed) {
      this.state.lastUpdate = Date.now();
      this.emit('stateUpdate', this.state);
    }

    // ── Runtime camera model ───────────────────────────────────────────────
    // Build once on first poll, update on every subsequent poll.
    // scanAllProps() provides the full prop list including vendor-marker filtering.
    const liveProps = this.scanAllProps();
    if (!this.runtimeModelBuilt && liveProps.length > 0) {
      this.runtimeModel = buildRuntimeCameraModel(
        {
          cameraId: this.state.id,
          model: this.state.model ?? 'Unknown',
          firmware: this.deviceFirmware,
          manufacturer: this.deviceManufacturer,
          serial: this.deviceSerial,
        },
        liveProps,
      );
      this.runtimeModelBuilt = true;
      this.log(
        `Runtime model built: ${this.runtimeModel.knownProps.size} known props, ` +
        `${this.runtimeModel.unknownProps.size} unknown props, ` +
        `mode=${this.runtimeModel.sessionMode}`,
      );
    } else if (this.runtimeModel && liveProps.length > 0) {
      updateRuntimeModel(this.runtimeModel, liveProps);
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
      case 0xE043: return this.state.focusPosition;
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
      case 0xE043: this.state.focusPosition = value; break;
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
      case 0xD20F: // ColorTemp — UINT16
      case 0xE042: { // Focus Position Setting — UINT16 (dataType=0x04 confirmed in poll)
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

  // Pack a prop value using the data type reported by the camera's poll blob.
  // Falls back to hardcoded mapping when the prop is absent from the blob.
  private packPropValueDynamic(propCode: number, value: number): Buffer {
    if (this.lastPollBlob) {
      const entry = this.findPollEntry(this.lastPollBlob, propCode);
      if (entry) {
        switch (entry.dataType) {
          case 0x0001: { const b = Buffer.alloc(1); b.writeInt8(value, 0);     return b; }
          case 0x0002: { const b = Buffer.alloc(1); b.writeUInt8(value, 0);    return b; }
          case 0x0003: { const b = Buffer.alloc(2); b.writeInt16LE(value, 0);  return b; }
          case 0x0004: { const b = Buffer.alloc(2); b.writeUInt16LE(value, 0); return b; }
          case 0x0005: { const b = Buffer.alloc(4); b.writeUInt32LE(value, 0); return b; }
          case 0x0006: { const b = Buffer.alloc(4); b.writeInt32LE(value, 0);  return b; }
        }
      }
    }
    return this.packPropValue(propCode, value);
  }

  // Set an ext device property to an absolute value directly (bypasses enum list requirement).
  // Use when the target value is known exactly (e.g. WB Kelvin from ATEM) and the camera
  // does not return an enumeration list for the property.
  async setExtDeviceProp(propCode: number, value: number): Promise<void> {
    const data = this.packPropValueDynamic(propCode, value);
    this.log(`setExtDeviceProp 0x${propCode.toString(16)} = ${value} (${data.length}B)`);
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

  // Format a media slot.
  // type='full'  → 0xD2E2 value 0x0001 (Slot1) / 0x0002 (Slot2)
  // type='quick' → 0xD2E2 value 0x0011 (Slot1) / 0x0012 (Slot2)
  // Sets the format type via 0xD2E2, then triggers 0xD2CA (Media Format button) Down→Up.
  async formatMedia(slot: 1 | 2, type: 'full' | 'quick'): Promise<void> {
    const formatValue = type === 'full'
      ? (slot === 1 ? 0x0001 : 0x0002)
      : (slot === 1 ? 0x0011 : 0x0012);
    this.log(`Format media slot=${slot} type=${type} value=0x${formatValue.toString(16)}`);
    await this.controlDevice(0xD2E2, 0x84, formatValue);
    await this.delay(100);
    await this.controlDevice(0xD2CA, 0x81, 0x0002 /* DOWN */);
    await this.delay(200);
    await this.controlDevice(0xD2CA, 0x81, 0x0001 /* UP */);
  }

  // Set recording slot, file format, frame rate, and/or recording mode (fps+bitrate).
  async setRecordingSettings(opts: { recMedia?: number; movieFileFormat?: number; recFrameRate?: number; recSetting?: number }): Promise<void> {
    if (opts.recMedia !== undefined)        await this.setExtDeviceProp(0xD160, opts.recMedia);
    if (opts.movieFileFormat !== undefined) await this.setExtDeviceProp(0xD241, opts.movieFileFormat);
    if (opts.recFrameRate !== undefined)    await this.setExtDeviceProp(0xD286, opts.recFrameRate);
    if (opts.recSetting !== undefined)      await this.setExtDeviceProp(0xD242, opts.recSetting);
  }

  // Push AutoFocus: S1 button DOWN → 150ms → UP
  async triggerAutoFocus(): Promise<void> {
    this.log('Push AF');
    await this.controlDevice(0xD2C1 /* S1_BUTTON */, 0x81 /* BUTTON */, 0x0002 /* DOWN */);
    await this.delay(150);
    await this.controlDevice(0xD2C1 /* S1_BUTTON */, 0x81 /* BUTTON */, 0x0001 /* UP */);
  }

  // Set focus mode (prop 0x500A). Use FOCUS_MODE_VALUES constants for the value.
  // Per Sony protocol recommendation: 500ms settling time after mode change before
  // sending follow-up commands (focus position, step, etc.).
  async setFocusMode(mode: number): Promise<void> {
    this.log(`SetFocusMode 0x${mode.toString(16)}`);
    const data = Buffer.alloc(2);
    data.writeUInt16LE(mode, 0);
    await this.sendCmdWithData(0x9205, [0x500A], data);
    this.state.focusMode = mode;
    await this.delay(500);
  }

  // Set focus area (prop 0xD22C). Use FOCUS_AREA_VALUES constants for the value.
  async setFocusArea(area: number): Promise<void> {
    this.log(`SetFocusArea 0x${area.toString(16)}`);
    const data = Buffer.alloc(2);
    data.writeUInt16LE(area, 0);
    await this.sendCmdWithData(0x9205, [0xD22C], data);
  }

  // Get focus distance range (min/max) for prop 0xD004 using SDIO_GetAllExtDevicePropInfo.
  // Returns [min, max] in raw UINT32 values (divide by 100 for meters).
  async getFocusDistanceRange(): Promise<[number, number] | null> {
    try {
      const blob = await this.sendCmdReadData(0x9209, []);
      if (!blob || blob.length < 8) {
        this.warn(`SDIO_GetAllExtDevicePropInfo returned empty or short blob: ${blob?.length} bytes`);
        return null;
      }

      this.vlog(`SDIO_GetAllExtDevicePropInfo blob length: ${blob.length}`);

      // Parse the SDIO_GetAllExtDevicePropInfo response
      // Each dataset: DevicePropertyCode (2), DataType (2), GetSet (1), IsEnabled (1), FormFlag (1), CurrentValue (varies)
      // For Range form (FormFlag=0x01): after CurrentValue: MinimumValue (4), MaximumValue (4), StepValue (4)
      let offset = 0;
      let foundD004 = false;
      while (offset + 8 < blob.length) {
        const propCode = blob.readUInt16LE(offset);
        const dataType = blob.readUInt16LE(offset + 2);
        const getSet = blob.readUInt8(offset + 4);
        const isEnabled = blob.readUInt8(offset + 5);
        const formFlag = blob.readUInt8(offset + 6);

        this.vlog(`Prop 0x${propCode.toString(16)}: type=0x${dataType.toString(16)} getSet=0x${getSet.toString(16)} enabled=0x${isEnabled.toString(16)} form=0x${formFlag.toString(16)}`);

        if (propCode === 0xD004) {
          foundD004 = true;
          if (formFlag === 0x01 && isEnabled === 0x01) {
            // UINT32 data type, so CurrentValue is 4 bytes
            const currentValueSize = 4; // UINT32
            const currentValueOffset = offset + 7;
            const minOffset = currentValueOffset + currentValueSize;
            const maxOffset = minOffset + 4;

            if (maxOffset + 4 <= blob.length) {
              const min = blob.readUInt32LE(minOffset);
              const max = blob.readUInt32LE(maxOffset);
              this.log(`Focus distance range: min=0x${min.toString(16)} (${min / 100}m), max=0x${max.toString(16)} (${max / 100}m)`);
              return [min, max];
            } else {
              this.warn(`Prop 0xD004 range data out of bounds: maxOffset=${maxOffset} blob.length=${blob.length}`);
            }
          } else {
            this.warn(`Prop 0xD004 not range/enabled: formFlag=0x${formFlag.toString(16)} isEnabled=0x${isEnabled.toString(16)}`);
          }
        }

        // Skip to next dataset: fixed header (7) + CurrentValue size + Range data if applicable
        const currentValueSize = dataType === 0x0006 ? 4 : (dataType === 0x0004 ? 2 : 4); // UINT32=6, UINT16=4, default 4
        let skip = 7 + currentValueSize;
        if (formFlag === 0x01) skip += 12; // Min, Max, Step
        offset += skip;
      }

      if (!foundD004) {
        this.warn('Prop 0xD004 not found in SDIO_GetAllExtDevicePropInfo response');
      }
      return null;
    } catch (e) {
      this.warn(`Failed to get focus distance range: ${e}`);
      return null;
    }
  }

  // Set absolute focus position (prop 0xE042). PTP3 cameras only.
  // position: 0x0000 = near limit, 0xFFFF = far limit.
  // Camera must be in MF or DMF mode — AF cameras silently reject this.
  async setFocusPositionAbsolute(position: number): Promise<void> {
    const clamped = Math.max(0, Math.min(0xFFFF, position));
    this.log(`SetFocusPosition 0x${clamped.toString(16)} (${((clamped / 0xFFFF) * 100).toFixed(1)}%)`);

    // 0xE042 requires SDIO_ControlDevice (0x9207) with FLAG_EXT_OPT — not SetDevicePropValue (0x9205).
    // Camera ACKs 0x9205 without error but silently ignores the command.
    // Wire format: UINT16 value padded to 4-byte UINT32 LE (confirmed: dataType=0x04 in poll blob).
    const FLAG_EXT_OPT = 0x00000001;
    const data = Buffer.alloc(4);
    data.writeUInt32LE(clamped, 0);
    await this.sendCmdWithData(0x9207, [0xE042, FLAG_EXT_OPT], data);

    // Update state
    this.state.focusPosition = clamped;
    this.state.lastUpdate = Date.now();
    this.emit('stateUpdate', this.state);
    await this.delay(500); // Allow time for lens to move
  }

  // Step focus one increment toward near (0xD2D7) — single button pulse.
  // Checks 0xD235 Near/Far Enable Status before sending. Camera must be in MF or DMF.
  async stepFocusNear(): Promise<void> {
    if (this.state.nearFarEnable !== 0 && this.state.nearFarEnable !== 0x01) {
      this.warn(`stepFocusNear skipped — nearFarEnable=0x${this.state.nearFarEnable.toString(16)} (not enabled)`);
      return;
    }
    this.log('FocusStep Near');
    await this.controlDevice(0xD2D7, SDI_CONTROL_TYPE.BUTTON, 0x0002 /* DOWN */);
    await this.delay(50);
    await this.controlDevice(0xD2D7, SDI_CONTROL_TYPE.BUTTON, 0x0001 /* UP */);
  }

  // Step focus one increment toward far (0xD2D8) — single button pulse.
  // Checks 0xD235 Near/Far Enable Status before sending. Camera must be in MF or DMF.
  async stepFocusFar(): Promise<void> {
    if (this.state.nearFarEnable !== 0 && this.state.nearFarEnable !== 0x01) {
      this.warn(`stepFocusFar skipped — nearFarEnable=0x${this.state.nearFarEnable.toString(16)} (not enabled)`);
      return;
    }
    this.log('FocusStep Far');
    await this.controlDevice(0xD2D8, SDI_CONTROL_TYPE.BUTTON, 0x0002 /* DOWN */);
    await this.delay(50);
    await this.controlDevice(0xD2D8, SDI_CONTROL_TYPE.BUTTON, 0x0001 /* UP */);
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
    this.runtimeModelBuilt = false;
    this.runtimeModel = null;
    this._flushWaiters(new Error('disconnected'));
    if (this.cmdSocket) { this.cmdSocket.destroy(); this.cmdSocket = null; }
    if (this.evtSocket) { this.evtSocket.destroy(); this.evtSocket = null; }
    this.log('Disconnected');
  }

  // Graceful disconnect: sends CloseSession so the camera frees the PTP session
  // before the sockets are destroyed. Falls back to force-disconnect on timeout.
  async gracefulDisconnect(): Promise<void> {
    if (this.state.connected && this.cmdSocket && !this.cmdSocket.destroyed) {
      try {
        await Promise.race([
          this.sendCmd(OPCODES.CLOSE_SESSION, [], DATA_PHASE_NONE),
          new Promise<void>((_, rej) => setTimeout(() => rej(new Error('CloseSession timeout')), 1500)),
        ]);
        this.log('CloseSession OK');
      } catch (e: any) {
        this.warn(`CloseSession skipped: ${e.message}`);
      }
    }
    this.disconnect();
  }
}
