/**
 * bridge/actions/index.ts
 *
 * Bridge domain action registry skeleton.
 *
 * A bridge action is a named operation that the bridge performs to coordinate
 * between the ATEM and Sony domains. These are distinct from ATEM actions
 * (which affect the switcher directly) and Sony actions (which target a camera).
 *
 * Grounded in current bridge runtime operations:
 *   - dispatchIntent   src/bridge/intents/decoder.ts + src/bridge/executors/sony-command-executor.ts
 *                      Called from handleCameraControl() in src/index.ts.
 *                      Decodes ATEM camera control command → ControlIntent → Sony PTP command.
 *   - syncToAtem       src/bridge/sync/atem-sync.ts (syncCameraStateToAtem)
 *                      Called from src/index.ts on first poll after camera connect.
 *                      Pushes ISO, iris, and WB state from Sony camera → ATEM switcher.
 *
 * Not included (not yet implemented):
 *   - Binding management (camera ↔ ATEM input assignment) — config API, not bridge action
 *   - Per-property pipeline flush — not implemented
 *   - Intent queue drain — not implemented
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Action IDs ───────────────────────────────────────────────────────────────

/**
 * Identifiers for all currently supported bridge coordination actions.
 *
 * Current coverage:
 *   dispatchIntent   — decode ATEM command → intent → execute on Sony camera
 *   syncToAtem       — push Sony camera state back to ATEM switcher
 */
export type BridgeActionId =
  | 'dispatchIntent'
  | 'syncToAtem';

// ─── Action Definition ────────────────────────────────────────────────────────

/**
 * Metadata for a single bridge coordination action.
 *
 * `requiresAtemConnection` — ATEM session must be active for the action to proceed.
 * `requiresCameraConnection` — target Sony camera must be connected and polled.
 */
export interface BridgeActionDefinition {
  /** Stable identifier — used as a lookup key and log label. */
  id: BridgeActionId;
  /** Short human-readable name for operator UI and logs. */
  name: string;
  /** One-sentence description of what this action does. */
  description: string;
  /** Whether the ATEM session must be active for this action to execute. */
  requiresAtemConnection: boolean;
  /** Whether the target Sony camera must be connected and past first poll. */
  requiresCameraConnection: boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All bridge coordination actions keyed by ID.
 *
 * Add new entries only when a bridge-level operation is implemented and grounded
 * in runtime code (decoder, executor, sync, or policy modules).
 */
export const BRIDGE_ACTIONS: Record<BridgeActionId, BridgeActionDefinition> = {
  dispatchIntent: {
    id: 'dispatchIntent',
    name: 'Dispatch Control Intent',
    description:
      'Decode an ATEM camera-control command into a normalized ControlIntent '
      + 'and execute it on the mapped Sony camera via the bridge pipeline '
      + '(throttle check → value conversion → Sony PTP command).',
    requiresAtemConnection: true,
    requiresCameraConnection: true,
  },
  syncToAtem: {
    id: 'syncToAtem',
    name: 'Sync Camera State to ATEM',
    description:
      'Push the current Sony camera state (ISO, iris, white balance) back to '
      + 'the ATEM switcher and enter the anti-loop cooldown for the source input.',
    requiresAtemConnection: true,
    requiresCameraConnection: true,
  },
};

/** Ordered list of all bridge action IDs. Useful for iteration. */
export const BRIDGE_ACTION_IDS = Object.keys(BRIDGE_ACTIONS) as BridgeActionId[];
