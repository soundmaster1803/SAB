/**
 * api/routes/atem.ts
 *
 * ATEM switcher control endpoints.
 *
 * Routes:
 *   POST  /api/atem/connect    — connect to an ATEM switcher by IP
 *   POST  /api/atem/disconnect — disconnect from the current ATEM switcher
 *   PATCH /api/atem/settings   — toggle auto-reconnect flag
 *   GET   /api/atem/discover   — mDNS scan for ATEM switchers on the LAN
 */

import { Router } from 'express';
import type { ATEMListener } from '../../atem/listener';
import type { AppConfig } from '../../config';
import { saveConfig } from '../../config';
import { discoverAtems } from '../../atem/discovery';
import { addAtemFavorite, removeAtemFavorite } from '../../config';

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
    const appConfig = getConfig();
    appConfig.atemIp = '';
    saveConfig(appConfig);
    setConfig(appConfig);
    res.json({ ok: true });
  });

  // ── ATEM: settings (auto-reconnect toggle) ────────────────────────────────
  router.patch('/api/atem/settings', (req, res) => {
    const { autoReconnect } = req.body as { autoReconnect?: boolean };
    if (typeof autoReconnect !== 'boolean') {
      res.status(400).json({ error: 'autoReconnect (boolean) required' }); return;
    }
    const appConfig = getConfig();
    appConfig.atemAutoReconnect = autoReconnect;
    saveConfig(appConfig);
    setConfig(appConfig);
    log(`ATEM auto-reconnect set to ${autoReconnect}`);
    res.json({ ok: true });
  });

  // ── ATEM: discover (mDNS scan) ────────────────────────────────────────────
  router.get('/api/atem/discover', async (req, res) => {
    const raw = parseInt(String(req.query.timeout ?? '3000'), 10);
    const timeout = Math.min(10000, Math.max(500, Number.isFinite(raw) ? raw : 3000));
    log(`ATEM discover (mDNS, ${timeout}ms)`);
    try {
      const found = await discoverAtems(timeout);
      log(`ATEM discover → ${found.length} device(s)`);
      res.json({ ok: true, found });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      log(`ATEM discover failed: ${msg}`);
      res.status(500).json({ ok: false, error: msg, found: [] });
    }
  });

  // ── ATEM: favorites ───────────────────────────────────────────────────────
  router.get('/api/atem/favorites', (req, res) => {
    const config = getConfig();
    res.json({ ok: true, favorites: config.atemFavorites || [] });
  });

  router.post('/api/atem/favorites', (req, res) => {
    const { ip, name, model } = req.body as { ip: string; name?: string; model?: string };
    if (!ip) { res.status(400).json({ error: 'Required: ip' }); return; }
    addAtemFavorite(ip, name, model);
    log(`ATEM favorite added: ${ip}`);
    res.json({ ok: true });
  });

  router.delete('/api/atem/favorites/:ip', (req, res) => {
    const ip = req.params.ip;
    removeAtemFavorite(ip);
    log(`ATEM favorite removed: ${ip}`);
    res.json({ ok: true });
  });

  return router;
}
