/**
 * atem/feedbacks/index.ts
 *
 * ATEM switcher feedback registry skeleton.
 *
 * A feedback is a boolean condition derived from ATEM state that can trigger
 * a visual indicator on an operator control surface or UI panel.
 *
 * Grounded in:
 *   - ATEMRawState.connected — session liveness
 *   - ATEMDerivedState.programInputs / previewInputs — tally conditions
 *   - Current WS state broadcast (atemConnected, tally[])
 *
 * Tally feedbacks are naturally parameterised by input ID (e.g. "is input 3
 * on program?"). A `parameterHint` field documents this requirement for Phase 8
 * implementation without adding speculative complexity now.
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Feedback IDs ─────────────────────────────────────────────────────────────

/**
 * Identifiers for all operator-visible ATEM switcher feedbacks.
 *
 * Current coverage:
 *   connected       — ATEM TCP session is active
 *   inputOnProgram  — a specific input is on the program bus (parameterised by input ID)
 *   inputOnPreview  — a specific input is on the preview bus (parameterised by input ID)
 */
export type AtemFeedbackId =
  | 'connected'
  | 'inputOnProgram'
  | 'inputOnPreview';

// ─── Feedback Definition ──────────────────────────────────────────────────────

/**
 * Metadata for a single ATEM switcher feedback condition.
 *
 * `parameterHint` documents runtime parameters needed to evaluate parameterised
 * feedbacks (e.g. which input to check). Phase 8 will formalise the parameter
 * contract — for now this is a string description only.
 *
 * `stateSource` indicates which state layer the feedback evaluates:
 *   - 'raw'     — direct field from ATEMRawState
 *   - 'derived' — computed from ATEMDerivedState
 */
export interface AtemFeedbackDefinition {
  /** Stable identifier — used as lookup key and log label. */
  id: AtemFeedbackId;
  /** Short human-readable name for operator UI. */
  name: string;
  /** One-sentence description of the condition this feedback represents. */
  description: string;
  /** Which state layer is the source for this feedback evaluation. */
  stateSource: 'raw' | 'derived';
  /**
   * Optional description of the runtime parameter(s) needed to evaluate
   * this feedback. Undefined for non-parameterised feedbacks.
   *
   * Example: "inputId: number — the 1-indexed ATEM source input to check."
   */
  parameterHint?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All ATEM switcher feedbacks keyed by ID.
 *
 * Add new feedbacks only when the underlying condition is grounded in a
 * confirmed state field (ATEMRawState or ATEMDerivedState).
 */
export const ATEM_FEEDBACKS: Record<AtemFeedbackId, AtemFeedbackDefinition> = {
  connected: {
    id: 'connected',
    name: 'ATEM Connected',
    description: 'True when the atem-connection TCP session is active.',
    stateSource: 'raw',
  },
  inputOnProgram: {
    id: 'inputOnProgram',
    name: 'Input On Program',
    description: 'True when the specified ATEM source input is on the program bus.',
    stateSource: 'derived',
    parameterHint: 'inputId: number — the 1-indexed ATEM source input to check.',
  },
  inputOnPreview: {
    id: 'inputOnPreview',
    name: 'Input On Preview',
    description: 'True when the specified ATEM source input is on the preview bus.',
    stateSource: 'derived',
    parameterHint: 'inputId: number — the 1-indexed ATEM source input to check.',
  },
};

/** Ordered list of all ATEM feedback IDs. Useful for iteration. */
export const ATEM_FEEDBACK_IDS = Object.keys(ATEM_FEEDBACKS) as AtemFeedbackId[];
