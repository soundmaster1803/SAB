/**
 * bridge/executors/sony-command-executor.ts
 *
 * Dispatches a normalized ControlIntent to the appropriate Sony PTP command.
 *
 * Responsibilities:
 *   - Throttle check (canSend) per property
 *   - ATEM-value → Sony-value conversion (via mapper)
 *   - Sony PTP command invocation (via SonyPTPClient methods)
 *   - prevFocus tracking (bridge delta state, private to this module)
 *
 * Does not own:
 *   - ATEM command decoding (bridge/intents/decoder)
 *   - Throttle policy definition (bridge/policies/throttle)
 *   - Sony transport (sony/ptp-client)
 *   - Mapper conversion logic (bridge/mapper)
 */

import type { ControlIntent } from '../intents/types';
import type { SonyPTPClient, CameraState } from '../../sony/ptp-client';
import type { RuntimeCapabilities } from '../../sony/runtime/types';
import { PROP_CODES, SDI_CONTROL_TYPE } from '../../sony/constants';
import {
  irisToNotch,
  isoToNotch,
  shutterToNotch,
  shutterUsToSpeed,
  focusToNearFar,
} from '../mapper';
import { canSend } from '../policies/throttle';

/**
 * Return true if the camera's runtime model confirms the given capability.
 * Passes through (returns true) when the runtime model is not yet built —
 * blocking commands before the first poll would prevent cold-start operation.
 */
function hasCapability(client: SonyPTPClient, flag: keyof RuntimeCapabilities): boolean {
  if (!client.runtimeModel) return true; // model not built yet — allow
  return client.runtimeModel.capabilities[flag];
}

// Track previous ATEM focus position per camera (for delta calculation).
const prevFocus = new Map<string, number>();

/**
 * Clear the stored focus position for a camera.
 * Call this when a camera reconnects (addCamera) so the first focus delta
 * after reconnect is computed from the current ATEM value, not a stale one.
 */
export function clearPrevFocus(cameraId: string): void {
  prevFocus.delete(cameraId);
}

export interface SonyExecutorContext {
  /** Connected Sony PTP client for the target camera. */
  client: SonyPTPClient;
  /** Minimal camera config fields needed for throttle key and log messages. */
  config: { id: string; name: string };
  /** Live camera state snapshot taken immediately before dispatch. */
  state: CameraState;
  /** Logger bound to the bridge prefix. */
  log: (msg: string) => void;
}

/**
 * Execute a ControlIntent against the target Sony camera.
 *
 * Applies throttle per property, converts values via mapper, and calls the
 * appropriate SonyPTPClient method. prevFocus is updated unconditionally on
 * focus intents so the delta tracks even when the command is throttled.
 *
 * Throws on Sony PTP errors — caller is responsible for catch/warn.
 */
export async function executeSonyIntent(
  intent: ControlIntent,
  { client, config, state, log }: SonyExecutorContext,
): Promise<void> {
  switch (intent.property) {
    // ── Focus ────────────────────────────────────────────────────────────────
    // prevFocus updated unconditionally so delta tracks across throttled frames.
    case 'focus': {
      const prev = prevFocus.get(config.id) ?? intent.rawValue;
      const notch = focusToNearFar(intent.rawValue, prev);
      prevFocus.set(config.id, intent.rawValue);
      if (!hasCapability(client, 'hasMfNearFar')) {
        log(`Focus skipped — hasMfNearFar not confirmed for "${config.name}"`);
        break;
      }
      if (notch !== 0 && canSend(config.id, 'focus')) {
        log(`Focus "${config.name}" val=${intent.rawValue.toFixed(3)} prev=${prev.toFixed(3)} notch=${notch}`);
        await client.controlDevice(PROP_CODES.NEAR_FAR, SDI_CONTROL_TYPE.NOTCH, notch, true);
      }
      break;
    }
    // ── AutoFocus ────────────────────────────────────────────────────────────
    // Trigger already filtered by decoder — release intents never reach here.
    case 'af':
      if (!hasCapability(client, 'hasFocusMode')) {
        log(`AF skipped — hasFocusMode not confirmed for "${config.name}"`);
        break;
      }
      if (canSend(config.id, 'af')) {
        log(`[BRIDGE] ATEM Push AF Triggered for "${config.name}"`);
        await client.triggerAutoFocus();
      }
      break;
    // ── Iris/Aperture ────────────────────────────────────────────────────────
    case 'iris':
      if (!hasCapability(client, 'hasFNumber')) {
        log(`Iris skipped — hasFNumber not confirmed for "${config.name}"`);
        break;
      }
      if (canSend(config.id, 'iris')) {
        const fnList = client.getSupportedList(PROP_CODES.FNUMBER);
        const notch = irisToNotch(intent.rawValue, state.fnumber, fnList);
        log(`Iris "${config.name}" val=${intent.rawValue.toFixed(3)} fnumber=${state.fnumber} notch=${notch}`);
        if (notch !== 0) await client.stepProp(PROP_CODES.FNUMBER, notch);
      }
      break;
    // ── ISO — rawValue is always in ISO units (dB converted by decoder for param=13) ──
    case 'iso':
      if (!hasCapability(client, 'hasISO')) {
        log(`ISO skipped — hasISO not confirmed for "${config.name}"`);
        break;
      }
      if (canSend(config.id, 'iso')) {
        const isoList = client.getSupportedList(PROP_CODES.ISO);
        const notch = isoToNotch(intent.rawValue, state.iso, isoList);
        log(`ISO "${config.name}" target=${intent.rawValue} current=${state.iso} notch=${notch}`);
        if (notch !== 0) await client.stepProp(PROP_CODES.ISO, notch);
      }
      break;
    // ── White Balance ────────────────────────────────────────────────────────
    // Sony ColorTemp (0xD20F) has no enumeration list on FX30 — use SetExtDevicePropValue.
    case 'wb':
      if (!hasCapability(client, 'hasColorTemp')) {
        log(`WB skipped — hasColorTemp not confirmed for "${config.name}"`);
        break;
      }
      if (canSend(config.id, 'wb')) {
        log(`WB "${config.name}" target=${intent.rawValue}K (absolute set)`);
        await client.setExtDeviceProp(PROP_CODES.COLOR_TEMP, intent.rawValue);
      }
      break;
    // ── Shutter Speed ────────────────────────────────────────────────────────
    // rawValue is microseconds (SINT32). e.g. 10000 μs → 1/100, 6667 μs → 1/150.
    case 'shutter': {
      if (!hasCapability(client, 'hasShutter')) {
        log(`Shutter skipped — hasShutter not confirmed for "${config.name}"`);
        break;
      }
      if (canSend(config.id, 'shutter')) {
        const den = shutterUsToSpeed(intent.rawValue);
        const shutList = client.getSupportedList(PROP_CODES.SHUTTER_SPEED);
        const notch = shutterToNotch(den, state.shutter, shutList);
        log(`Shutter(μs) "${config.name}" ${intent.rawValue}μs → 1/${den} current=0x${state.shutter.toString(16)} notch=${notch}`);
        if (notch !== 0) await client.stepProp(PROP_CODES.SHUTTER_SPEED, notch);
      }
      break;
    }
  }
}
