/**
 * api/routes/cameras.ts
 *
 * Camera management and control endpoints.
 *
 * Routes:
 *   POST   /api/cameras/rec-all          — start recording on all idle cameras
 *   POST   /api/cameras/stop-all         — stop recording on all cameras
 *   POST   /api/cameras/pair             — pair a new camera (blocking, up to 15s)
 *   POST   /api/cameras/:id/connect      — reconnect a disconnected camera
 *   POST   /api/cameras/:id/record       — toggle record on a camera
 *   POST   /api/cameras/:id/adjust       — step a camera property (iso/iris/shutter/etc.)
 *   POST   /api/cameras/:id/af           — trigger autofocus
 *   POST   /api/cameras/:id/color-temp   — step color temperature
 *   PATCH  /api/cameras/:id             — update camera config (name/ip/atemInput/control)
 *   DELETE /api/cameras/:id             — unpair camera
 */

import { Router } from 'express';
import type { CameraManager } from '../../sony/manager';
import type { ATEMListener } from '../../atem/listener';
import { saveConfig, addCamera, removeCamera, type AppConfig, type CameraConfig } from '../../config';
import { appendLog } from '../../logger';
import {
  awaitCameraConnection,
  CAMERA_PROP_MAP,
  findAtemInputConflict,
  isValidIpv4,
  parseAtemInput,
  reconnectCamera,
  syncCameraInputToAtem,
} from '../services/cameras';
import { getSonyModelSpec } from '../../sony/models/index';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string) { console.log(`[${ts()}] [UI] ${msg}`); }
function err(msg: string) { console.error(`[${ts()}] [UI] ERROR: ${msg}`); }

export interface CameraRouteDeps {
  manager: CameraManager;
  atemListener: ATEMListener;
  getConfig: () => AppConfig;
  setConfig: (cfg: AppConfig) => void;
}

export function createCameraRoutes({ manager, atemListener, getConfig, setConfig }: CameraRouteDeps): Router {
  const router = Router();

  // ── Camera: global record start / stop ────────────────────────────────────
  router.post('/api/cameras/rec-all', async (_req, res) => {
    log('REC ALL — starting recording on all idle connected cameras');
    try {
      await manager.startAllRecording();
      res.json({ ok: true });
    } catch (e: any) {
      err(`rec-all failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/api/cameras/stop-all', async (_req, res) => {
    log('STOP ALL — stopping recording on all recording cameras');
    try {
      await manager.stopAllRecording();
      res.json({ ok: true });
    } catch (e: any) {
      err(`stop-all failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: pair (blocking — waits for connect result) ────────────────────
  // UI calls POST /api/cameras/pair and waits up to 18s for response
  router.post('/api/cameras/pair', (req, res) => {
    pairCamera(req, res).catch((e: any) => {
      err(`/api/cameras/pair unhandled: ${e.message}`);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    });
  });

  async function pairCamera(req: any, res: any): Promise<void> {
    const { name, ip, atemInput } = req.body as { name: string; ip: string; atemInput: number };
    if (!name || !ip || !atemInput) {
      res.status(400).json({ error: 'Required: name, ip, atemInput' }); return;
    }
    if (!isValidIpv4(ip)) {
      res.status(400).json({ error: 'Invalid IPv4 address' }); return;
    }
    const inputNum = parseAtemInput(atemInput);
    if (inputNum === null) {
      res.status(400).json({ error: 'ATEM input must be an integer from 1 to 20' }); return;
    }
    const configBeforePair = getConfig();
    const conflict = findAtemInputConflict(configBeforePair, inputNum);
    if (conflict) {
      res.status(409).json({ error: `ATEM input ${inputNum} is already used by "${conflict.name}"` }); return;
    }
    log(`Pairing camera "${name}" @ ${ip} atemInput=${atemInput}...`);

    const id  = `cam-${Date.now()}`;
    const cam = { id, name, ip, atemInput: inputNum, atemControlEnabled: true };

    // Save to config immediately
    setConfig(addCamera(getConfig(), cam));

    // Add to manager — this starts the async connect
    manager.addCamera(cam);

    // Wait for connect to succeed or fail (up to 15s)
    const client = manager.getClient(id)!;
    const result = await awaitCameraConnection(client, 15000);

    if (result.ok) {
      log(`Paired "${name}" (${ip}) successfully`);
      res.json({ ok: true, id });
    } else {
      err(`Pairing "${name}" failed: ${result.error}`);
      // Remove from config on failure
      setConfig(removeCamera(getConfig(), id));
      manager.removeCamera(id);
      res.status(503).json({ error: result.error });
    }
  }

  // ── Camera: reconnect ──────────────────────────────────────────────────────
  router.post('/api/cameras/:id/connect', (req, res) => {
    const id = req.params.id;
    log(`Reconnect requested for camera "${id}"`);
    const client = manager.getClient(id);
    const cfg = getConfig().cameras?.find((c: any) => c.id === id);
    if (!client || !cfg) { res.status(404).json({ error: 'not found' }); return; }
    if (client.state.connected) { res.json({ ok: true, msg: 'already connected' }); return; }
    reconnectCamera(manager, cfg);
    res.json({ ok: true });
  });

  // ── Camera: record toggle ──────────────────────────────────────────────────
  router.post('/api/cameras/:id/record', async (req, res) => {
    const id = req.params.id;
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    log(`REC toggle for camera "${id}" (recState=${client.state.recState})`);
    try {
      await client.toggleRecord();
      res.json({ ok: true });
    } catch (e: any) {
      err(`REC toggle failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: adjust property ────────────────────────────────────────────────
  router.post('/api/cameras/:id/adjust', async (req, res) => {
    const { param, delta } = req.body as { param: string; delta: number };
    const id = req.params.id;
    log(`Adjust cam=${id} param=${param} delta=${delta}`);
    const client = manager.getClient(id);
    const propCode = CAMERA_PROP_MAP[param];
    if (!client) { res.status(404).json({ error: 'camera not found' }); return; }
    if (!propCode) { res.status(400).json({ error: `unknown param "${param}"` }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (delta !== 1 && delta !== -1) { res.status(400).json({ error: 'delta must be 1 or -1' }); return; }
    try {
      await client.stepProp(propCode, delta);
      res.json({ ok: true });
    } catch (e: any) {
      err(`Adjust failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: push autofocus ────────────────────────────────────────────────
  router.post('/api/cameras/:id/af', async (req, res) => {
    const id = req.params.id;
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    log(`AF trigger for camera "${id}"`);
    try {
      await client.triggerAutoFocus();
      res.json({ ok: true });
    } catch (e: any) {
      err(`AF trigger failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: step color temperature ────────────────────────────────────────
  router.post('/api/cameras/:id/color-temp', async (req, res) => {
    const id = req.params.id;
    const { direction } = req.body as { direction: 1 | -1 };
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (direction !== 1 && direction !== -1) { res.status(400).json({ error: 'direction must be 1 or -1' }); return; }
    log(`Color Temp step cam="${id}" direction=${direction}`);
    try {
      await client.stepProp(CAMERA_PROP_MAP['colorTemp']!, direction);
      res.json({ ok: true });
    } catch (e: any) {
      err(`Color Temp step failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: update config ──────────────────────────────────────────────────
  router.patch('/api/cameras/:id', (req, res) => {
    const id = req.params.id;
    log(`PATCH cam=${id} body=${JSON.stringify(req.body)}`);
    let appConfig = getConfig();
    const existing = appConfig.cameras?.find((c: any) => c.id === id);
    if (!existing) { res.status(404).json({ error: 'not found' }); return; }

    const updates: Partial<CameraConfig> = {};
    if (req.body.atemControlEnabled !== undefined) {
      updates.atemControlEnabled = req.body.atemControlEnabled as boolean;
    }
    if (req.body.name !== undefined && String(req.body.name).trim()) {
      updates.name = String(req.body.name).trim();
    }
    if (req.body.ip !== undefined && String(req.body.ip).trim()) {
      const nextIp = String(req.body.ip).trim();
      if (!isValidIpv4(nextIp)) {
        res.status(400).json({ error: 'Invalid IPv4 address' }); return;
      }
      updates.ip = nextIp;
    }
    if (req.body.atemInput !== undefined) {
      const newInput = parseAtemInput(req.body.atemInput);
      if (newInput === null) {
        res.status(400).json({ error: 'ATEM input must be an integer from 1 to 20' }); return;
      }
      const conflict = findAtemInputConflict(appConfig, newInput, id);
      if (conflict) {
        appendLog(`UI PATCH CONFLICT: cam=${id} atemInput=${newInput} already used by "${conflict.name}" (${conflict.id})`);
        res.status(409).json({ error: `ATEM input ${newInput} is already used by "${conflict.name}"` }); return;
      }
      updates.atemInput = newInput;
      // Clear stale tally — mapping changed
      const clientForTally = manager.getClient(id);
      if (clientForTally) clientForTally.state.tally = 0;
    }

    // Rebuild cameras array immutably
    appConfig = {
      ...appConfig,
      cameras: appConfig.cameras.map((c: CameraConfig) => c.id === id ? { ...c, ...updates } : c),
    };
    saveConfig(appConfig);
    setConfig(appConfig);

    const updatedCfg = appConfig.cameras.find((c: CameraConfig) => c.id === id)!;

    if (updates.ip) {
      // IP changed — reconnect to new address (this also triggers onFirstPoll → ATEM sync)
      manager.removeCamera(id);
      manager.addCamera(updatedCfg);
      log(`Camera "${updatedCfg.name}" IP changed → reconnecting to ${updatedCfg.ip}`);
    } else {
      manager.updateCameraConfig(id, updates);
      // Name changed — update live state too
      if (updates.name) {
        const client = manager.getClient(id);
        if (client) client.state.name = updates.name;
      }
      // atemInput changed — push current camera state to ATEM with new input
      if (updates.atemInput) {
        const client = manager.getClient(id);
        if (client) syncCameraInputToAtem(atemListener, updates.atemInput, client);
      }
    }

    appendLog(`UI PATCH OK: cam="${updatedCfg.name}" ip=${updatedCfg.ip} atemInput=${updatedCfg.atemInput} atemControlEnabled=${updatedCfg.atemControlEnabled}`);
    res.json({ ok: true });
  });

  // ── Camera: debug diagnostics ─────────────────────────────────────────────
  // Scans the last PTP poll blob for ALL known prop codes, returns decoded
  // values plus device info, model spec capabilities, and control method for
  // each property. Only props actually present in the blob are included.
  router.get('/api/cameras/:id/debug', (req, res) => {
    const id = req.params.id;
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }

    const state = client.state;
    const spec = state.model ? getSonyModelSpec(state.model) : null;

    // ─── Decode helpers ──────────────────────────────────────────────────────
    const hex = (v: number, pad = 8) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(pad, '0');
    const decShutter = (v: number): string => {
      if (!v || v === 0xFFFFFFFF) return '—';
      const num = (v >> 16) & 0xFFFF; const den = v & 0xFFFF;
      if (!num || !den) return '—';
      if (num === 1) return `1/${den}`;
      if (den === 10) return `${(num / 10).toFixed(1)}"`;
      return `${num}/${den}`;
    };
    const decISO = (v: number): string => {
      if (!v) return '—';
      if (v === 0x00FFFFFF) return 'AUTO';
      const m = v & 0xFFFF; return m === 0xFFFF ? 'AUTO' : String(m);
    };
    const decEV = (v: number): string => {
      const ev = v / 1000; return ev === 0 ? '0 EV' : `${ev > 0 ? '+' : ''}${ev.toFixed(2)} EV`;
    };
    const enumMap = (map: Record<number, string>) => (v: number) => map[v] ?? `0x${v.toString(16).toUpperCase()}`;
    const fmtTime = (s: number) => s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : '—';
    const fmtAB = (v: number) => { const s = v > 32767 ? v - 65536 : v; return s > 0 ? `A+${s}` : s < 0 ? `B${Math.abs(s)}` : '0'; };
    const fmtGM = (v: number) => { const s = v > 32767 ? v - 65536 : v; return s > 0 ? `G+${s}` : s < 0 ? `M${Math.abs(s)}` : '0'; };

    // ─── Prop catalog ──────────────────────────────────────────────────────────
    // control: 'step' = stepProp / 'set' = setExtDeviceProp / 'btn' = controlDevice button / 'read' = read-only
    interface PropDef { name: string; cat: string; control: 'step' | 'set' | 'btn' | 'read'; decode: (v: number) => string }
    const CATALOG: Record<number, PropDef> = {
      // ─── Exposure ───
      0x500E: { name: 'Exposure Mode',        cat: 'exposure',   control: 'set',  decode: enumMap({1:'M',2:'P',3:'A',4:'S',0x8050:'Intelligent',0x8052:'Panorama',0x8060:'Movie',0x8061:'Audio Rec'}) },
      0x5007: { name: 'F-Number',             cat: 'exposure',   control: 'step', decode: v => v ? `f/${(v/100).toFixed(1)}` : '—' },
      0xD20D: { name: 'Shutter Speed',        cat: 'exposure',   control: 'step', decode: decShutter },
      0xD21E: { name: 'ISO',                  cat: 'exposure',   control: 'step', decode: decISO },
      0x5010: { name: 'EV Compensation',      cat: 'exposure',   control: 'step', decode: decEV },
      0x500B: { name: 'Metering Mode',        cat: 'exposure',   control: 'set',  decode: enumMap({1:'Average',2:'CenterWeighted',3:'MultiSpot',4:'CenterSpot',0x8001:'MultiSeg',0x8002:'Center',0x8004:'Spot',0x8006:'Highlight'}) },
      0x5013: { name: 'Drive Mode',           cat: 'exposure',   control: 'set',  decode: enumMap({1:'Single',0x8001:'Cont Hi',0x8002:'Cont Mid',0x8003:'Cont Lo',0x8004:'Timer 2s',0x8005:'Timer 10s',0x8010:'Interval'}) },
      0xD200: { name: 'Flash Compensation',   cat: 'exposure',   control: 'step', decode: decEV },
      0x500C: { name: 'Flash Mode',           cat: 'exposure',   control: 'set',  decode: enumMap({1:'Auto',2:'Off',3:'FillFlash',4:'RedEye Auto',5:'RedEye Fill'}) },
      0xD000: { name: 'T-Number',             cat: 'exposure',   control: 'read', decode: v => v ? `T/${(v/100).toFixed(1)}` : '—' },
      0xD010: { name: 'Shutter Mode',         cat: 'exposure',   control: 'read', decode: enumMap({1:'Speed',2:'Angle',3:'ECS'}) },
      0xD016: { name: 'Shutter Speed Value',  cat: 'exposure',   control: 'set',  decode: decShutter },
      0xD017: { name: 'Shutter Speed Current',cat: 'exposure',   control: 'read', decode: decShutter },
      0xD00E: { name: 'Shutter Angle',        cat: 'exposure',   control: 'set',  decode: v => v ? `${(v/100).toFixed(2)}°` : '—' },
      0xD01E: { name: 'Gain dB',              cat: 'exposure',   control: 'step', decode: v => `${(v/10).toFixed(1)} dB` },
      0xD01F: { name: 'Gain dB Current',      cat: 'exposure',   control: 'read', decode: v => `${(v/10).toFixed(1)} dB` },
      0xD022: { name: 'Exposure Index (EI)',   cat: 'exposure',   control: 'step', decode: decISO },
      0xD018: { name: 'ND Filter',            cat: 'exposure',   control: 'set',  decode: enumMap({1:'Off',2:'Auto',0x10002:'ND4 (1/4)',0x10003:'ND8 (1/8)',0x10004:'ND16 (1/16)',0x10005:'ND32 (1/32)',0x10006:'ND64 (1/64)',0x10007:'ND128 (1/128)'}) },
      0xD019: { name: 'ND Filter Mode',       cat: 'exposure',   control: 'read', decode: enumMap({1:'Manual',2:'Auto'}) },
      0xD01A: { name: 'ND Filter Mode Setting',cat:'exposure',   control: 'set',  decode: enumMap({1:'Manual',2:'Auto'}) },
      0xD01B: { name: 'ND Filter Value',      cat: 'exposure',   control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD01C: { name: 'Gain Control Setting', cat: 'exposure',   control: 'set',  decode: enumMap({1:'Manual',2:'Auto',3:'ISO'}) },
      0xD01D: { name: 'Gain Unit',            cat: 'exposure',   control: 'set',  decode: enumMap({1:'dB',2:'ISO'}) },
      0xD020: { name: 'Gain Base ISO',        cat: 'exposure',   control: 'set',  decode: v => v ? `ISO ${v}` : '—' },
      // ─── Focus ───
      0x500A: { name: 'Focus Mode',           cat: 'focus',      control: 'set',  decode: enumMap({1:'MF',2:'AF',0x8004:'DMF',0x8005:'AF-S',0x8006:'AF-C',0x8007:'AF-A'}) },
      0xD213: { name: 'AF Status',            cat: 'focus',      control: 'read', decode: enumMap({1:'Not focused',2:'Focused',3:'Tracking failed',4:'N/A'}) },
      0xD004: { name: 'Focal Distance (m)',   cat: 'focus',      control: 'read', decode: v => v ? `${(v/1000).toFixed(2)} m` : '—' },
      0xD005: { name: 'Focal Distance (ft)',  cat: 'focus',      control: 'read', decode: v => v ? `${(v/1000).toFixed(2)} ft` : '—' },
      0xD006: { name: 'Focal Distance Unit',  cat: 'focus',      control: 'set',  decode: enumMap({1:'Meter',2:'Feet'}) },
      0xD380: { name: 'Focus Position Raw',   cat: 'focus',      control: 'read', decode: v => String(v) },
      0xD381: { name: 'Focus Position %',     cat: 'focus',      control: 'read', decode: v => `${v}%` },
      0xD2D1: { name: 'MF Near/Far Step',     cat: 'focus',      control: 'step', decode: v => `step ${v}` },
      0xD007: { name: 'Focus Mode Setting',   cat: 'focus',      control: 'set',  decode: v => `0x${v.toString(16)}` },
      // ─── Color / White Balance ───
      0x5005: { name: 'White Balance',        cat: 'color',      control: 'set',  decode: enumMap({2:'Auto',4:'Daylight',0x8001:'Shade',0x8002:'Cloudy',0x8003:'Tungsten',0x8004:'Fluorescent',0x8006:'Color Temp',0x8007:'Custom1',0x8008:'Custom2',0x8009:'Custom3',0x800A:'ATW',0x800B:'ATW Lock',0x800C:'AWB Lock'}) },
      0xD20F: { name: 'Color Temperature',    cat: 'color',      control: 'step', decode: v => v ? `${v} K` : '—' },
      0xD21C: { name: 'WB Shift A/B',         cat: 'color',      control: 'set',  decode: fmtAB },
      0xD210: { name: 'WB Shift G/M',         cat: 'color',      control: 'set',  decode: fmtGM },
      0xD00C: { name: 'WB Mode (Cinema)',      cat: 'color',      control: 'set',  decode: v => `0x${v.toString(16)}` },
      0xD00D: { name: 'WB Tint',              cat: 'color',      control: 'set',  decode: v => { const s = v > 32767 ? v - 65536 : v; return s > 0 ? `+${s}` : String(s); } },
      // ─── Recording / Transport ───
      0xD21D: { name: 'Rec State',            cat: 'recording',  control: 'btn',  decode: enumMap({0:'IDLE',1:'RECORDING',2:'STANDBY',4:'PAUSED'}) },
      0xD2C8: { name: 'Movie Rec Button',     cat: 'recording',  control: 'btn',  decode: enumMap({1:'Up',2:'Down'}) },
      0xD120: { name: 'Rec Duration',         cat: 'recording',  control: 'read', decode: fmtTime },
      0xD241: { name: 'Movie File Format',    cat: 'recording',  control: 'set',  decode: enumMap({0x10001:'XAVC S 4K',0x10002:'XAVC S HD',0x20001:'XAVC HS 4K',0x20002:'XAVC HS HD',0x30001:'XAVC S-I 4K',0x30002:'XAVC S-I HD',0x40001:'AVCHD',0x50001:'XAVC I 4K',0x50002:'XAVC I HD'}) },
      0xD242: { name: 'Rec Setting',          cat: 'recording',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD286: { name: 'Rec Frame Rate',       cat: 'recording',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD024: { name: 'Rec Resolution',       cat: 'recording',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD0D2: { name: 'Audio Recording',      cat: 'recording',  control: 'set',  decode: enumMap({1:'On',2:'Off'}) },
      0xD0D3: { name: 'TC Preset',            cat: 'recording',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD0D5: { name: 'TC Format',            cat: 'recording',  control: 'set',  decode: enumMap({1:'DF',2:'NDF'}) },
      0xD0D6: { name: 'TC Run',               cat: 'recording',  control: 'set',  decode: enumMap({1:'RecRun',2:'FreeRun'}) },
      // ─── Media / Storage ───
      0xD248: { name: 'Slot1 Status',         cat: 'media',      control: 'read', decode: enumMap({0:'NoMedia',1:'Normal',2:'Error',3:'Recording',4:'FormatError'}) },
      0xD249: { name: 'Slot1 Remaining Shots',cat: 'media',      control: 'read', decode: v => `${v} shots` },
      0xD24A: { name: 'Slot1 Remaining Time', cat: 'media',      control: 'read', decode: fmtTime },
      0xD256: { name: 'Slot2 Status',         cat: 'media',      control: 'read', decode: enumMap({0:'NoMedia',1:'Normal',2:'Error',3:'Recording',4:'FormatError'}) },
      0xD257: { name: 'Slot2 Remaining Shots',cat: 'media',      control: 'read', decode: v => `${v} shots` },
      0xD258: { name: 'Slot2 Remaining Time', cat: 'media',      control: 'read', decode: fmtTime },
      0xD3C2: { name: 'Slot1 Remain (alt)',   cat: 'media',      control: 'read', decode: fmtTime },
      0xD3C4: { name: 'Slot3 Remain (alt)',   cat: 'media',      control: 'read', decode: fmtTime },
      // ─── Battery / Power ───
      0xD204: { name: 'Battery %',            cat: 'battery',    control: 'read', decode: v => `${v}%` },
      0xD205: { name: 'Battery Level Icon',   cat: 'battery',    control: 'read', decode: enumMap({0:'Empty',1:'Level1',2:'Level2',3:'Level3',4:'Full',5:'AC'}) },
      0xD218: { name: 'Battery Remain',       cat: 'battery',    control: 'read', decode: v => v > 100 ? `100% (AC)` : `${v}%` },
      0xD20E: { name: 'Battery Level (step)', cat: 'battery',    control: 'read', decode: enumMap({0:'Empty',1:'Level 1',2:'Level 2',3:'Full'}) },
      // ─── Alerts ───
      0xD251: { name: 'Overheating State',    cat: 'alerts',     control: 'read', decode: enumMap({0:'Normal',1:'Warning',2:'Error'}) },
      0xD1BB: { name: 'Camera Error Status',  cat: 'alerts',     control: 'read', decode: v => v === 0 ? 'OK' : `0x${v.toString(16).toUpperCase()}` },
      0xD1BC: { name: 'System Error Status',  cat: 'alerts',     control: 'read', decode: v => v === 0 ? 'OK' : `0x${v.toString(16).toUpperCase()}` },
      0xD07A: { name: 'System Error Info',    cat: 'alerts',     control: 'read', decode: v => v === 0 ? 'OK' : `0x${v.toString(16).toUpperCase()}` },
      // ─── Focus controls (buttons) ───
      0xD2C1: { name: 'S1 Button (Half-press)',cat: 'capture',   control: 'btn',  decode: enumMap({1:'Up',2:'Down'}) },
      0xD2C2: { name: 'S2 Button (Full-press)',cat: 'capture',   control: 'btn',  decode: enumMap({1:'Up',2:'Down'}) },
      0xD2C3: { name: 'AEL Button',           cat: 'capture',    control: 'btn',  decode: enumMap({1:'Up',2:'Down'}) },
      0xD2C4: { name: 'AFL Button',           cat: 'capture',    control: 'btn',  decode: enumMap({1:'Up',2:'Down'}) },
      // ─── Color / Image ───
      0xD23F: { name: 'Picture Profile',      cat: 'color',      control: 'set',  decode: enumMap({0:'Off',1:'PP1',2:'PP2',3:'PP3',4:'PP4',5:'PP5',6:'PP6',7:'PP7',8:'PP8',9:'PP9',10:'PP10',11:'PP11'}) },
      0xD211: { name: 'Aspect Ratio',         cat: 'color',      control: 'set',  decode: enumMap({1:'3:2',2:'16:9',3:'4:3',4:'1:1'}) },
      0xD201: { name: 'DRO / D-Lighting',     cat: 'color',      control: 'set',  decode: enumMap({0:'Off',1:'Auto',0x11:'Lv1',0x12:'Lv2',0x13:'Lv3',0x14:'Lv4',0x15:'Lv5'}) },
      0xD22C: { name: 'Focus Area',           cat: 'color',      control: 'set',  decode: enumMap({1:'Wide',2:'Zone',3:'Center',4:'Flex-S',5:'Flex-M',6:'Flex-L',7:'Expand Flex',8:'Track Wide',9:'Track Zone',10:'Track Center'}) },
      0xD21B: { name: 'Picture Effect',       cat: 'color',      control: 'set',  decode: enumMap({0x8000:'Off',0x8001:'ToyCamera',0x8002:'PopColor',0x8003:'Poster',0x8004:'Retro',0x8007:'HiContrastMono',0x800A:'RichtoneMono'}) },
      // ─── System / Status ───
      0xD217: { name: 'AE Lock',              cat: 'system',     control: 'read', decode: enumMap({0:'Unlocked',1:'Locked'}) },
      0xD21F: { name: 'FE Lock',              cat: 'system',     control: 'read', decode: enumMap({0:'Unlocked',1:'Locked'}) },
      0xD235: { name: 'NearFar Enable',       cat: 'system',     control: 'read', decode: enumMap({0:'Disabled',1:'Enabled'}) },
      0xD221: { name: 'Live View Status',     cat: 'system',     control: 'read', decode: enumMap({0:'Disabled',1:'Enabled'}) },
      0xD07B: { name: 'Lens Model',           cat: 'system',     control: 'read', decode: v => `0x${v.toString(16).toUpperCase()}` },
      // ─── Streaming (PTP3 v1.2 — ZV-E10 II) ───
      0xD450: { name: 'Stream Setting',       cat: 'streaming',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD451: { name: 'Stream Resolution',    cat: 'streaming',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD452: { name: 'Stream Framerate',     cat: 'streaming',  control: 'set',  decode: v => `${v}` },
      0xD453: { name: 'Stream Codec',         cat: 'streaming',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD454: { name: 'Stream Quality',       cat: 'streaming',  control: 'set',  decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD455: { name: 'Stream URL',           cat: 'streaming',  control: 'read', decode: v => `0x${v.toString(16).toUpperCase()}` },
      0xD456: { name: 'Stream State',         cat: 'streaming',  control: 'read', decode: enumMap({0:'Stopped',1:'Running',2:'Error'}) },
      0xD511: { name: 'Stream Status',        cat: 'streaming',  control: 'read', decode: v => `0x${v.toString(16).toUpperCase()}` },
    };

    // ─── Scan all known props from the last poll blob ─────────────────────────
    const found: Array<{
      code: string; name: string; cat: string; control: string;
      rawVal: number; hexVal: string; decoded: string; enumCount: number;
    }> = [];

    for (const [codeStr, def] of Object.entries(CATALOG)) {
      const code = Number(codeStr);  // Object.entries returns decimal string for numeric keys
      const [val, list] = client.scanProp(code);
      if (val === null) continue;  // not present in this camera's blob

      const decoded = (() => {
        try { return def.decode(val); }
        catch { return `0x${val.toString(16).toUpperCase()}`; }
      })();

      found.push({
        code: `0x${code.toString(16).toUpperCase().padStart(4,'0')}`,
        name: def.name,
        cat: def.cat,
        control: def.control,
        rawVal: val,
        hexVal: hex(val, val > 0xFFFF ? 8 : 4),
        decoded,
        enumCount: list.length,
      });
    }

    res.json({
      id: state.id,
      name: state.name,
      ip: state.ip,
      model:        state.model      ?? null,
      manufacturer: client.deviceManufacturer || null,
      firmware:     client.deviceFirmware     || null,
      serial:       client.deviceSerial       || null,
      connected:    state.connected,
      hasPollBlob:  client.lastPollBlob !== null,
      spec: spec ?? null,
      props: found,
    });
  });

  // ── Camera: delete ─────────────────────────────────────────────────────────
  router.delete('/api/cameras/:id', (req, res) => {
    const id = req.params.id;
    log(`DELETE cam=${id}`);
    manager.removeCamera(id);
    setConfig(removeCamera(getConfig(), id));
    res.json({ ok: true });
  });

  return router;
}
