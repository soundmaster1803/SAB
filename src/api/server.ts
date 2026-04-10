import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { CameraManager } from '../sony/manager';
import type { ATEMListener } from '../atem/listener';
import { saveConfig, addCamera, removeCamera, type AppConfig, type CameraConfig } from '../config';
import { appendLog, logBus } from '../logger';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string)  { console.log(`[${ts()}] [UI] ${msg}`); }
function err(msg: string)  { console.error(`[${ts()}] [UI] ERROR: ${msg}`); }

// Read app version from package.json — works in both ESM dev and CJS bundle
let APP_VERSION = '1.0.0';
try {
  const d = path.dirname(fileURLToPath(import.meta.url));
  APP_VERSION = JSON.parse(fs.readFileSync(path.join(d, '../../package.json'), 'utf-8')).version ?? APP_VERSION;
} catch {
  try {
    APP_VERSION = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[1] ?? ''), '../package.json'), 'utf-8')).version ?? APP_VERSION;
  } catch {}
}

const PROP_MAP: Record<string, number> = {
  iso:       0xD21E,
  fnumber:   0x5007,
  shutter:   0xD20D,
  expComp:   0x5010,
  colorTemp: 0xD20F,
};

// Decode Sony raw shutter UINT32 → "1/100" string (from ref-sony.md)
function decodeShutter(raw: number): string {
  if (!raw || raw === 0xFFFFFFFF) return '—';
  const num = (raw >> 16) & 0xFFFF;
  const den = raw & 0xFFFF;
  if (num === 0 || den === 0) return '—';
  if (num === 1) return `1/${den}`;
  if (den === 10) return `${(num / 10).toFixed(1)}"`;
  return `${num}/${den}`;
}

// Decode Sony ISO raw value → display string
function decodeISO(raw: number): string {
  if (!raw) return '—';
  if (raw === 0x00FFFFFF) return 'AUTO';
  const masked = raw & 0xFFFF;
  if (masked === 0xFFFF) return 'AUTO'; // safety: unmasked AUTO slipped through
  return String(masked);
}

// Transform camera state for the UI (decode raw values → readable strings)
function uiState(cam: ReturnType<CameraManager['getAllStates']>[number]) {
  return {
    ...cam,
    shutter: decodeShutter(cam.shutter), // "1/100" instead of raw UINT32
    iso: decodeISO(cam.iso),             // "AUTO" or numeric string
  };
}

export function startServer(manager: CameraManager, atemListener: ATEMListener, appConfig: AppConfig) {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());
  // Serve UI — prefer public/ next to bridge.cjs, fall back to cwd (dev mode)
  const scriptDir = path.dirname(process.argv[1] ?? '');
  const publicFromScript = path.join(scriptDir, 'public');
  const publicFromCwd = path.join(process.cwd(), 'public');
  const publicDir = fs.existsSync(publicFromScript) ? publicFromScript : publicFromCwd;
  app.use(express.static(publicDir));

  // Log every mutating API request to file (with >> prefix so they stand out)
  app.use((req, _res, next) => {
    if (req.method === 'PATCH' || req.method === 'POST' || req.method === 'DELETE') {
      appendLog(`UI ${req.method} ${req.path} ${JSON.stringify(req.body ?? {})}`);
    }
    next();
  });

  // ── WebSocket — shares port 7777 with HTTP ─────────────────────────────────
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    log(`WS client connected from ${req.socket.remoteAddress}`);
    ws.on('close', () => log('WS client disconnected'));
    ws.on('error', (e) => err(`WS client error: ${e.message}`));
  });
  wss.on('error', (e) => err(`WebSocketServer error: ${e.message}`));

  // Batch log broadcasts — prevents flooding WS clients at 25+ msg/sec during active ATEM control.
  // Flushes every 150ms; if no clients are connected the batch is simply discarded.
  let _logBatch: Array<{ category: string; text: string; timestamp: string }> = [];
  let _logTimer: ReturnType<typeof setTimeout> | null = null;

  logBus.on('log', (entry: { category: string; text: string; timestamp: string }) => {
    _logBatch.push(entry);
    if (!_logTimer) {
      _logTimer = setTimeout(() => {
        if (_logBatch.length > 0 && wss.clients.size > 0) {
          const msg = JSON.stringify({ type: 'logs', entries: _logBatch });
          wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
        }
        _logBatch = [];
        _logTimer = null;
      }, 150);
    }
  });

  setInterval(() => {
    // Camera inputs only (1–20). ATEM also exposes virtual inputs like 9910
    // (media players) whose tally would shift the array index and light the
    // wrong numbered button in the UI.
    const inputIds = Object.keys(atemListener.atem.state?.inputs ?? {})
      .map(Number).filter(n => n >= 1 && n <= 20).sort((a, b) => a - b);
    const tally = inputIds.map(id => {
      const t = atemListener.tallyBySource[id];
      return t?.program ? 1 : t?.preview ? 2 : 0;
    });

    // O(1) per camera — build lookup map once per broadcast instead of O(n²) find()
    const cfgMap = new Map<string, any>(appConfig.cameras?.map((c: any) => [c.id, c]) ?? []);

    const msg = JSON.stringify({
      type: 'state',
      version: APP_VERSION,
      cameras: manager.getAllStates().map(state => {
        const cfg = cfgMap.get(state.id);
        return { ...uiState(state), atemInput: cfg?.atemInput ?? 0, atemControlEnabled: cfg?.atemControlEnabled ?? false };
      }),
      atemIp: appConfig.atemIp,
      atemConnected: atemListener.connected,
      atemModel: atemListener.atemModel,
      inputCount: atemListener.inputCount,
      tally,
      topology: inputIds,
    });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
  }, 500);

  // ── Camera: global record start / stop ────────────────────────────────────
  app.post('/api/cameras/rec-all', async (_req, res) => {
    log('REC ALL — starting recording on all idle connected cameras');
    try {
      await manager.startAllRecording();
      res.json({ ok: true });
    } catch (e: any) {
      err(`rec-all failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/cameras/stop-all', async (_req, res) => {
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
  app.post('/api/cameras/pair', (req, res) => {
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
    log(`Pairing camera "${name}" @ ${ip} atemInput=${atemInput}...`);

    const id  = `cam-${Date.now()}`;
    const cam = { id, name, ip, atemInput: Number(atemInput), atemControlEnabled: true };

    // Save to config immediately
    appConfig = addCamera(appConfig, cam);

    // Add to manager — this starts the async connect
    manager.addCamera(cam);

    // Wait for connect to succeed or fail (up to 15s)
    const client = manager.getClient(id)!;
    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'Connection timeout (15s). Check camera IP and PTP/IP mode.' }), 15000);

      const onUpdate = () => {
        if (client.state.connected) {
          clearTimeout(timer);
          client.off('stateUpdate', onUpdate);
          resolve({ ok: true });
        }
      };
      client.on('stateUpdate', onUpdate);

      // Also catch immediate connection error via polling
      const poll = setInterval(() => {
        if (client.state.connected) {
          clearTimeout(timer);
          clearInterval(poll);
          client.off('stateUpdate', onUpdate);
          resolve({ ok: true });
        }
      }, 200);

      setTimeout(() => clearInterval(poll), 15000);
    });

    if (result.ok) {
      log(`Paired "${name}" (${ip}) successfully`);
      res.json({ ok: true, id });
    } else {
      err(`Pairing "${name}" failed: ${result.error}`);
      // Remove from config on failure
      appConfig = removeCamera(appConfig, id);
      manager.removeCamera(id);
      res.status(503).json({ error: result.error });
    }
  }

  // ── Camera: reconnect ──────────────────────────────────────────────────────
  app.post('/api/cameras/:id/connect', (req, res) => {
    const id = req.params.id;
    log(`Reconnect requested for camera "${id}"`);
    const client = manager.getClient(id);
    const cfg = appConfig.cameras?.find((c: any) => c.id === id);
    if (!client || !cfg) { res.status(404).json({ error: 'not found' }); return; }
    if (client.state.connected) { res.json({ ok: true, msg: 'already connected' }); return; }
    // Remove and re-add so a fresh SonyPTPClient is created with a clean state.
    // addCamera(cfg) would create a second client for the same id without removeCamera first.
    manager.removeCamera(id);
    manager.addCamera(cfg);
    res.json({ ok: true });
  });

  // ── Camera: record toggle ──────────────────────────────────────────────────
  app.post('/api/cameras/:id/record', async (req, res) => {
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
  app.post('/api/cameras/:id/adjust', async (req, res) => {
    const { param, delta } = req.body as { param: string; delta: number };
    const id = req.params.id;
    log(`Adjust cam=${id} param=${param} delta=${delta}`);
    const client = manager.getClient(id);
    const propCode = PROP_MAP[param];
    if (!client) { res.status(404).json({ error: 'camera not found' }); return; }
    if (!propCode) { res.status(400).json({ error: `unknown param "${param}"` }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    try {
      await client.stepProp(propCode, delta > 0 ? 1 : -1);
      res.json({ ok: true });
    } catch (e: any) {
      err(`Adjust failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: push autofocus ────────────────────────────────────────────────
  app.post('/api/cameras/:id/af', async (req, res) => {
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
  app.post('/api/cameras/:id/color-temp', async (req, res) => {
    const id = req.params.id;
    const { direction } = req.body as { direction: 1 | -1 };
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }
    if (direction !== 1 && direction !== -1) { res.status(400).json({ error: 'direction must be 1 or -1' }); return; }
    log(`Color Temp step cam="${id}" direction=${direction}`);
    try {
      await client.stepProp(PROP_MAP['colorTemp']!, direction);
      res.json({ ok: true });
    } catch (e: any) {
      err(`Color Temp step failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Camera: update config ──────────────────────────────────────────────────
  app.patch('/api/cameras/:id', (req, res) => {
    const id = req.params.id;
    log(`PATCH cam=${id} body=${JSON.stringify(req.body)}`);
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
      updates.ip = String(req.body.ip).trim();
    }
    if (req.body.atemInput !== undefined) {
      const newInput = Number(req.body.atemInput);
      const conflict = appConfig.cameras?.find((c: any) => c.atemInput === newInput && c.id !== id);
      if (conflict) {
        appendLog(`UI PATCH CONFLICT: cam=${id} atemInput=${newInput} already used by "${conflict.name}" (${conflict.id})`);
        res.status(409).json({ error: 'ID already in use' }); return;
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
          atemListener.syncCameraStateToAtem(updates.atemInput, client.state);
        }
      }
    }

    appendLog(`UI PATCH OK: cam="${updatedCfg.name}" ip=${updatedCfg.ip} atemInput=${updatedCfg.atemInput} atemControlEnabled=${updatedCfg.atemControlEnabled}`);
    res.json({ ok: true });
  });

  // ── Camera: delete ─────────────────────────────────────────────────────────
  app.delete('/api/cameras/:id', (req, res) => {
    const id = req.params.id;
    log(`DELETE cam=${id}`);
    manager.removeCamera(id);
    appConfig = removeCamera(appConfig, id);
    res.json({ ok: true });
  });

  // ── ATEM: connect / disconnect ─────────────────────────────────────────────
  app.post('/api/atem/connect', (req, res) => {
    const { ip } = req.body as { ip: string };
    if (!ip) { res.status(400).json({ error: 'Required: ip' }); return; }
    log(`ATEM connect to ${ip}`);
    appConfig.atemIp = ip;
    saveConfig(appConfig);
    atemListener.connect(ip);
    res.json({ ok: true });
  });

  app.post('/api/atem/disconnect', (req, res) => {
    log('ATEM disconnect');
    atemListener.disconnect();
    res.json({ ok: true });
  });

  // ── Status / health ────────────────────────────────────────────────────────
  app.get('/api/status', (_req, res) => {
    res.json({
      cameras: manager.getAllStates().map(uiState),
      atemIp: appConfig.atemIp,
      atemConnected: atemListener.connected,
      time: new Date().toISOString(),
    });
  });

  // ── Network interfaces ─────────────────────────────────────────────────────
  // Exclude tunnels, virtual, and link-local interfaces; keep LAN only
  const LAN_IFACE = /^(en|eth|wlan|wlp|ens|enp|eno)\d/;
  const EXCLUDE_IFACE = /^(utun|awdl|llw|bridge|vmnet|veth|lo|docker|tun|tap)/;

  app.get('/api/interfaces', (_req, res) => {
    const ifaces = os.networkInterfaces();
    const result: { name: string; address: string }[] = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (EXCLUDE_IFACE.test(name)) continue;
      for (const addr of addrs ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) {
          result.push({ name, address: addr.address });
        }
      }
    }
    res.json(result);
  });

  server.listen(7777, () => {
    const ifaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const addrs of Object.values(ifaces)) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
      }
    }
    log(`UI ready → http://localhost:7777`);
    ips.forEach(ip => log(`           http://${ip}:7777`));
  });
  server.on('error', (e) => err(`HTTP server error: ${e.message}`));

  return { app, server, wss };
}
