/**
 * api/routes/status.ts
 *
 * Read-only status and system information endpoints.
 *
 * Routes:
 *   GET /api/status     — current camera + ATEM state snapshot
 *   GET /api/interfaces — host network interfaces (LAN only)
 */

import { Router } from 'express';
import os from 'os';
import type { CameraManager } from '../../sony/manager';
import type { ATEMListener } from '../../atem/listener';
import type { AppConfig } from '../../config';
import { uiState } from '../viewmodels/camera';
import { APP_VERSION } from '../../version';

// Exclude tunnels, virtual, and link-local interfaces; keep LAN only
const LAN_IFACE     = /^(en|eth|wlan|wlp|ens|enp|eno)\d/;
const EXCLUDE_IFACE = /^(utun|awdl|llw|bridge|vmnet|veth|lo|docker|tun|tap)/;

export interface StatusRouteDeps {
  manager: CameraManager;
  atemListener: ATEMListener;
  getConfig: () => AppConfig;
}

export function createStatusRoutes({ manager, atemListener, getConfig }: StatusRouteDeps): Router {
  const router = Router();

  // ── Status / health ────────────────────────────────────────────────────────
  router.get('/api/status', (_req, res) => {
    const appConfig = getConfig();
    res.json({
      version: APP_VERSION,
      cameras: manager.getAllStates().map(uiState),
      atemIp: appConfig.atemIp,
      atemConnected: atemListener.connected,
      time: new Date().toISOString(),
    });
  });

  // ── Network interfaces ─────────────────────────────────────────────────────
  router.get('/api/interfaces', (_req, res) => {
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

  return router;
}
