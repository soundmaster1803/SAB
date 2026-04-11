/**
 * Sony model specification types.
 *
 * These types define the structure of a static model spec for each supported
 * Sony camera family. They are used in Phase 4+ to gate actions, feedbacks,
 * and presets by confirmed camera capabilities.
 *
 * Source of truth: knowledge/model-specs/sony/ and docs/research/ref-cameras.md
 */

/** PTP protocol generation supported by this camera family. */
export type SonyPtpVersion = 'ptp2' | 'ptp3-v1.0' | 'ptp3-v1.2' | 'ptp3-v1.3';

/**
 * Capability flags for a Sony camera family.
 *
 * Only set a flag to `true` if confirmed by at least one of:
 *   1. Official Sony SDK / protocol documentation
 *   2. Captured hardware PTP log showing the property/opcode in active use
 *   3. Explicit live-test confirmation from the project owner
 *
 * Leave as `false` or omit if unconfirmed. Never assume.
 */
export interface SonyCapabilities {
  // --- Exposure ---
  /** Camera exposes ISO via 0xD21E (UINT32 direct value). */
  iso: boolean;
  /** Camera exposes ShutterSpeed via 0xD20D (UINT32 fraction encoding). */
  shutterSpeed: boolean;
  /** Camera exposes FNumber via 0x5007 (UINT16 × 100). */
  fNumber: boolean;
  /** Camera exposes ExposureCompensation via 0x5010 (INT16 × 1000). */
  exposureComp: boolean;

  // --- Recording ---
  /** Camera exposes recording state via 0xD21D. */
  recordingState: boolean;
  /** MovieRec button (0xD2C8) is available and toggles recording. */
  movieRecButton: boolean;

  // --- Power / status ---
  /** Battery remaining (0xD218) is available. */
  batteryRemain: boolean;

  // --- Focus ---
  /** FocusMode (0x500A) is available. */
  focusMode: boolean;
  /** MF NearFar notch (0xD2D1) is available for manual focus adjustment. */
  mfNearFar: boolean;
  /**
   * Absolute focus position control via 0xD380/0xD381.
   * Requires PTP3 v1.0+.
   */
  focusPosition: boolean;

  // --- White balance ---
  /** WhiteBalance mode (0x5005) is available. */
  whiteBalance: boolean;
  /** ColorTemp (0xD20F) in Kelvin is available for manual WB. */
  colorTemp: boolean;
  /** WB tint: Amber-Blue (0xD21C) and Green-Magenta (0xD210). */
  wbTint: boolean;

  // --- HDMI ---
  /**
   * HDMI output control (0xD3A0 range) is available.
   * Requires PTP3 v1.0+.
   */
  hdmiControl: boolean;
  /**
   * HDMI timecode output (0xD3A7) and record trigger (0xD3A8) are available.
   * Requires PTP3 v1.0+.
   */
  hdmiTimecodeRecControl: boolean;

  // --- Lens ---
  /**
   * Lens model name (0xD3B0) and serial (0xD3B1) are readable.
   * Requires PTP3 v1.0+.
   */
  lensInfo: boolean;

  // --- Tally ---
  /**
   * Hardware tally lamps (0xD513 Red, 0xD514 Green, 0xD515 Yellow) are available.
   * Requires PTP3 v1.3+.
   */
  tallyLamps: boolean;

  // --- ND filter ---
  /**
   * Built-in ND filter (0xD474 ND_FilterSetting) is available.
   * Only on cameras with hardware ND (e.g. FX3, FX6 — NOT FX30, ZV-E10 II).
   */
  ndFilter: boolean;

  // --- Streaming ---
  /**
   * Live streaming over IP (0xD450–0xD45B, 0xD511) is available.
   * Requires PTP3 v1.2+.
   */
  streaming: boolean;

  // --- PTZ ---
  /**
   * Pan-Tilt-Zoom control (0xD504–0xD50B) is available.
   * Only on PTZ camera units. Requires PTP3 v1.3+.
   */
  panTiltZoom: boolean;
}

/**
 * Static specification for a Sony camera family.
 *
 * One spec covers all variants within a family (e.g. FX30 covers ILME-FX30 and ILME-FX30B).
 * This spec is a compile-time constant — it does not change at runtime.
 *
 * Runtime capability detection (via SDIOGetExtDeviceInfo prop list) may further restrict
 * which capabilities are active for a connected camera, but never expands beyond this spec.
 */
export interface SonyModelSpec {
  /** Human-readable camera family name. */
  name: string;
  /** Sony model identifiers that map to this spec (as reported by GetDeviceInfo). */
  modelIds: string[];
  /** PTP protocol version supported by this family. */
  ptpVersion: SonyPtpVersion;
  /**
   * Whether this spec is a verified specification or an unverified stub.
   *
   * - `'confirmed'` — capabilities derived from SDK docs and/or live-test confirmation.
   * - `'stub'`      — PTP version is documented but individual capabilities are unverified.
   *                   All capability flags default to `false`. Do not act on stub specs.
   */
  status: 'confirmed' | 'stub';
  /** Structured capability flags. */
  capabilities: SonyCapabilities;
  /** Free-text notes about firmware quirks, version dependencies, or known issues. */
  notes?: string[];
}
