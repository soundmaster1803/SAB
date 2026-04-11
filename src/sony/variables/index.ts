/**
 * sony/variables/index.ts
 *
 * Sony camera variable registry skeleton.
 *
 * A variable represents an operator-visible live value derived from camera state.
 * Variables are read-only data points — they are not commands.
 *
 * Grounded in:
 *   - SonyRawState fields (sony/state/raw.ts)
 *   - SonyDerivedState fields (sony/state/derived.ts)
 *   - Current UI state broadcast (api/viewmodels/camera.ts → uiState())
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Variable IDs ─────────────────────────────────────────────────────────────

/**
 * Identifiers for all operator-visible Sony camera variables.
 *
 * Raw variables reflect values as polled from the camera.
 * Display variables are human-readable strings derived from raw values.
 *
 * Current coverage:
 *   iso           — display string: "AUTO" or numeric (e.g. "800")
 *   shutter       — display string: "1/100", "2.0\"", or "—"
 *   fnumber       — display string: "2.8"
 *   expComp       — display string: "+1.3", "-0.7", "0"
 *   colorTemp     — raw Kelvin integer (e.g. 5500)
 *   battery       — percentage 0–100
 *   recState      — 0 = idle, 1 = recording
 *   recRemainSec  — remaining card time in seconds; 0 = unknown
 *   tally         — 0 = none, 1 = program, 2 = preview
 *   connected     — boolean: PTP session is active
 */
export type SonyVariableId =
  | 'iso'
  | 'shutter'
  | 'fnumber'
  | 'expComp'
  | 'colorTemp'
  | 'battery'
  | 'recState'
  | 'recRemainSec'
  | 'tally'
  | 'connected';

// ─── Variable Definition ──────────────────────────────────────────────────────

/**
 * Metadata for a single Sony camera variable.
 *
 * `valueType` describes the JavaScript runtime type of the variable's value.
 * `displayFormat` is a hint for UI panels — not enforced at runtime.
 */
export interface SonyVariableDefinition {
  /** Stable identifier — used as lookup key and log label. */
  id: SonyVariableId;
  /** Short human-readable name for operator UI. */
  name: string;
  /** One-sentence description of what this variable represents. */
  description: string;
  /** Runtime type of the variable value. */
  valueType: 'string' | 'number' | 'boolean';
  /** Optional display format hint for UI panels. */
  displayFormat?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All Sony camera variables keyed by ID.
 *
 * Add new variables here only when the underlying state field is confirmed to
 * be produced by the PTP transport (i.e. exists in SonyRawState or SonyDerivedState).
 */
export const SONY_VARIABLES: Record<SonyVariableId, SonyVariableDefinition> = {
  iso: {
    id: 'iso',
    name: 'ISO',
    description: 'Current ISO sensitivity as a display string ("AUTO" or numeric).',
    valueType: 'string',
  },
  shutter: {
    id: 'shutter',
    name: 'Shutter Speed',
    description: 'Current shutter speed as a display string (e.g. "1/100", "2.0\\"").',
    valueType: 'string',
  },
  fnumber: {
    id: 'fnumber',
    name: 'Aperture',
    description: 'Current aperture as a display string (e.g. "2.8").',
    valueType: 'string',
  },
  expComp: {
    id: 'expComp',
    name: 'Exposure Compensation',
    description: 'Current exposure compensation as a signed EV display string (e.g. "+1.3").',
    valueType: 'string',
  },
  colorTemp: {
    id: 'colorTemp',
    name: 'Color Temperature',
    description: 'Current color temperature in Kelvin.',
    valueType: 'number',
    displayFormat: '${value}K',
  },
  battery: {
    id: 'battery',
    name: 'Battery',
    description: 'Remaining battery as a percentage (0–100).',
    valueType: 'number',
    displayFormat: '${value}%',
  },
  recState: {
    id: 'recState',
    name: 'Recording State',
    description: 'Recording state: 0 = idle, 1 = recording.',
    valueType: 'number',
  },
  recRemainSec: {
    id: 'recRemainSec',
    name: 'Record Time Remaining',
    description: 'Remaining recordable time in seconds. 0 means unknown.',
    valueType: 'number',
    displayFormat: '${value}s',
  },
  tally: {
    id: 'tally',
    name: 'Tally',
    description: 'Tally state from ATEM: 0 = none, 1 = program, 2 = preview.',
    valueType: 'number',
  },
  connected: {
    id: 'connected',
    name: 'Connected',
    description: 'True when the PTP/IP session is active and the camera is reachable.',
    valueType: 'boolean',
  },
};

/** Ordered list of all Sony variable IDs. Useful for iteration. */
export const SONY_VARIABLE_IDS = Object.keys(SONY_VARIABLES) as SonyVariableId[];
