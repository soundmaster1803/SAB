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
import type { CameraManager } from '../../sony/manager';
import type { ATEMListener } from '../../atem/listener';
import type { AppConfig } from '../../config';
import { listLanInterfaces } from '../services/network';
import { uiAtemState } from '../viewmodels/atem';
import { uiState } from '../viewmodels/camera';
import { APP_VERSION } from '../../version';

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
    const atem = uiAtemState(atemListener);
    res.json({
      version: APP_VERSION,
      cameras: manager.getAllStates().map(uiState),
      atemIp: appConfig.atemIp,
      atemConnected: atem.connected,
      atemModel: atem.model,
      inputCount: atem.inputCount,
      topology: atem.topology,
      tally: atem.tally,
      time: new Date().toISOString(),
    });
  });

  // ── Network interfaces ─────────────────────────────────────────────────────
  router.get('/api/interfaces', (_req, res) => {
    res.json(listLanInterfaces());
  });

  return router;
}
