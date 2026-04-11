/**
 * bridge/variables/index.ts
 *
 * Bridge domain variable registry skeleton.
 *
 * A bridge variable represents an operator-visible value that describes the
 * current policy configuration or runtime behaviour of the bridge layer.
 * Variables are read-only data points — they are not commands.
 *
 * Grounded in current bridge runtime constants:
 *   - throttleWindowMs   CMD_THROTTLE_MS = 200  in src/bridge/policies/throttle.ts
 *                        Per camera+property command rate limit.
 *                        Prevents overwhelming a Sony camera when ATEM sends 25+ updates/sec.
 *   - syncCooldownMs     SYNC_COOLDOWN_MS = 500 in src/bridge/policies/anti-loop.ts
 *                        Anti-loop cooldown window after each syncToAtem push.
 *                        Suppresses the echo from our own sync so it does not
 *                        trigger a redundant Sony command.
 *
 * Not included (not grounded in current runtime):
 *   - Per-camera intent dispatch counts — not tracked
 *   - Pipeline failure rates — not tracked
 *   - Active cooldown sources — ephemeral per-source state, not an operator variable
 *   - Active throttle keys — ephemeral per-key state, not an operator variable
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Variable IDs ─────────────────────────────────────────────────────────────

/**
 * Identifiers for all operator-visible bridge policy variables.
 *
 * Current coverage:
 *   throttleWindowMs   — command rate limit window per camera+property (ms)
 *   syncCooldownMs     — anti-loop suppression window after each ATEM sync push (ms)
 */
export type BridgeVariableId =
  | 'throttleWindowMs'
  | 'syncCooldownMs';

// ─── Variable Definition ──────────────────────────────────────────────────────

/**
 * Metadata for a single bridge policy variable.
 *
 * `unit` provides dimensional context for numeric values (e.g. 'ms').
 * It is optional and only present for variables where unit matters for operator interpretation.
 */
export interface BridgeVariableDefinition {
  /** Stable identifier — used as a lookup key and log label. */
  id: BridgeVariableId;
  /** Short human-readable name for operator UI. */
  name: string;
  /** One-sentence description of what this variable represents. */
  description: string;
  /** Runtime type of the variable value. */
  valueType: 'string' | 'number' | 'boolean';
  /** Optional unit label for numeric variables (e.g. 'ms'). */
  unit?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All bridge policy variables keyed by ID.
 *
 * Add new variables only when the underlying bridge constant or state field
 * is confirmed to be present in the policy or sync modules and is meaningful
 * to an operator (not just an internal implementation detail).
 */
export const BRIDGE_VARIABLES: Record<BridgeVariableId, BridgeVariableDefinition> = {
  throttleWindowMs: {
    id: 'throttleWindowMs',
    name: 'Command Throttle Window',
    description:
      'Rate limit window in milliseconds applied per camera per bridge property. '
      + 'Commands arriving within this window after the last sent command are dropped. '
      + 'Current value: 200ms (CMD_THROTTLE_MS in bridge/policies/throttle.ts).',
    valueType: 'number',
    unit: 'ms',
  },
  syncCooldownMs: {
    id: 'syncCooldownMs',
    name: 'Sync Anti-Loop Cooldown',
    description:
      'Suppression window in milliseconds applied per ATEM source input after '
      + 'a syncToAtem push. Prevents the ATEM echo from triggering a redundant '
      + 'Sony command. Current value: 500ms (SYNC_COOLDOWN_MS in bridge/policies/anti-loop.ts).',
    valueType: 'number',
    unit: 'ms',
  },
};

/** Ordered list of all bridge variable IDs. Useful for iteration. */
export const BRIDGE_VARIABLE_IDS = Object.keys(BRIDGE_VARIABLES) as BridgeVariableId[];
