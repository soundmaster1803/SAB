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
 *   POST   /api/cameras/:id/rec-settings — set slot, file format, recording mode
 *   POST   /api/cameras/:id/format-media — format a media slot (full or quick)
 *   POST   /api/cameras/:id/adjust       — step a camera property (iso/iris/shutter/etc.)
 *   POST   /api/cameras/:id/af           — trigger autofocus
 *   POST   /api/cameras/:id/focus-position — set absolute focus position (0-100%)
 *   POST   /api/cameras/:id/focus-mode  — set focus mode (MF/AF-S/AF-C/AF-A/DMF/PF)
 *   POST   /api/cameras/:id/focus-step  — single focus step near or far
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
import { buildSonyDebugPayload } from '../services/sony-debug';
import { serializeRuntimeModel } from '../../sony/runtime/builder.js';
import { getPollSummary } from '../../sony/polling/strategy.js';

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

  // ── Camera: disconnect & delete all ───────────────────────────────────────
  router.post('/api/cameras/delete-all', (_req, res) => {
    const cfg = getConfig();
    const ids = (cfg.cameras ?? []).map(c => c.id);
    log(`DELETE ALL — removing ${ids.length} camera(s)`);
    let next = cfg;
    for (const id of ids) {
      manager.removeCamera(id);
      next = removeCamera(next, id);
    }
    setConfig(next);
    res.json({ ok: true, removed: ids.length });
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

  // ── Camera: set recording settings ────────────────────────────────────────
  // Accepts { recMedia?, movieFileFormat?, recFrameRate?, recSetting? } — all optional numeric values.
  router.post('/api/cameras/:id/rec-settings', async (req, res) => {
    const id = req.params.id;
    const body = req.body as Record<string, unknown>;
    const recMedia        = typeof body.recMedia        === 'number' ? body.recMedia        : undefined;
    const movieFileFormat = typeof body.movieFileFormat === 'number' ? body.movieFileFormat : undefined;
    const recFrameRate    = typeof body.recFrameRate    === 'number' ? body.recFrameRate    : undefined;
    const recSetting      = typeof body.recSetting      === 'number' ? body.recSetting      : undefined;
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (client.state.recState === 1) {
      res.status(409).json({ error: 'cannot change recording settings while recording' }); return;
    }
    log(`REC settings cam="${id}" media=${recMedia} format=${movieFileFormat} fps=${recFrameRate} setting=${recSetting}`);
    const recOpts: { recMedia?: number; movieFileFormat?: number; recFrameRate?: number; recSetting?: number } = {};
    if (recMedia !== undefined)        recOpts.recMedia = recMedia;
    if (movieFileFormat !== undefined) recOpts.movieFileFormat = movieFileFormat;
    if (recFrameRate !== undefined)    recOpts.recFrameRate = recFrameRate;
    if (recSetting !== undefined)      recOpts.recSetting = recSetting;
    try {
      await client.setRecordingSettings(recOpts);
      res.json({ ok: true });
    } catch (e: any) {
      err(`REC settings failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: format media slot ─────────────────────────────────────────────
  // Accepts { slot: 1 | 2, type: "full" | "quick" }.
  // Rejected while recording. Irreversible — frontend must confirm before calling.
  router.post('/api/cameras/:id/format-media', async (req, res) => {
    const id = req.params.id;
    const body = req.body as Record<string, unknown>;
    const slot = body.slot as unknown;
    const type = body.type as unknown;
    if (slot !== 1 && slot !== 2) {
      res.status(400).json({ error: 'slot must be 1 or 2' }); return;
    }
    if (type !== 'full' && type !== 'quick') {
      res.status(400).json({ error: 'type must be "full" or "quick"' }); return;
    }
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (client.state.recState === 1) {
      res.status(409).json({ error: 'cannot format while recording' }); return;
    }
    log(`Format media cam="${id}" slot=${slot} type=${type}`);
    try {
      await client.formatMedia(slot as 1 | 2, type as 'full' | 'quick');
      res.json({ ok: true });
    } catch (e: any) {
      err(`Format media failed: ${e.message}`);
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

  // ── Camera: set absolute focus position (0-100%) ─────────────────────────
  // Accepts { position: 0-100 }. Converts to 0x0000–0xFFFF for prop 0xE042.
  // Camera must be in MF or DMF mode; AF cameras will reject the command.
  router.post('/api/cameras/:id/focus-position', async (req, res) => {
    const id = req.params.id;
    const { position } = req.body as { position: number };
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (typeof position !== 'number' || position < 0 || position > 100) {
      res.status(400).json({ error: 'position must be a number 0–100' }); return;
    }
    if (client.state.focusMode !== 0x0001 && client.state.focusMode !== 0x8006) {
      res.status(400).json({ error: 'Camera must be in MF or DMF focus mode' }); return;
    }
    if (!client.runtimeModel?.capabilities.hasFocusPosition) {
      res.status(400).json({ error: 'Camera does not support focus position control' }); return;
    }
    const raw = Math.round((position / 100) * 0xFFFF);
    log(`Focus position cam="${id}" pct=${position} raw=0x${raw.toString(16)}`);
    try {
      await client.setFocusPositionAbsolute(raw);
      res.json({ ok: true });
    } catch (e: any) {
      err(`Focus position failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: set focus mode ────────────────────────────────────────────────
  // Accepts { mode: "MF" | "AF-S" | "AF-C" | "AF-A" | "DMF" | "PF" }
  router.post('/api/cameras/:id/focus-mode', async (req, res) => {
    const id = req.params.id;
    const { mode } = req.body as { mode: string };
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    const FOCUS_MODE_MAP: Record<string, number> = {
      'MF':   0x0001,
      'AF-S': 0x0002,
      'AF-C': 0x8004,
      'AF-A': 0x8005,
      'DMF':  0x8006,
      'PF':   0x8009,
    };
    const modeVal = FOCUS_MODE_MAP[mode];
    if (modeVal === undefined) {
      res.status(400).json({ error: `unknown focus mode "${mode}"; valid: MF, AF-S, AF-C, AF-A, DMF, PF` }); return;
    }
    log(`Focus mode cam="${id}" mode=${mode} (0x${modeVal.toString(16)})`);
    try {
      await client.setFocusMode(modeVal);
      res.json({ ok: true });
    } catch (e: any) {
      err(`Focus mode failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: single focus step ─────────────────────────────────────────────
  // Accepts { direction: "near" | "far" }. Steps focus one increment.
  router.post('/api/cameras/:id/focus-step', async (req, res) => {
    const id = req.params.id;
    const { direction } = req.body as { direction: string };
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (direction !== 'near' && direction !== 'far') {
      res.status(400).json({ error: 'direction must be "near" or "far"' }); return;
    }
    log(`Focus step cam="${id}" direction=${direction}`);
    try {
      if (direction === 'near') {
        await client.stepFocusNear();
      } else {
        await client.stepFocusFar();
      }
      res.json({ ok: true });
    } catch (e: any) {
      err(`Focus step failed: ${e.message}`);
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
  router.get('/api/cameras/:id/debug', (req, res) => {
    const id = req.params.id;
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    res.json(buildSonyDebugPayload(client));
  });

  // ── Camera: runtime model (live-discovered capability) ────────────────────
  // Returns the full runtime camera model built from live device data.
  // knownProps: enriched props with protocol knowledge
  // unknownProps: props the camera exposed but that are not yet in the knowledge layer
  // capabilities: derived boolean flags from observed props
  // pollTiers: which props are assigned to which poll priority
  router.get('/api/cameras/:id/runtime-model', (req, res) => {
    const id = req.params.id;
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.runtimeModel) {
      res.status(503).json({
        error: 'Runtime model not yet built — camera must be connected and polled at least once',
        connected: client.state.connected,
      });
      return;
    }
    const model = client.runtimeModel;
    const pollSummary = getPollSummary(model);
    res.json({
      ...serializeRuntimeModel(model),
      pollSummary,
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
