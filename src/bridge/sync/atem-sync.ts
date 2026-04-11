/**
 * bridge/sync/atem-sync.ts
 *
 * Pushes Sony camera state back to the ATEM switcher (bi-directional sync).
 *
 * Uses CameraControlCommand (CCmd) — the writable counterpart of CCdP.
 * Sets a 500ms anti-loop cooldown after each push so the incoming echo
 * does not trigger a redundant Sony command.
 *
 * The Atem instance is passed in rather than owned here — transport stays
 * in the ATEM domain; sync orchestration lives in the Bridge domain.
 */

import { Atem, Commands } from 'atem-connection'
import type { CameraState } from '../../sony/ptp-client'
import { enterCooldown } from '../policies/anti-loop'

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string) { console.log(`[${ts()}] [BRIDGE] ${msg}`); }

/**
 * Sync relevant Sony camera state properties to the ATEM switcher.
 *
 * Sends:
 *   ISO     — cat=1 param=14, SINT32 direct value
 *   Iris    — cat=0 param=2,  FLOAT  normalized 0.0–1.0 (1.0 = wide open)
 *   WB      — cat=1 param=2,  SINT16 Kelvin
 *
 * After sending, enters a 500ms anti-loop cooldown for the source so the
 * ATEM echo does not trigger a redundant Sony command (see bridge/policies/anti-loop).
 */
export function syncCameraStateToAtem(atem: Atem, source: number, state: CameraState): void {
  const { CameraControlCommand, CameraControlDataType } = Commands
  const base = { boolData: [] as boolean[], bigintData: [] as bigint[], stringData: '', relative: false }

  const safeSend = (cmd: InstanceType<typeof CameraControlCommand>) => {
    try { Promise.resolve(atem.sendCommand(cmd)).catch(() => {}) } catch (_e) {}
  }

  // ISO — category=1, param=14, SINT32 direct value
  if (state.iso > 0 && (state.iso & 0x00FFFFFF) !== 0x00FFFFFF) {
    safeSend(new CameraControlCommand(source, 1, 14, {
      ...base, type: CameraControlDataType.SINT32, numberData: [state.iso],
    }))
  }

  // Iris — category=0, param=2, FLOAT normalized 0.0–1.0 (1.0 = wide open)
  // fnumber is f*100 (e.g., 280 = f/2.8). Assume range f/1.0–f/22.
  if (state.fnumber > 0) {
    const fVal = state.fnumber / 100
    const iris = Math.max(0, Math.min(1, (22 - fVal) / 21))
    safeSend(new CameraControlCommand(source, 0, 2, {
      ...base, type: CameraControlDataType.FLOAT, numberData: [iris],
    }))
  }

  // White Balance — category=1, param=2, SINT16 (Kelvin)
  if (state.colorTemp > 0) {
    safeSend(new CameraControlCommand(source, 1, 2, {
      ...base, type: CameraControlDataType.SINT16, numberData: [state.colorTemp],
    }))
  }

  enterCooldown(source)
  log(`Sync→ATEM src=${source} iso=${state.iso} fnumber=${state.fnumber} colorTemp=${state.colorTemp}`)
}
