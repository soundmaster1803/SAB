/**
 * atem/models/types.ts
 *
 * ATEM switcher model specification types.
 *
 * These types define the structure of a static model spec for each supported
 * ATEM switcher family. They are used in Phase 8+ to gate actions, feedbacks,
 * and sync behaviours by confirmed switcher capabilities.
 *
 * Source of truth: atem-connection library behaviour, Blackmagic Camera Control
 * Protocol v1.3 documentation, and empirical testing captured in
 * src/bridge/atem-decoder.ts.
 *
 * Phase: skeleton only — not wired into runtime yet.
 */

// ─── Capability flags ─────────────────────────────────────────────────────────

/**
 * Capability flags for an ATEM switcher family.
 *
 * Set a flag to `true` only if confirmed by at least one of:
 *   1. Empirical runtime observation (atem-connection events or atem.state fields)
 *   2. Blackmagic Camera Control Protocol documentation
 *   3. Explicit live-test confirmation from the project owner
 *
 * Leave as `false` if unconfirmed. Never assume.
 *
 * Current flags are grounded in what ATEMListener already does in production:
 *   - src/atem/listener.ts   — transport events, tally, camera control
 *   - src/bridge/sync/atem-sync.ts — reverse sync push
 *   - atem.state.info.deviceName getter (ATEMListener.atemModel)
 *   - atem.state.inputs keys (ATEMListener.inputCount)
 */
export interface ATEMCapabilities {
  // --- Camera control (Blackmagic Camera Control Protocol) ---

  /**
   * Switcher sends CameraControlUpdateCommand events for camera control
   * parameters (focus, iris, gain, shutter, WB — categories 0 and 1).
   * Confirmed via live testing with ATEMListener.handleCameraControl().
   */
  cameraControl: boolean;

  /**
   * Bridge can push camera state back to the switcher via
   * atem-connection setCameraControlInput() (used in atem-sync.ts).
   * Required for bi-directional ATEM↔Sony sync.
   */
  reverseCameraControlSync: boolean;

  // --- Tally ---

  /**
   * Switcher sends TallyBySourceCommand events with per-source program/preview state.
   * Confirmed via live testing with ATEMListener.handleTally().
   * NOTE: TallyBySourceCommand does NOT apply to atem.state — must be captured
   * from receivedCommands manually (see listener.ts comment).
   */
  tallyBySource: boolean;

  // --- Device info ---

  /**
   * Device name string is readable from atem.state.info.deviceName after connect.
   * Exposed via ATEMListener.atemModel getter.
   * Example values: "ATEM Mini Pro", "ATEM 2 M/E Production Studio 4K".
   */
  modelDiscovery: boolean;

  /**
   * Camera input IDs in range 1–20 are enumerable from atem.state.inputs keys.
   * Used by ATEMListener.inputCount getter and ATEMDerivedState.topology.
   */
  inputTopology: boolean;
}

// ─── Model spec ───────────────────────────────────────────────────────────────

/**
 * Static specification for an ATEM switcher family.
 *
 * One spec covers all variants within a family where capabilities are identical
 * from the atem-connection perspective (e.g. "ATEM Mini" family covers
 * ATEM Mini, ATEM Mini Pro, and ATEM Mini Pro ISO).
 *
 * This spec is a compile-time constant — it does not change at runtime.
 *
 * NOTE: Unlike Sony cameras, all ATEM switchers known to this project today
 * share the same capability profile at the protocol level. Per-model specs
 * should only be added when a confirmed capability difference is documented.
 */
export interface ATEMModelSpec {
  /** Human-readable switcher family name. */
  name: string;

  /**
   * Model name substrings to match against the device name returned by
   * ATEMListener.atemModel (i.e. atem.state.info.deviceName).
   *
   * Matching is substring-based (case-insensitive) to accommodate ATEM's
   * free-text model string format. An empty array means this spec is
   * generic/fallback — it matches any model not covered by a named spec.
   *
   * Example: ["ATEM Mini"] matches "ATEM Mini", "ATEM Mini Pro", "ATEM Mini Pro ISO".
   */
  modelNamePatterns: string[];

  /**
   * Whether this spec is a verified specification or a conservative generic fallback.
   *
   * - `'confirmed'` — capabilities derived from hardware testing or BMD documentation.
   * - `'generic'`   — conservative placeholder assuming all currently-used capabilities
   *                   are supported. Used when per-model confirmation is not yet available.
   *                   Do not add new capability flags to generic specs without confirmation.
   */
  status: 'confirmed' | 'generic';

  /** Structured capability flags. */
  capabilities: ATEMCapabilities;

  /**
   * Free-text notes about firmware quirks, protocol version dependencies,
   * or known issues with this model family.
   */
  notes?: string[];
}
