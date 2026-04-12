import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { CameraManager } from '../sony/manager';
import type { ATEMListener } from '../atem/listener';
import type { AppConfig } from '../config';
import { appendLog } from '../logger';
import { listLanInterfaces } from './services/network';
import { createBroadcaster } from './ws/broadcaster';
import { createStatusRoutes } from './routes/status';
import { createCameraRoutes } from './routes/cameras';
import { createAtemRoutes } from './routes/atem';
import { APP_VERSION } from '../version';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string)  { console.log(`[${ts()}] [UI] ${msg}`); }
function err(msg: string)  { console.error(`[${ts()}] [UI] ERROR: ${msg}`); }


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

  // ── WebSocket broadcaster — setup + state/log broadcast ───────────────────
  // getAppConfig() is a getter so the broadcast loop always reads the live
  // appConfig reference even after route handlers reassign it.
  const wss = createBroadcaster({
    server,
    manager,
    atemListener,
    getAppConfig: () => appConfig,
    appVersion: APP_VERSION,
  });

  // ── API routes ────────────────────────────────────────────────────────────
  // Config getter/setter pair so route modules can read and reassign appConfig
  // without breaking the broadcaster's getAppConfig() closure reference.
  const getConfig = () => appConfig;
  const setConfig = (cfg: AppConfig) => { appConfig = cfg; };

  app.use(createCameraRoutes({ manager, atemListener, getConfig, setConfig }));
  app.use(createAtemRoutes({ atemListener, getConfig, setConfig }));
  app.use(createStatusRoutes({ manager, atemListener, getConfig }));

  server.listen(7777, () => {
    log(`UI ready → http://localhost:7777`);
    listLanInterfaces().forEach(({ address }) => log(`           http://${address}:7777`));
  });
  server.on('error', (e) => err(`HTTP server error: ${e.message}`));

  return { app, server, wss };
}
