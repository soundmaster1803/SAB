/**
 * atem/variables/index.ts
 *
 * ATEM switcher variable registry skeleton.
 *
 * A variable represents an operator-visible live value derived from ATEM state.
 * Variables are read-only data points — they are not commands.
 *
 * Grounded in:
 *   - ATEMRawState fields (atem/state/raw.ts)
 *   - ATEMDerivedState fields (atem/state/derived.ts)
 *   - Current WS state broadcast (api/ws/broadcaster.ts):
 *     atemConnected, atemModel, inputCount, tally[], topology[]
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Variable IDs ─────────────────────────────────────────────────────────────

/**
 * Identifiers for all operator-visible ATEM switcher variables.
 *
 * Current coverage:
 *   connected         — boolean: ATEM TCP session is active
 *   model             — string: ATEM device name (e.g. "ATEM Mini Pro")
 *   inputCount        — number: count of camera inputs in range 1–20
 *   activeTallyCount  — number: count of inputs with any tally active
 */
export type AtemVariableId =
  | 'connected'
  | 'model'
  | 'inputCount'
  | 'activeTallyCount';

// ─── Variable Definition ──────────────────────────────────────────────────────

/**
 * Metadata for a single ATEM switcher variable.
 */
export interface AtemVariableDefinition {
  /** Stable identifier — used as lookup key and log label. */
  id: AtemVariableId;
  /** Short human-readable name for operator UI. */
  name: string;
  /** One-sentence description of what this variable represents. */
  description: string;
  /** Runtime type of the variable value. */
  valueType: 'string' | 'number' | 'boolean';
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All ATEM switcher variables keyed by ID.
 *
 * Add new variables only when the underlying state field is confirmed to be
 * produced by the atem-connection transport (i.e. exists in ATEMRawState
 * or ATEMDerivedState) and is broadcast via the current WS state message.
 *
 * Per-input tally values are not individual variables — they are indexed by
 * input ID and will be handled as parameterised variables in Phase 8.
 */
export const ATEM_VARIABLES: Record<AtemVariableId, AtemVariableDefinition> = {
  connected: {
    id: 'connected',
    name: 'ATEM Connected',
    description: 'True when the atem-connection TCP session is active.',
    valueType: 'boolean',
  },
  model: {
    id: 'model',
    name: 'ATEM Model',
    description: 'ATEM device name string as reported by the switcher (e.g. "ATEM Mini Pro").',
    valueType: 'string',
  },
  inputCount: {
    id: 'inputCount',
    name: 'Input Count',
    description: 'Number of camera inputs in range 1–20 reported by the ATEM.',
    valueType: 'number',
  },
  activeTallyCount: {
    id: 'activeTallyCount',
    name: 'Active Tally Count',
    description: 'Number of inputs with any tally state active (program or preview).',
    valueType: 'number',
  },
};

/** Ordered list of all ATEM variable IDs. Useful for iteration. */
export const ATEM_VARIABLE_IDS = Object.keys(ATEM_VARIABLES) as AtemVariableId[];
