/**
 * atem/state/raw.ts
 *
 * Raw ATEM switcher state — values as observed directly from the atem-connection
 * transport layer.
 *
 * Every field here is grounded in data that ATEMListener already holds today.
 * Do not add fields unless they are confirmed to be produced by the transport.
 *
 * Reference:
 *   - src/atem/listener.ts     — ATEMListener fields and getters
 *   - src/api/ws/broadcaster.ts — ATEM fields included in WS state broadcast
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 6).
 */

// ─── Tally ────────────────────────────────────────────────────────────────────

/**
 * Tally state for a single ATEM source input.
 *
 * Mirrors ATEMListener.TallyEntry from listener.ts.
 * Defined here so the ATEM state layer does not depend on the listener module.
 */
export interface AtemTallyEntry {
  /** True when this input is on the program bus. */
  program: boolean;
  /** True when this input is on the preview bus. */
  preview: boolean;
}

// ─── Raw State ────────────────────────────────────────────────────────────────

/**
 * Raw ATEM switcher state as observed from the atem-connection transport.
 *
 * Field notes:
 *   - `connected`      directly from ATEMListener.connected
 *   - `model`          from atem.state.info.deviceName (via ATEMListener.atemModel)
 *   - `knownInputIds`  camera input IDs in range 1–20 from atem.state.inputs keys
 *                      (same filter used in broadcaster.ts for the tally array)
 *   - `tallyBySource`  keyed by 1-indexed source input number; only inputs with
 *                      any tally activity are present (TallyBySourceCommand data)
 *   - `readyAfterMs`   epoch ms until which the bridge suppresses commands —
 *                      set to Date.now() + 3000 on every connect() call to
 *                      discard the full-state dump the ATEM sends on connect.
 *                      Not a user-visible field; stored here so bridge policies
 *                      can check it without reaching into the listener.
 */
export interface ATEMRawState {
  /** True while the atem-connection TCP session is active. */
  connected: boolean;

  /**
   * ATEM device name string as reported by the switcher.
   * Example: "ATEM Mini Pro", "ATEM 2 M/E Production Studio 4K".
   * Empty string when not yet connected.
   */
  model: string;

  /**
   * Sorted list of camera input IDs in range 1–20.
   * Derived from atem.state.inputs keys, filtered and sorted.
   * Used to build the tally array in the correct positional order.
   */
  knownInputIds: number[];

  /**
   * Per-input tally state keyed by 1-indexed source input number.
   * Only inputs with a tally event are present; absent key = no tally.
   * Updated by TallyBySourceCommand (captured manually — does not apply to atem.state).
   */
  tallyBySource: Record<number, AtemTallyEntry>;

  /**
   * Epoch ms after which bridge commands may be dispatched.
   * The ATEM sends a full state dump on every connect which contains stale/bogus
   * values. The listener sets this to Date.now() + 3000 on connect() to suppress
   * the initial command flood.
   */
  readyAfterMs: number;
}
