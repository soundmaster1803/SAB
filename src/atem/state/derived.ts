/**
 * atem/state/derived.ts
 *
 * Derived ATEM switcher state — computed values from raw ATEM state.
 *
 * All derivations are pure functions of ATEMRawState.
 * No I/O, no side effects, no Date.now() calls (not pure — kept in bridge layer).
 *
 * NOTE on isReady: The "bridge ready" condition (connected && Date.now() >= readyAfterMs)
 * is intentionally NOT included here because it depends on the current time and is
 * therefore not a pure function of raw state. The bridge layer checks readyAfterMs
 * directly against Date.now() when evaluating command eligibility.
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

import type { ATEMRawState } from './raw';

// ─── Derived State ────────────────────────────────────────────────────────────

/**
 * Derived ATEM switcher state — computed from ATEMRawState.
 *
 * Field notes:
 *   - `topology`            sorted camera input IDs (same as raw.knownInputIds;
 *                           kept here for convenient access alongside tally array)
 *   - `tally`               per-input tally as 0/1/2, positionally ordered by topology
 *                           (0 = none, 1 = program, 2 = preview)
 *   - `activeTallyInputs`   input IDs where tally !== 0 (any bus active)
 *   - `programInputs`       input IDs currently on the program bus
 *   - `previewInputs`       input IDs currently on the preview bus
 */
export interface ATEMDerivedState {
  /**
   * Sorted camera input IDs in range 1–20.
   * Positional index matches tally[].
   */
  topology: number[];

  /**
   * Per-input tally state as a numeric code, positionally ordered by topology.
   * 0 = no tally, 1 = program, 2 = preview.
   * Length always equals topology.length.
   */
  tally: number[];

  /**
   * Input IDs where any tally state is active (program or preview).
   * Subset of topology.
   */
  activeTallyInputs: number[];

  /**
   * Input IDs currently on the ATEM program bus.
   * Subset of activeTallyInputs.
   */
  programInputs: number[];

  /**
   * Input IDs currently on the ATEM preview bus.
   * Subset of activeTallyInputs.
   */
  previewInputs: number[];
}

// ─── Derivation function ──────────────────────────────────────────────────────

/**
 * Compute derived ATEM state from raw state.
 * Pure function — no side effects, no external dependencies.
 */
export function deriveATEMState(raw: ATEMRawState): ATEMDerivedState {
  const topology = [...raw.knownInputIds].sort((a, b) => a - b);

  const tally = topology.map(id => {
    const entry = raw.tallyBySource[id];
    if (!entry) return 0;
    return entry.program ? 1 : entry.preview ? 2 : 0;
  });

  const activeTallyInputs: number[] = [];
  const programInputs: number[] = [];
  const previewInputs: number[] = [];

  topology.forEach((id, i) => {
    const t = tally[i]!;
    if (t === 1) { activeTallyInputs.push(id); programInputs.push(id); }
    else if (t === 2) { activeTallyInputs.push(id); previewInputs.push(id); }
  });

  return { topology, tally, activeTallyInputs, programInputs, previewInputs };
}
