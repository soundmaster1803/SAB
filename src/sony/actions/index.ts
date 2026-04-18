/**
 * sony/actions/index.ts
 *
 * Sony camera action registry.
 *
 * An action represents a named, capability-gated operation that can be invoked
 * against a Sony camera. This registry defines the available actions and their
 * metadata — it does not implement execution.
 *
 * Execution is handled by the bridge executor (bridge/executors/sony-command-executor.ts).
 * Capability gating uses RuntimeCapabilities from sony/runtime/types.ts — flags are
 * derived from live protocol data observed during polling, not static model specs.
 *
 * Grounded in:
 *   - Current bridge executor: iso, shutter, iris (fnumber), wb, af, focus
 *   - Current PTP client: toggleRecord(), stepProp(), setExtDeviceProp()
 *   - RuntimeCapabilities flags from sony/runtime/types.ts
 */

import type { RuntimeCapabilities } from '../runtime/types';

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
 *   af                   — trigger a push autofocus pulse (S1 button down → up)
 *   record               — toggle recording state (MovieRec button hold pulse)
 *   setFocusMode         — set focus mode (MF / AF-S / AF-C / AF-A / DMF / PF)
 *   setFocusArea         — set focus area (Wide / Zone / Center / Flexible S–XL / Lock-on)
 *   setFocusPosition     — set absolute focus position (0x0000 near → 0xFFFF infinity)
 *   stepFocusNear        — single focus step toward near limit
 *   stepFocusFar         — single focus step toward infinity
 */
export type SonyActionId =
  | 'iso'
  | 'shutter'
  | 'fnumber'
  | 'colorTemp'
  | 'af'
  | 'record'
  | 'setFocusMode'
  | 'setFocusArea'
  | 'setFocusPosition'
  | 'stepFocusNear'
  | 'stepFocusFar';

// ─── Action Definition ────────────────────────────────────────────────────────

/**
 * Metadata for a single Sony camera action.
 *
 * `requiredCapability` is the RuntimeCapabilities flag that must be true for
 * the connected camera before this action is permitted. The flag is derived
 * from live polling data — if the camera exposes the required prop code, the
 * capability is set and the action is allowed.
 */
export interface SonyActionDefinition {
  /** Stable identifier — used as throttle key and log label. */
  id: SonyActionId;
  /** Short human-readable name for operator UI and logs. */
  name: string;
  /** One-sentence description of what the action does. */
  description: string;
  /** RuntimeCapabilities flag that gates this action. */
  requiredCapability: keyof RuntimeCapabilities;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All Sony camera actions keyed by ID.
 *
 * Add new actions here. Do not add an action unless:
 *   1. The Sony transport (ptp-client.ts) can execute it today, OR
 *   2. A confirmed RuntimeCapabilities flag exists for the required prop.
 */
export const SONY_ACTIONS: Record<SonyActionId, SonyActionDefinition> = {
  iso: {
    id: 'iso',
    name: 'Set ISO',
    description: 'Step ISO up or down one position via the camera enumeration list.',
    requiredCapability: 'hasISO',
  },
  shutter: {
    id: 'shutter',
    name: 'Set Shutter Speed',
    description: 'Step shutter speed up or down one position via the camera enumeration list.',
    requiredCapability: 'hasShutter',
  },
  fnumber: {
    id: 'fnumber',
    name: 'Set Aperture',
    description: 'Step aperture (f-number) up or down one position via the camera enumeration list.',
    requiredCapability: 'hasFNumber',
  },
  colorTemp: {
    id: 'colorTemp',
    name: 'Set Color Temperature',
    description: 'Set color temperature to an absolute Kelvin value.',
    requiredCapability: 'hasColorTemp',
  },
  af: {
    id: 'af',
    name: 'Trigger Autofocus',
    description: 'Send a push autofocus pulse (S1 button down → 150ms → up).',
    requiredCapability: 'hasFocusMode',
  },
  record: {
    id: 'record',
    name: 'Toggle Recording',
    description: 'Toggle recording state via MovieRec button hold pulse (down → 100ms → up).',
    requiredCapability: 'hasMovieRecButton',
  },
  setFocusMode: {
    id: 'setFocusMode',
    name: 'Set Focus Mode',
    description: 'Switch focus mode: MF, AF-S, AF-C, AF-A, DMF, or PF.',
    requiredCapability: 'hasFocusMode',
  },
  setFocusArea: {
    id: 'setFocusArea',
    name: 'Set Focus Area',
    description: 'Set the AF area: Wide, Zone, Center, Flexible S/M/L/XS/XL, or Lock-on AF.',
    requiredCapability: 'hasFocusMode',
  },
  setFocusPosition: {
    id: 'setFocusPosition',
    name: 'Set Focus Position',
    description: 'Set absolute lens position (0x0000=near, 0xFFFF=infinity). Requires MF or DMF mode. PTP3 cameras only.',
    requiredCapability: 'hasFocusPosition',
  },
  stepFocusNear: {
    id: 'stepFocusNear',
    name: 'Focus Step Near',
    description: 'Move focus one step toward the near limit (0xD2D7 button pulse).',
    requiredCapability: 'hasMfNearFar',
  },
  stepFocusFar: {
    id: 'stepFocusFar',
    name: 'Focus Step Far',
    description: 'Move focus one step toward infinity (0xD2D8 button pulse).',
    requiredCapability: 'hasMfNearFar',
  },
};

/** Ordered list of all Sony action IDs. Useful for iteration. */
export const SONY_ACTION_IDS = Object.keys(SONY_ACTIONS) as SonyActionId[];
