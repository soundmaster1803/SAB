/**
 * atem/actions/index.ts
 *
 * ATEM switcher action registry skeleton.
 *
 * An ATEM action is a named operation that affects the switcher itself —
 * distinct from bridge actions (which coordinate ATEM→Sony commands).
 *
 * Grounded in:
 *   - Current API operations: POST /api/atem/connect, /api/atem/disconnect
 *     (src/api/routes/atem.ts)
 *   - ATEMListener.connect() and ATEMListener.disconnect()
 *
 * Only actions grounded in current runtime operations are included.
 * Routing (program/preview cut), macro triggers, and multiview control
 * are not yet implemented and must not be speculatively added.
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Action IDs ───────────────────────────────────────────────────────────────

/**
 * Identifiers for all currently supported ATEM switcher actions.
 *
 * Current coverage:
 *   connect     — connect to an ATEM switcher by IP address
 *   disconnect  — disconnect from the current ATEM switcher
 */
export type AtemActionId =
  | 'connect'
  | 'disconnect';

// ─── Action Definition ────────────────────────────────────────────────────────

/**
 * Metadata for a single ATEM switcher action.
 *
 * `requiresConnection` indicates whether the ATEM must already be connected
 * for this action to be valid. Used by Phase 8 gate logic.
 */
export interface AtemActionDefinition {
  /** Stable identifier — used as a lookup key and log label. */
  id: AtemActionId;
  /** Short human-readable name for operator UI and logs. */
  name: string;
  /** One-sentence description of what this action does. */
  description: string;
  /** Whether the ATEM must be connected for this action to execute. */
  requiresConnection: boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All ATEM switcher actions keyed by ID.
 *
 * Add new actions here only when the underlying ATEM capability is confirmed
 * and the transport method exists in ATEMListener (or atem-connection directly).
 */
export const ATEM_ACTIONS: Record<AtemActionId, AtemActionDefinition> = {
  connect: {
    id: 'connect',
    name: 'Connect to ATEM',
    description: 'Connect to an ATEM switcher at the configured IP address.',
    requiresConnection: false,
  },
  disconnect: {
    id: 'disconnect',
    name: 'Disconnect from ATEM',
    description: 'Gracefully disconnect from the current ATEM switcher session.',
    requiresConnection: true,
  },
};

/** Ordered list of all ATEM action IDs. Useful for iteration. */
export const ATEM_ACTION_IDS = Object.keys(ATEM_ACTIONS) as AtemActionId[];
