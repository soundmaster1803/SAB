import type { CameraManager } from '../sony/manager';
import type { SonyPTPClient } from '../sony/ptp-client';
import type { CameraConfig } from '../config';
import type { ATEMListener, ATEMCameraControl } from '../atem/listener';
import { decodeControlIntent } from './intents/decoder';
import { executeSonyIntent, clearPrevFocus } from './executors/sony-command-executor';
import { isInCooldown } from './policies/anti-loop';
import { syncCameraStateToAtem as syncStateImpl } from './sync/atem-sync';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string)  { console.log(`[${ts()}] [BRIDGE] ${msg}`); }
function warn(msg: string) { console.warn(`[${ts()}] [BRIDGE] WARN: ${msg}`); }

async function handleCameraControl(
  cmd: ATEMCameraControl,
  manager: CameraManager,
  atemListener: ATEMListener,
): Promise<void> {
  const atemState = atemListener.getRawState();
  if (Date.now() < atemState.readyAfterMs) return;
  if (isInCooldown(cmd.source)) return;

  const found = manager.findByAtemInput(cmd.source);
  if (!found) return;

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

function handleFirstPollSync(
  client: SonyPTPClient,
  cfg: CameraConfig,
  manager: CameraManager,
  atemListener: ATEMListener,
): void {
  const onFirstPoll = () => {
    if (client.state.connected && client.state.lastUpdate > 0) {
      client.off('stateUpdate', onFirstPoll);
      log(`Syncing "${cfg.name}" state → ATEM input ${cfg.atemInput}`);
      const liveCfg = manager.getAllConfigs().find(c => c.id === cfg.id);
      syncStateImpl(atemListener.atem, liveCfg?.atemInput ?? cfg.atemInput, client.state);
    }
  };
  client.on('stateUpdate', onFirstPoll);
}

function handleTallyUpdate(
  tallyBySource: Record<number, { program: boolean; preview: boolean }>,
  manager: CameraManager,
): void {
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
}

export function wireBridgeRuntime(manager: CameraManager, atemListener: ATEMListener): void {
  manager.on('cameraAdded', (client: SonyPTPClient, cfg: CameraConfig) => {
    clearPrevFocus(cfg.id);
    handleFirstPollSync(client, cfg, manager, atemListener);
  });

  atemListener.on('tallyUpdate', (tallyBySource: Record<number, { program: boolean; preview: boolean }>) => {
    handleTallyUpdate(tallyBySource, manager);
  });

  atemListener.on('cameraControl', (cmd: ATEMCameraControl) => {
    handleCameraControl(cmd, manager, atemListener).catch((e: any) => {
      warn(`Unhandled: ${e.message}`);
    });
  });
}
