/**
 * sony/feedbacks/index.ts
 *
 * Sony camera feedback registry skeleton.
 *
 * A feedback is a boolean condition derived from camera state that can trigger
 * a visual indicator on an operator control surface or UI panel.
 *
 * Grounded in:
 *   - SonyAlertState fields (sony/state/alerts.ts): battery severity, rec remaining
 *   - SonyRawState fields (sony/state/raw.ts): connected, recState, tally
 *   - Current project operational needs: live production monitoring
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Feedback IDs ─────────────────────────────────────────────────────────────

/**
 * Identifiers for all operator-visible Sony camera feedbacks.
 *
 * Each feedback represents a binary condition (true/false) that an operator
 * can monitor. Implementation (Phase 8) will evaluate these against live state.
 *
 * Current coverage:
 *   connected        — PTP session is active and camera is reachable
 *   recording        — camera is currently recording (recState === 1)
 *   notRecording     — camera is idle (recState === 0); useful for inverse indicator
 *   lowBattery       — battery < 20% and not charging
 *   criticalBattery  — battery < 10% and not charging
 *   tallyProgram     — camera is on program tally (tally === 1)
 *   tallyPreview     — camera is on preview tally (tally === 2)
 */
export type SonyFeedbackId =
  | 'connected'
  | 'recording'
  | 'notRecording'
  | 'lowBattery'
  | 'criticalBattery'
  | 'tallyProgram'
  | 'tallyPreview';

// ─── Feedback Definition ──────────────────────────────────────────────────────

/**
 * Metadata for a single Sony camera feedback condition.
 *
 * `stateSource` indicates which state layer is evaluated to compute this feedback:
 *   - 'raw'     — direct field from SonyRawState
 *   - 'alert'   — derived from SonyAlertState
 */
export interface SonyFeedbackDefinition {
  /** Stable identifier — used as lookup key and log label. */
  id: SonyFeedbackId;
  /** Short human-readable name for operator UI. */
  name: string;
  /** One-sentence description of the condition this feedback represents. */
  description: string;
  /** Which state layer is the source for this feedback evaluation. */
  stateSource: 'raw' | 'alert';
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All Sony camera feedbacks keyed by ID.
 *
 * Add new feedbacks here only when the underlying condition is grounded in a
 * confirmed state field (SonyRawState or SonyAlertState).
 */
export const SONY_FEEDBACKS: Record<SonyFeedbackId, SonyFeedbackDefinition> = {
  connected: {
    id: 'connected',
    name: 'Camera Connected',
    description: 'True when the PTP/IP session is active and the camera is reachable.',
    stateSource: 'raw',
  },
  recording: {
    id: 'recording',
    name: 'Recording',
    description: 'True when the camera is actively recording (recState === 1).',
    stateSource: 'raw',
  },
  notRecording: {
    id: 'notRecording',
    name: 'Not Recording',
    description: 'True when the camera is idle and not recording (recState === 0).',
    stateSource: 'raw',
  },
  lowBattery: {
    id: 'lowBattery',
    name: 'Low Battery',
    description: 'True when battery is below 20% and the camera is not on AC power.',
    stateSource: 'alert',
  },
  criticalBattery: {
    id: 'criticalBattery',
    name: 'Critical Battery',
    description: 'True when battery is below 10% and the camera is not on AC power.',
    stateSource: 'alert',
  },
  tallyProgram: {
    id: 'tallyProgram',
    name: 'Tally: Program',
    description: 'True when the camera is on the ATEM program bus (tally === 1).',
    stateSource: 'raw',
  },
  tallyPreview: {
    id: 'tallyPreview',
    name: 'Tally: Preview',
    description: 'True when the camera is on the ATEM preview bus (tally === 2).',
    stateSource: 'raw',
  },
};

/** Ordered list of all Sony feedback IDs. Useful for iteration. */
export const SONY_FEEDBACK_IDS = Object.keys(SONY_FEEDBACKS) as SonyFeedbackId[];
