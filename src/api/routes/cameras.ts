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
import { PROP_CODES } from '../../sony/constants';
import { syncCameraStateToAtem as syncStateImpl } from '../../bridge/sync/atem-sync';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string) { console.log(`[${ts()}] [UI] ${msg}`); }
function err(msg: string) { console.error(`[${ts()}] [UI] ERROR: ${msg}`); }

const CAMERA_PROP_MAP: Record<string, number> = {
  iso: PROP_CODES.ISO,
  fnumber: PROP_CODES.FNUMBER,
  shutter: PROP_CODES.SHUTTER_SPEED,
  expComp: PROP_CODES.EXP_COMP,
  colorTemp: PROP_CODES.COLOR_TEMP,
};

export interface CameraRouteDeps {
  manager: CameraManager;
  atemListener: ATEMListener;
  getConfig: () => AppConfig;
  setConfig: (cfg: AppConfig) => void;
}

function isValidIpv4(value: string): boolean {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function hasAtemInputConflict(config: AppConfig, atemInput: number, excludeId?: string): CameraConfig | undefined {
  return config.cameras.find(c => c.atemInput === atemInput && c.id !== excludeId);
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
    const inputNum = Number(atemInput);
    if (!Number.isInteger(inputNum) || inputNum < 1 || inputNum > 20) {
      res.status(400).json({ error: 'ATEM input must be an integer from 1 to 20' }); return;
    }
    const configBeforePair = getConfig();
    const conflict = hasAtemInputConflict(configBeforePair, inputNum);
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
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      let settled = false;
      let poll: ReturnType<typeof setInterval> | null = null;
      const finish = (value: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (poll) clearInterval(poll);
        client.off('stateUpdate', onUpdate);
        resolve(value);
      };
      const timer = setTimeout(() => finish({ ok: false, error: 'Connection timeout (15s). Check camera IP and PTP/IP mode.' }), 15000);

      const onUpdate = () => {
        if (client.state.connected) {
          finish({ ok: true });
        }
      };
      client.on('stateUpdate', onUpdate);

      // Also catch immediate connection error via polling
      poll = setInterval(() => {
        if (client.state.connected) {
          finish({ ok: true });
        }
      }, 200);
    });

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
    // Remove and re-add so a fresh SonyPTPClient is created with a clean state.
    // addCamera(cfg) would create a second client for the same id without removeCamera first.
    manager.removeCamera(id);
    manager.addCamera(cfg);
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
      const newInput = Number(req.body.atemInput);
      if (!Number.isInteger(newInput) || newInput < 1 || newInput > 20) {
        res.status(400).json({ error: 'ATEM input must be an integer from 1 to 20' }); return;
      }
      const conflict = hasAtemInputConflict(appConfig, newInput, id);
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
        if (client?.state.connected && client.state.lastUpdate > 0) {
          syncStateImpl(atemListener.atem, updates.atemInput, client.state);
        }
      }
    }

    appendLog(`UI PATCH OK: cam="${updatedCfg.name}" ip=${updatedCfg.ip} atemInput=${updatedCfg.atemInput} atemControlEnabled=${updatedCfg.atemControlEnabled}`);
    res.json({ ok: true });
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
