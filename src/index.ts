// Identify this process immediately — helps detect zombie/duplicate instances
console.log(`[SYSTEM] Starting SAB (PID: ${process.pid})`);

// Global crash guards — prevent Node 20 from exiting on unhandled rejections
process.on('uncaughtException', (err) => {
  console.error(`[FATAL] uncaughtException: ${err.message}`);
  if (err.stack) console.error(err.stack);
  // Don't exit — keep server running for diagnostics
});
process.on('unhandledRejection', (reason: any) => {
  console.error(`[FATAL] unhandledRejection: ${reason?.message ?? reason}`);
  if (reason?.stack) console.error(reason.stack);
});

import { loadConfig } from './config';
import { CameraManager } from './sony/manager';
import { ATEMListener } from './atem/listener';
import { startServer } from './api/server';
import { initLogger, appendLog } from './logger';
import { wireBridgeRuntime } from './bridge/runtime';
import { APP_VERSION } from './version';
function ts(): string { return new Date().toISOString().slice(11, 23); }
async function main(): Promise<void> {
  initLogger();
  appendLog('═══ SAB starting ═══');
  console.log(`[${ts()}] ═══ SAB starting ═══`);
  console.log(`[${ts()}] SAB version: ${APP_VERSION}`);

  const appConfig = loadConfig();
  console.log(`[${ts()}] Config: atemIp="${appConfig.atemIp}" cameras=${appConfig.cameras.length}`);
  if (appConfig.cameras.length === 0) {
    console.warn(`[${ts()}] WARNING: No cameras in config.json. Add cameras via POST /api/cameras`);
  }
  appConfig.cameras.forEach(c => {
    console.log(`[${ts()}]   → "${c.name}" id=${c.id} ip=${c.ip} atemInput=${c.atemInput} control=${c.atemControlEnabled}`);
  });

  const manager = new CameraManager();
  const autoReconnect = appConfig.atemAutoReconnect !== false;
  const atemListener = new ATEMListener(autoReconnect);
  wireBridgeRuntime(manager, atemListener);

  for (const cam of appConfig.cameras) {
    manager.addCamera(cam);
  }

  if (appConfig.atemIp && autoReconnect) {
    atemListener.connect(appConfig.atemIp);
  } else if (!appConfig.atemIp) {
    console.warn(`[${ts()}] WARN: atemIp not set in config.json`);
  } else {
    console.log(`[${ts()}] ATEM auto-reconnect disabled — skipping startup connect to ${appConfig.atemIp}`);
  }

  startServer(manager, atemListener, appConfig);

  console.log(`[${ts()}] ═══ SAB ready — http://localhost:7777 ═══`);
}

main().catch((e: any) => {
  console.error(`[FATAL] ${e.message}`);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
