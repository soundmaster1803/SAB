/**
 * sony/presets/index.ts
 *
 * Sony camera preset registry skeleton.
 *
 * A preset is a named collection of property assignments that can be applied
 * atomically to a Sony camera. Presets are validated against model capabilities
 * before application — a preset is silently refused if the camera does not
 * support a required capability.
 *
 * This file defines the preset data structure only. Runtime application logic
 * will be implemented in Phase 8 (src/sony/executors/preset-applier.ts).
 *
 * Grounded in:
 *   - Properties that SonyPTPClient can currently set: iso, shutter, fnumber, colorTemp
 *   - SonyCapabilities flags from sony/models/types.ts
 *   - CLAUDE.md §5 preset rules: validate, order safely, support partial failure
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

import type { SonyCapabilities } from '../models/types';

// ─── Preset Properties ────────────────────────────────────────────────────────

/**
 * The set of camera properties that a preset may assign.
 *
 * Only properties that the Sony transport can currently set are included.
 * The transport methods used:
 *   iso        — stepProp(PROP_CODES.ISO, notch) via enumeration list
 *   shutter    — stepProp(PROP_CODES.SHUTTER_SPEED, notch) via enumeration list
 *   fnumber    — stepProp(PROP_CODES.FNUMBER, notch) via enumeration list
 *   colorTemp  — setExtDeviceProp(PROP_CODES.COLOR_TEMP, kelvin) — absolute set
 */
export type SonyPresetProperty =
  | 'iso'
  | 'shutter'
  | 'fnumber'
  | 'colorTemp';

// ─── Preset Entry ─────────────────────────────────────────────────────────────

/**
 * A single property assignment within a preset.
 *
 * `value` is the target raw camera value (same encoding as SonyRawState):
 *   iso        — masked ISO integer (e.g. 800, 0x00FFFFFF = AUTO)
 *   shutter    — UINT32 fraction: (numerator<<16 | denominator) (e.g. 0x00010064 = 1/100)
 *   fnumber    — UINT16 × 100 (e.g. 280 = f/2.8)
 *   colorTemp  — Kelvin integer (e.g. 5600)
 */
export interface SonyPresetEntry {
  /** Which property this entry sets. */
  property: SonyPresetProperty;
  /** Target value in the same raw encoding used by SonyRawState. */
  value: number;
}

// ─── Preset Definition ────────────────────────────────────────────────────────

/**
 * A named, capability-gated set of property assignments.
 *
 * Runtime application rules (Phase 8):
 *   1. Check all requiredCapabilities against the camera's SonyModelSpec.
 *      Refuse (do not partially apply) if any capability is missing.
 *   2. Apply entries in the declared order — order matters for exposure stability.
 *   3. On per-entry failure, do not continue. Log and surface the failure.
 *   4. After a successful apply, trigger a state update so feedbacks and
 *      variables reflect the new values.
 */
export interface SonyPresetDefinition {
  /** Stable identifier — must be unique across all presets. */
  id: string;
  /** Short human-readable name for operator UI. */
  name: string;
  /** Optional description of when to use this preset. */
  description?: string;
  /** Ordered list of property assignments to apply. */
  entries: SonyPresetEntry[];
  /**
   * Camera capabilities required for this preset to be valid.
   * The preset applier (Phase 8) refuses to apply if any of these are false
   * on the target camera's model spec.
   */
  requiredCapabilities: Array<keyof SonyCapabilities>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All defined Sony camera presets.
 *
 * Empty at skeleton phase — no presets are defined until camera capabilities
 * are confirmed and the applier is wired (Phase 8).
 *
 * When adding presets:
 *   - Use raw Sony values (same encoding as SonyRawState)
 *   - List requiredCapabilities conservatively (all that apply)
 *   - Order entries from most stable to most sensitive (e.g. ISO before shutter)
 */
export const SONY_PRESETS: SonyPresetDefinition[] = [];
