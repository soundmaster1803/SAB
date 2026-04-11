/**
 * bridge/intents/types.ts
 *
 * Minimal type layer for the SAB bridge intent system.
 *
 * These types represent the normalized vocabulary of operations the bridge
 * currently performs. They are the foundation for the intent pipeline:
 *
 *   ATEM event → ControlIntent → capability check → policy check
 *               → conversion → executor → state update
 *
 * Current status (Phase 1 Step 2): types defined, not yet wired into runtime.
 */

// ─── Bridge Property ──────────────────────────────────────────────────────────

/**
 * The set of Sony camera properties the bridge currently controls.
 *
 * These names match the throttle keys already used in canSend() calls
 * throughout src/index.ts — no renaming.
 *
 * Current runtime coverage:
 *   focus      — cat=0 param=0 — focus position delta (notch)
 *   af         — cat=0 param=1 — autofocus trigger (button pulse)
 *   iris       — cat=0 param=2 — iris/aperture (notch via supported list)
 *   iso        — cat=1 param=13 or 14 — ISO gain (notch via supported list)
 *   wb         — cat=1 param=2 — white balance (absolute Kelvin)
 *   shutter    — cat=1 param=5 — shutter speed (notch via supported list)
 */
export type BridgeProperty =
  | 'focus'
  | 'af'
  | 'iris'
  | 'iso'
  | 'wb'
  | 'shutter';

/**
 * Minimal ATEM camera-control payload shape consumed by the bridge decoder.
 *
 * Kept in the bridge domain so decoder logic does not depend on the ATEM
 * transport module directly.
 */
export interface AtemControlPayload {
  source: number;
  category: number;
  parameter: number;
  type: number;
  numberData: number[];
  boolData: boolean[];
}

// ─── Control Intent ───────────────────────────────────────────────────────────

/**
 * A normalized bridge control request, independent of its ATEM wire encoding.
 *
 * ControlIntent is the unit of work that flows through the bridge pipeline:
 *   - created by the intent decoder (future Step 3)
 *   - checked against throttle policy (canSend)
 *   - checked against anti-loop cooldown (future Step 2 Phase 1 / Phase 2)
 *   - converted from ATEM values to Sony values (bridge/mapper)
 *   - dispatched to a Sony executor
 *
 * Not yet instantiated in runtime. Defined here to establish the contract.
 */
export interface ControlIntent {
  /** ID of the target camera (matches CameraConfig.id). */
  cameraId: string;

  /** Which Sony property this intent targets. */
  property: BridgeProperty;

  /**
   * The raw numeric value as received from ATEM, before Sony conversion.
   * Interpretation depends on property:
   *   focus    — float 0.0–1.0 (position)
   *   af       — 1 = trigger, 0 = release
   *   iris     — float f-number (e.g. 2.8)
   *   iso      — integer ISO value or dB gain
   *   wb       — integer Kelvin
   *   shutter  — integer microseconds
   */
  rawValue: number;

  /** Origin of the intent. */
  source: 'atem' | 'api';

  /** Unix timestamp (ms) when the intent was created. */
  timestamp: number;
}
