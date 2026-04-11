/**
 * bridge/feedbacks/index.ts
 *
 * Bridge domain feedback registry skeleton.
 *
 * A feedback is an operator-visible boolean condition derived from bridge
 * runtime state. Feedbacks are read-only — they are not commands.
 *
 * Grounded in current bridge runtime logic:
 *
 *   bridgeReady
 *     ATEM is connected AND the 3-second initial state suppression window has
 *     elapsed. Grounded in ATEMListener.readyAfter (set to Date.now() + 3000
 *     on every connect()) and the guard in handleCameraControl() in index.ts
 *     which checks client.state.lastUpdate > 0.
 *     The bridge only dispatches intents when both conditions hold.
 *
 *   cameraControlEnabled
 *     The atemControlEnabled flag for a specific camera is true.
 *     Grounded in the early-return guard in handleCameraControl() (src/index.ts:37):
 *       if (!config.atemControlEnabled) { log(...); return; }
 *     Per-camera: requires a cameraId parameter to evaluate.
 *
 *   inSyncCooldown
 *     A specific ATEM source input is currently within the 500ms anti-loop
 *     cooldown window after a syncToAtem push.
 *     Grounded in isInCooldown(source) in src/bridge/policies/anti-loop.ts.
 *     Per-source: requires an ATEM source input number to evaluate.
 *
 *   commandThrottled
 *     A specific camera+property combination is within the 200ms throttle window.
 *     An incoming ATEM command for this pair would be dropped if it arrived now.
 *     Grounded in !canSend(cameraId, property) in src/bridge/policies/throttle.ts.
 *     Per-camera per-property: requires both a cameraId and a BridgeProperty to evaluate.
 *
 * Not included (not grounded in current runtime):
 *   - Per-intent pipeline stage feedback — not tracked
 *   - Conversion failure state — not tracked
 *   - Binding mismatch detection — not implemented
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Feedback IDs ─────────────────────────────────────────────────────────────

/**
 * Identifiers for all operator-visible bridge feedback conditions.
 *
 * Current coverage:
 *   bridgeReady           — ATEM connected and past initial suppression window
 *   cameraControlEnabled  — per-camera ATEM control flag is active
 *   inSyncCooldown        — per-source anti-loop cooldown is active
 *   commandThrottled      — per-camera per-property throttle window is active
 */
export type BridgeFeedbackId =
  | 'bridgeReady'
  | 'cameraControlEnabled'
  | 'inSyncCooldown'
  | 'commandThrottled';

// ─── Feedback Definition ──────────────────────────────────────────────────────

/**
 * Metadata for a single bridge feedback condition.
 *
 * `parameterized` indicates whether this feedback requires a runtime parameter
 * (e.g. cameraId, ATEM source number, or property name) to evaluate. Non-parameterized
 * feedbacks are global and can be evaluated from bridge state alone.
 *
 * `parameters` lists the required parameter names when parameterized is true.
 * This is metadata only — actual evaluation is handled by Phase 8 gate logic.
 */
export interface BridgeFeedbackDefinition {
  /** Stable identifier — used as a lookup key and log label. */
  id: BridgeFeedbackId;
  /** Short human-readable name for operator UI. */
  name: string;
  /** One-sentence description of what condition this feedback represents. */
  description: string;
  /**
   * Whether evaluating this feedback requires a runtime parameter.
   * True = caller must supply parameter(s) listed in `parameters`.
   * False = feedback can be evaluated from global bridge state alone.
   */
  parameterized: boolean;
  /**
   * Names of the runtime parameters required when parameterized is true.
   * Empty array when parameterized is false.
   *
   * Example: ['cameraId'] for cameraControlEnabled.
   * Example: ['source'] for inSyncCooldown.
   * Example: ['cameraId', 'property'] for commandThrottled.
   */
  parameters: string[];
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All bridge feedback conditions keyed by ID.
 *
 * Add new feedbacks only when the underlying bridge state condition is confirmed
 * to exist in the current policy, sync, or intent modules.
 */
export const BRIDGE_FEEDBACKS: Record<BridgeFeedbackId, BridgeFeedbackDefinition> = {
  bridgeReady: {
    id: 'bridgeReady',
    name: 'Bridge Ready',
    description:
      'True when the ATEM is connected and the 3-second initial state suppression '
      + 'window has elapsed, meaning the bridge will dispatch incoming control intents.',
    parameterized: false,
    parameters: [],
  },
  cameraControlEnabled: {
    id: 'cameraControlEnabled',
    name: 'Camera ATEM Control Enabled',
    description:
      'True when the atemControlEnabled flag is set for the specified camera. '
      + 'When false, all ATEM camera-control commands for that camera are silently dropped.',
    parameterized: true,
    parameters: ['cameraId'],
  },
  inSyncCooldown: {
    id: 'inSyncCooldown',
    name: 'Source in Sync Cooldown',
    description:
      'True when the specified ATEM source input is within the 500ms anti-loop '
      + 'cooldown window after a syncToAtem push. Incoming commands for this source '
      + 'are suppressed while this feedback is active.',
    parameterized: true,
    parameters: ['source'],
  },
  commandThrottled: {
    id: 'commandThrottled',
    name: 'Command Throttled',
    description:
      'True when the specified camera+property combination is within the 200ms '
      + 'throttle window. An ATEM command for this pair arriving now would be dropped.',
    parameterized: true,
    parameters: ['cameraId', 'property'],
  },
};

/** Ordered list of all bridge feedback IDs. Useful for iteration. */
export const BRIDGE_FEEDBACK_IDS = Object.keys(BRIDGE_FEEDBACKS) as BridgeFeedbackId[];
