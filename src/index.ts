// Identify this process immediately — helps detect zombie/duplicate instances
console.log(`[SYSTEM] Starting CineLink Bridge (PID: ${process.pid})`);

import { loadConfig } from './config';
import { CameraManager } from './sony/manager';
import { ATEMListener, type ATEMCameraControl } from './atem/listener';
import { startServer } from './api/server';
import { initLogger, appendLog } from './logger';
import {
  irisToNotch,
  isoToNotch,
  gainDbToISO,
  shutterToNotch,
  shutterUsToSpeed,
  focusToNearFar,
} from './bridge/mapper';
import { decodeSummary } from './bridge/atem-decoder';
import { PROP_CODES, SDI_CONTROL_TYPE, BUTTON } from './sony/constants';

// Track previous ATEM focus position per camera (for delta calculation)
const prevFocus = new Map<string, number>();


// Throttle: one Sony command per camera per parameter per 200 ms.
// Prevents overwhelming the camera when ATEM sends 25+ updates/sec.
const lastCmdTime = new Map<string, number>();
const CMD_THROTTLE_MS = 200;

function canSend(camId: string, param: string): boolean {
  const key = `${camId}:${param}`;
  const now  = Date.now();
  if (now - (lastCmdTime.get(key) ?? 0) < CMD_THROTTLE_MS) return false;
  lastCmdTime.set(key, now);
  return true;
}

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
  const { category, parameter, numberData, boolData } = cmd;
  const n0 = numberData[0] ?? 0;  // first numeric value (already parsed by atem-connection)
  const b0 = boolData[0] ?? false;

  try {
    switch (category) {
      // ── Category 0: Lens ────────────────────────────────────────────────
      case 0:
        switch (parameter) {
          // param 0: Focus — FLOAT (actual focus position, delta against previous)
          case 0: {
            const prev = prevFocus.get(config.id) ?? n0;
            const notch = focusToNearFar(n0, prev);
            prevFocus.set(config.id, n0);
            if (notch !== 0 && canSend(config.id, 'focus')) {
              log(`Focus "${config.name}" val=${n0.toFixed(3)} prev=${prev.toFixed(3)} notch=${notch}`);
              await client.controlDevice(PROP_CODES.NEAR_FAR, SDI_CONTROL_TYPE.NOTCH, notch, true);
            }
            break;
          }
          // param 1: AutoFocus — BOOL or INT (trigger only on press=1, not release=0)
          // ATEM may send boolData[0]=true or numberData[0]=1 depending on firmware
          case 1:
            if ((b0 || n0 === 1) && canSend(config.id, 'af')) {
              log(`[BRIDGE] ATEM Push AF Triggered for "${config.name}"`);
              await client.triggerAutoFocus();
            }
            break;
          // param 2: Iris/Aperture — FLOAT (actual f-number, e.g. 3.345 = f/3.3)
          case 2:
            if (canSend(config.id, 'iris')) {
              const fnList = client.getSupportedList(PROP_CODES.FNUMBER);
              const notch = irisToNotch(n0, state.fnumber, fnList);
              log(`Iris "${config.name}" val=${n0.toFixed(3)} fnumber=${state.fnumber} notch=${notch}`);
              if (notch !== 0) await client.stepProp(PROP_CODES.FNUMBER, notch);
            }
            break;
        }
        break;

      // ── Category 1: Video ───────────────────────────────────────────────
      case 1:
        switch (parameter) {
          // param 13: Gain — SINT8 (dB). Confirmed from hardware logs.
          // param 1 is intentionally ignored — ATEM sends it redundantly alongside param=13.
          case 13:
            if (canSend(config.id, 'iso')) {
              const targetISO = gainDbToISO(n0);
              const isoListG = client.getSupportedList(PROP_CODES.ISO);
              const notch = isoToNotch(targetISO, state.iso, isoListG);
              log(`Gain "${config.name}" db=${n0} targetISO=${targetISO} currentISO=${state.iso} notch=${notch}`);
              if (notch !== 0) await client.stepProp(PROP_CODES.ISO, notch);
            }
            break;
          // param 2: White Balance — SINT16 (Kelvin). ATEM sends absolute Kelvin, set directly.
          // Sony ColorTemp (0xD20F) has no enumeration list on FX30 — use SetExtDevicePropValue.
          case 2:
            if (canSend(config.id, 'wb')) {
              log(`WB "${config.name}" target=${n0}K (absolute set)`);
              await client.setExtDeviceProp(PROP_CODES.COLOR_TEMP, n0);
            }
            break;
          // param 5: Shutter Speed in MICROSECONDS (SINT32). Confirmed from hardware logs.
          // Example: 10000 μs → 1/100, 6667 μs → 1/150.
          case 5:
            if (canSend(config.id, 'shutter')) {
              const den5 = shutterUsToSpeed(n0);
              const shutList5 = client.getSupportedList(PROP_CODES.SHUTTER_SPEED);
              const notch5 = shutterToNotch(den5, state.shutter, shutList5);
              log(`Shutter(μs) "${config.name}" ${n0}μs → 1/${den5} current=0x${state.shutter.toString(16)} notch=${notch5}`);
              if (notch5 !== 0) await client.stepProp(PROP_CODES.SHUTTER_SPEED, notch5);
            }
            break;
          // param 14: ISO — SINT32 (direct value, e.g. 800)
          case 14:
            if (canSend(config.id, 'iso')) {
              const isoList14 = client.getSupportedList(PROP_CODES.ISO);
              const notch = isoToNotch(n0, state.iso, isoList14);
              log(`ISO "${config.name}" target=${n0} current=${state.iso} notch=${notch}`);
              if (notch !== 0) await client.stepProp(PROP_CODES.ISO, notch);
            }
            break;
        }
        break;
    }
  } catch (e: any) {
    warn(`Error cat=${category} param=${parameter} "${config.name}": ${e.message}`);
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
