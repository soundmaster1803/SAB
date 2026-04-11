// Identify this process immediately — helps detect zombie/duplicate instances
console.log(`[SYSTEM] Starting CineLink Bridge (PID: ${process.pid})`);

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
import { ATEMListener, type ATEMCameraControl } from './atem/listener';
import { startServer } from './api/server';
import { initLogger, appendLog } from './logger';
import { decodeSummary } from './bridge/atem-decoder';
import { decodeControlIntent } from './bridge/intents/decoder';
import { executeSonyIntent } from './bridge/executors/sony-command-executor';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string)  { console.log(`[${ts()}] [BRIDGE] ${msg}`); }
function warn(msg: string) { console.warn(`[${ts()}] [BRIDGE] WARN: ${msg}`); }

async function handleCameraControl(cmd: ATEMCameraControl, manager: CameraManager) {
  const decoded = decodeSummary(cmd.category, cmd.parameter, cmd.type, cmd.numberData, 25);
  // cmd.source is already 1-indexed — matches atemInput in config
  const found = manager.findByAtemInput(cmd.source);
  if (!found) return; // no camera mapped to this input — silent

  const { client, config } = found;
  if (!config.atemControlEnabled) {
    log(`Command ignored: ATEM Control Disabled for "${config.name}"`);
    return;
  }
  if (!client.state.connected) {
    warn(`"${config.name}" not connected — skipping ATEM command cat=${cmd.category} param=${cmd.parameter}`);
    return;
  }

  const state = client.getState();

  // Guard: if no poll data yet, state values (iso, shutter, fnumber) are all 0.
  // Notch calculations using 0 as "current" would produce wildly wrong deltas.
  if (state.lastUpdate === 0) {
    warn(`"${config.name}" — ignoring ATEM command before first poll (cat=${cmd.category} param=${cmd.parameter})`);
    return;
  }
  const intent = decodeControlIntent(config.id, cmd);
  if (intent === null) return;

  try {
    await executeSonyIntent(intent, { client, config, state, log });
  } catch (e: any) {
    warn(`Error cat=${cmd.category} param=${cmd.parameter} "${config.name}": ${e.message}`);
    if (e.stack) warn(e.stack);
  }
}

async function main(): Promise<void> {
  initLogger();
  appendLog('═══ CineLink Bridge starting ═══');
  console.log(`[${ts()}] ═══ CineLink Bridge starting ═══`);

  const appConfig = loadConfig();
  console.log(`[${ts()}] Config: atemIp="${appConfig.atemIp}" cameras=${appConfig.cameras.length}`);
  if (appConfig.cameras.length === 0) {
    console.warn(`[${ts()}] WARNING: No cameras in config.json. Add cameras via POST /api/cameras`);
  }
  appConfig.cameras.forEach(c => {
    console.log(`[${ts()}]   → "${c.name}" id=${c.id} ip=${c.ip} atemInput=${c.atemInput} control=${c.atemControlEnabled}`);
  });

  const manager = new CameraManager();
  const atemListener = new ATEMListener();

  // Sync camera state to ATEM on first successful poll after each connect.
  // Fires for EVERY addCamera call — including cameras added via API after startup.
  // Self-removes so it only fires once per connection.
  manager.on('cameraAdded', (client: import('./sony/ptp-client').SonyPTPClient, cfg: import('./config').CameraConfig) => {
    const onFirstPoll = () => {
      if (client.state.connected && client.state.lastUpdate > 0) {
        client.off('stateUpdate', onFirstPoll);
        log(`Syncing "${cfg.name}" state → ATEM input ${cfg.atemInput}`);
        // Use the live atemInput from manager config (may have changed via PATCH)
        const liveCfg = manager.getAllConfigs().find(c => c.id === cfg.id);
        atemListener.syncCameraStateToAtem(liveCfg?.atemInput ?? cfg.atemInput, client.state);
      }
    };
    client.on('stateUpdate', onFirstPoll);
  });

  for (const cam of appConfig.cameras) {
    manager.addCamera(cam);
  }

  if (appConfig.atemIp) {
    atemListener.connect(appConfig.atemIp);
  } else {
    console.warn(`[${ts()}] WARN: atemIp not set in config.json`);
  }

  // Tally — TallyBySourceCommand doesn't apply to atem.state, captured via tallyUpdate event
  // Use manager.getAllConfigs() — always includes cameras added after startup via API.
  atemListener.on('tallyUpdate', (tallyBySource: Record<number, { program: boolean; preview: boolean }>) => {
    for (const cam of manager.getAllConfigs()) {
      const found = manager.findByAtemInput(cam.atemInput);
      if (!found) continue;
      const { client } = found;
      const t = tallyBySource[cam.atemInput];
      const newTally = t?.program ? 1 : t?.preview ? 2 : 0;
      if (client.state.tally !== newTally) {
        log(`Tally "${cam.name}" input=${cam.atemInput}: ${client.state.tally}→${newTally}`);
        client.state.tally = newTally;
        client.emit('stateUpdate', client.state);
      }
    }
  });

  // Bridge: ATEM → Sony
  atemListener.on('cameraControl', (cmd: ATEMCameraControl) => {
    handleCameraControl(cmd, manager).catch((e: any) => {
      warn(`Unhandled: ${e.message}`);
    });
  });

  startServer(manager, atemListener, appConfig);

  console.log(`[${ts()}] ═══ CineLink Bridge ready — http://localhost:7777 ═══`);
}

main().catch((e: any) => {
  console.error(`[FATAL] ${e.message}`);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
