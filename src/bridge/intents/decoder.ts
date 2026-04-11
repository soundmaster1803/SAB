/**
 * bridge/intents/decoder.ts
 *
 * Decodes a raw ATEM camera-control command into a normalized ControlIntent.
 *
 * Responsibility: determine whether a command targets a supported bridge
 * property, and if so, return the normalized {cameraId, property, rawValue}.
 * All ATEM wire-encoding (dB → ISO, AF trigger filter) is resolved here.
 * Sony-specific conversion (isoToNotch, irisToNotch, etc.) is not touched.
 */

import type { ATEMCameraControl } from '../../atem/listener';
import { gainDbToISO } from '../mapper';
import type { ControlIntent } from './types';

/**
 * Decode an ATEM camera-control command into a ControlIntent.
 *
 * Returns null when:
 *   - The category/parameter combination is not a supported bridge property.
 *   - The command is a non-trigger event (AF release).
 *
 * rawValue semantics per property:
 *   focus   — float 0.0–1.0 (ATEM position, delta calculated by executor)
 *   af      — always 1 (trigger; release filtered out)
 *   iris    — float f-number (e.g. 3.345 = f/3.3)
 *   iso     — integer ISO value (dB converted via gainDbToISO for param=13)
 *   wb      — integer Kelvin
 *   shutter — integer microseconds (denominator calculated by executor)
 */
export function decodeControlIntent(
  cameraId: string,
  cmd: ATEMCameraControl,
): ControlIntent | null {
  const n0 = cmd.numberData[0] ?? 0;
  const b0 = cmd.boolData[0] ?? false;
  const now = Date.now();

  switch (cmd.category) {
    // ── Category 0: Lens ──────────────────────────────────────────────────
    case 0:
      switch (cmd.parameter) {
        // param 0: Focus — FLOAT (actual focus position, 0.0–1.0)
        case 0:
          return { cameraId, property: 'focus', rawValue: n0, source: 'atem', timestamp: now };

        // param 1: AutoFocus — trigger only (press=1), not release
        // ATEM may send boolData[0]=true or numberData[0]=1 depending on firmware
        case 1:
          if (!(b0 || n0 === 1)) return null;
          return { cameraId, property: 'af', rawValue: 1, source: 'atem', timestamp: now };

        // param 2: Iris — FLOAT (f-number, e.g. 3.345 = f/3.3)
        case 2:
          return { cameraId, property: 'iris', rawValue: n0, source: 'atem', timestamp: now };

        default:
          return null;
      }

    // ── Category 1: Video ─────────────────────────────────────────────────
    case 1:
      switch (cmd.parameter) {
        // param 13: Gain — SINT8 (dB). Convert to ISO here; executor uses ISO.
        // param 1 is intentionally absent — ATEM sends it redundantly alongside param=13.
        case 13:
          return { cameraId, property: 'iso', rawValue: gainDbToISO(n0), source: 'atem', timestamp: now };

        // param 2: White Balance — SINT16 (Kelvin, absolute)
        case 2:
          return { cameraId, property: 'wb', rawValue: n0, source: 'atem', timestamp: now };

        // param 5: Shutter Speed — SINT32 (microseconds). e.g. 10000 μs → 1/100
        case 5:
          return { cameraId, property: 'shutter', rawValue: n0, source: 'atem', timestamp: now };

        // param 14: ISO — SINT32 (direct value, e.g. 800)
        case 14:
          return { cameraId, property: 'iso', rawValue: n0, source: 'atem', timestamp: now };

        default:
          return null;
      }

    default:
      return null;
  }
}
