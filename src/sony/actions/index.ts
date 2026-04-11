/**
 * sony/actions/index.ts
 *
 * Sony camera action registry skeleton.
 *
 * An action represents a named, capability-gated operation that can be invoked
 * against a Sony camera. This registry defines the available actions and their
 * metadata — it does not implement execution.
 *
 * Execution is handled by the bridge executor (bridge/executors/sony-command-executor.ts).
 * Capability gating (Phase 8) will use SonyCapabilities from sony/models/types.ts.
 *
 * Grounded in:
 *   - Current bridge executor: iso, shutter, iris (fnumber), wb, af, focus
 *   - Current PTP client: toggleRecord(), stepProp(), setExtDeviceProp()
 *   - SonyCapabilities flags from sony/models/types.ts
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

import type { SonyCapabilities } from '../models/types';

// ─── Action IDs ───────────────────────────────────────────────────────────────

/**
 * Identifiers for all currently supported Sony camera actions.
 *
 * Naming is intentionally distinct from BridgeProperty so that Sony actions
 * can evolve independently from the bridge intent vocabulary.
 *
 * Current coverage:
 *   iso       — step ISO up/down via supported enumeration list
 *   shutter   — step shutter speed up/down via supported enumeration list
 *   fnumber   — step aperture up/down via supported enumeration list
 *   colorTemp — set color temperature to an absolute Kelvin value
 *   af        — trigger a push autofocus pulse (S1 button down → up)
 *   record    — toggle recording state (MovieRec button hold pulse)
 */
export type SonyActionId =
  | 'iso'
  | 'shutter'
  | 'fnumber'
  | 'colorTemp'
  | 'af'
  | 'record';

// ─── Action Definition ────────────────────────────────────────────────────────

/**
 * Metadata for a single Sony camera action.
 *
 * `requiredCapability` is the SonyCapabilities key that must be true on the
 * connected camera's model spec before this action is permitted. Phase 8 will
 * enforce this gate at runtime.
 */
export interface SonyActionDefinition {
  /** Stable identifier — used as throttle key and log label. */
  id: SonyActionId;
  /** Short human-readable name for operator UI and logs. */
  name: string;
  /** One-sentence description of what the action does. */
  description: string;
  /** SonyCapabilities key that gates this action. */
  requiredCapability: keyof SonyCapabilities;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All Sony camera actions keyed by ID.
 *
 * Add new actions here. Do not add an action unless:
 *   1. The Sony transport (ptp-client.ts) can execute it today, OR
 *   2. A confirmed capability flag exists in SonyCapabilities.
 */
export const SONY_ACTIONS: Record<SonyActionId, SonyActionDefinition> = {
  iso: {
    id: 'iso',
    name: 'Set ISO',
    description: 'Step ISO up or down one position via the camera enumeration list.',
    requiredCapability: 'iso',
  },
  shutter: {
    id: 'shutter',
    name: 'Set Shutter Speed',
    description: 'Step shutter speed up or down one position via the camera enumeration list.',
    requiredCapability: 'shutterSpeed',
  },
  fnumber: {
    id: 'fnumber',
    name: 'Set Aperture',
    description: 'Step aperture (f-number) up or down one position via the camera enumeration list.',
    requiredCapability: 'fNumber',
  },
  colorTemp: {
    id: 'colorTemp',
    name: 'Set Color Temperature',
    description: 'Set color temperature to an absolute Kelvin value.',
    requiredCapability: 'colorTemp',
  },
  af: {
    id: 'af',
    name: 'Trigger Autofocus',
    description: 'Send a push autofocus pulse (S1 button down → 150ms → up).',
    requiredCapability: 'focusMode',
  },
  record: {
    id: 'record',
    name: 'Toggle Recording',
    description: 'Toggle recording state via MovieRec button hold pulse (down → 100ms → up).',
    requiredCapability: 'movieRecButton',
  },
};

/** Ordered list of all Sony action IDs. Useful for iteration. */
export const SONY_ACTION_IDS = Object.keys(SONY_ACTIONS) as SonyActionId[];
