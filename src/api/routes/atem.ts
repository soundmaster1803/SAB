/**
 * api/routes/atem.ts
 *
 * ATEM switcher control endpoints.
 *
 * Routes:
 *   POST /api/atem/connect    — connect to an ATEM switcher by IP
 *   POST /api/atem/disconnect — disconnect from the current ATEM switcher
 */

import { Router } from 'express';
import type { ATEMListener } from '../../atem/listener';
import type { AppConfig } from '../../config';
import { saveConfig } from '../../config';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string) { console.log(`[${ts()}] [UI] ${msg}`); }

export interface AtemRouteDeps {
  atemListener: ATEMListener;
  getConfig: () => AppConfig;
  setConfig: (cfg: AppConfig) => void;
}

export function createAtemRoutes({ atemListener, getConfig, setConfig }: AtemRouteDeps): Router {
  const router = Router();

  // ── ATEM: connect ──────────────────────────────────────────────────────────
  router.post('/api/atem/connect', (req, res) => {
    const { ip } = req.body as { ip: string };
    if (!ip) { res.status(400).json({ error: 'Required: ip' }); return; }
    log(`ATEM connect to ${ip}`);
    const appConfig = getConfig();
    appConfig.atemIp = ip;
    saveConfig(appConfig);
    setConfig(appConfig);
    atemListener.connect(ip);
    res.json({ ok: true });
  });

  // ── ATEM: disconnect ───────────────────────────────────────────────────────
  router.post('/api/atem/disconnect', (_req, res) => {
    log('ATEM disconnect');
    atemListener.disconnect();
    res.json({ ok: true });
  });

  return router;
}
