/**
 * sony/runtime/types.ts
 *
 * Types for the runtime-discovered camera model.
 *
 * The runtime camera model is the primary source of truth for what a connected
 * camera actually supports. It is built at connect time from live device data
 * (GetDeviceInfo + polling blob) and enriched with the protocol knowledge layer.
 *
 * Static model specs (src/sony/models/) are secondary hints only — they may
 * refine quirks but must never override live observed capability.
 */

import type {
  PropKnowledgeEntry,
  SafetyLevel,
  PollPriority,
  PropConfidence,
  PropCategory,
  UIWidget,
} from '../protocol/prop-knowledge.js';

export type { SafetyLevel, PollPriority, PropConfidence, PropCategory, UIWidget };

// ─── Prop source / origin ─────────────────────────────────────────────────────

/**
 * How this property descriptor was established.
 *   live            — observed from camera during polling, no knowledge match
 *   live+enriched   — observed from camera AND matched to protocol knowledge
 *   provisional     — in knowledge layer as provisional/inferred; not observed live
 */
export type PropSource = 'live' | 'live+enriched' | 'provisional';

// ─── Known prop descriptor ────────────────────────────────────────────────────

/**
 * A property that the camera actually reported during polling.
 * May be enriched with protocol knowledge or left as raw-only.
 */
export interface RuntimePropDescriptor {
  // ── Identity ────────────────────────────────────────────────────────────────
  propCode: number;

  // ── Raw device data (always present for observed props) ─────────────────────
  /** PTP data type code (0x0002=UINT8, 0x0004=UINT16, 0x0005=UINT32, etc.). */
  dataType: number;
  /** Current value as read from camera. */
  currentValue: number;
  /** Default value as reported in descriptor. */
  defaultValue: number;
  /**
   * Form flag from PTP descriptor.
   *   0x00 = no form, 0x01 = range, 0x02 = enumeration
   */
  formFlag: number;
  /**
   * Enum values as reported by the camera.
   * Use these for round-trip writes — never substitute knowledge-layer fallbacks
   * for live enum lists.
   */
  enumValues: number[];
  /** Range descriptor if formFlag === 0x01. */
  range?: { min: number; max: number; step: number };

  // ── Enrichment from protocol knowledge ─────────────────────────────────────
  /**
   * Protocol knowledge entry for this prop, if known.
   * Null for live-only (unmapped) known properties.
   */
  knowledge: PropKnowledgeEntry | null;

  // ── Source tracking ─────────────────────────────────────────────────────────
  source: PropSource;
  /** Whether the camera reported this property during polling. Always true here. */
  observed: true;

  // ── Derived safety / scheduling ─────────────────────────────────────────────
  /**
   * Safety classification:
   *   - From knowledge entry if available
   *   - 'read-only' if no knowledge and camera didn't enumerate
   *   - 'safe' if writable but no knowledge entry
   */
  safety: SafetyLevel;
  /**
   * Effective poll priority:
   *   - From knowledge entry if available
   *   - 'low' default for unknown writable props
   *   - 'on-demand' for unknown read-only props without knowledge
   */
  pollPriority: PollPriority;
  /**
   * UI widget suggestion:
   *   - From knowledge entry
   *   - 'debug-only' default for unknown props
   */
  uiWidget: UIWidget;
  /** Whether this property is known to accept writes (camera-reported + knowledge). */
  writable: boolean;
}

// ─── Unknown prop descriptor ─────────────────────────────────────────────────

/**
 * A property that the camera reported but that does not appear in the protocol
 * knowledge layer.
 *
 * Unknown properties must:
 * - Never crash the parser
 * - Never be silently discarded
 * - Never be automatically polled at high priority
 * - Never be written without explicit promotion to 'provisional' or 'confirmed'
 */
export interface UnknownPropDescriptor {
  propCode: number;
  dataType: number;
  currentValue: number;
  defaultValue: number;
  formFlag: number;
  enumValues: number[];
  range?: { min: number; max: number; step: number };
  /** The protocol version active when this was observed. */
  protocolVersion?: string;
  /** Camera model + firmware context at observation time. */
  modelContext?: string;
  /** Always 'unknown' — must be promoted before use. */
  confidence: 'unknown';
  /** Always false — unknown props must not be written. */
  safeToWrite: false;
  /** Always 'debug' — hidden from normal UI. */
  visibility: 'debug';
  /**
   * Optional candidate interpretation provided by research.
   * Set manually or via future promotion workflow.
   */
  candidateInterpretation?: string;
  /**
   * Promotion state for research workflow.
   *   unknown     — not yet interpreted
   *   provisional — candidate interpretation proposed, not confirmed
   *   confirmed   — moved to protocol knowledge layer (should no longer appear here)
   */
  promotionState: 'unknown' | 'provisional' | 'confirmed';
}

// ─── Runtime capability summary ───────────────────────────────────────────────

/**
 * Capability flags derived from what the camera actually reported.
 * These are set only if the corresponding prop was observed in polling data.
 *
 * Never assume a capability is present. Always check observed props first.
 */
export interface RuntimeCapabilities {
  // --- Exposure ---
  hasISO: boolean;             // 0xD21E observed
  hasShutter: boolean;         // 0xD20D observed
  hasFNumber: boolean;         // 0x5007 observed
  hasExpComp: boolean;         // 0x5010 observed
  hasExposureMode: boolean;    // 0x500E observed

  // --- Recording ---
  hasRecState: boolean;        // 0xD21D observed
  hasMovieRecButton: boolean;  // 0xD2C8 observed

  // --- Battery ---
  hasBattery: boolean;         // 0xD218 observed

  // --- Focus ---
  hasFocusMode: boolean;       // 0x500A observed
  hasMfNearFar: boolean;       // 0xD2D1 observed
  hasFocusPosition: boolean;   // 0xE042 observed
  hasSubjectRecognition: boolean; // 0xD060 or 0xD157 observed
  hasAfTransitionSpeed: boolean;  // 0xD061 observed

  // --- Color ---
  hasWhiteBalance: boolean;    // 0x5005 observed
  hasColorTemp: boolean;       // 0xD20F observed
  hasWbTint: boolean;          // 0xD21C or 0xD210 observed

  // --- Display ---
  hasTouchOperation: boolean;  // 0xD047 observed
  hasMonitorLut: boolean;      // 0xD04D observed
  hasGammaDisplayAssist: boolean; // 0xD1FE observed

  // --- HDMI ---
  hasHdmiOsd: boolean;         // 0xD079 observed
  hasHdmiTimecodeControl: boolean; // 0xD186 observed

  // --- Silent Mode ---
  hasSilentMode: boolean;      // 0xD0DB observed

  // --- Stabilization ---
  hasStabilization: boolean;   // 0xD0DA observed

  // --- Picture Profile ---
  hasPictureProfile: boolean;  // 0xD23F observed

  // --- Creative Look ---
  hasCreativeLook: boolean;    // 0xD0FA observed

  // --- S&Q ---
  hasSAndQ: boolean;           // 0xD052 or 0xD0D0 observed

  // --- Interval Rec ---
  hasIntervalRec: boolean;     // 0xD055 observed

  // --- User Bits ---
  hasUserBits: boolean;        // 0xD0D4 or 0xD0D8 observed

  // --- Focus Bracketing ---
  hasFocusBracketing: boolean; // 0xD0AB observed

  // --- Tally ---
  hasTallyLamps: boolean;      // 0xD513 observed

  // --- Streaming ---
  hasStreaming: boolean;        // 0xD450 or 0xD456 observed

  // --- ND filter ---
  hasNdFilter: boolean;        // 0xD018 observed

  // --- Body key lock ---
  hasBodyKeyLock: boolean;     // 0xD04A observed
}

// ─── Runtime camera model ─────────────────────────────────────────────────────

/**
 * The runtime-discovered camera model.
 *
 * Built once at connect time and updated incrementally as polling produces
 * new data. This is the primary source of truth for what the camera supports.
 *
 * Use this to:
 * - Gate which controls and UI panels are visible
 * - Determine poll priorities dynamically
 * - Decide which actions the bridge may issue
 * - Expose debug / service information
 */
export interface RuntimeCameraModel {
  // ── Identity ────────────────────────────────────────────────────────────────
  cameraId: string;
  model: string;
  firmware: string;
  manufacturer: string;
  serial: string;
  /** Protocol version string as reported by GetDeviceInfo (e.g. 'PTP3.00'). */
  ptpVersion: string;
  /** Whether the session is using the PTP3 extended SDIO protocol. */
  sessionMode: 'ptp2' | 'ptp3';

  // ── Timestamps ──────────────────────────────────────────────────────────────
  /** Epoch ms when this model was first built (at connect time). */
  builtAt: number;
  /** Epoch ms of the last polling cycle that updated this model. */
  lastUpdatedAt: number;

  // ── Discovered properties ───────────────────────────────────────────────────
  /**
   * All properties that the camera exposed AND that are in the protocol
   * knowledge layer (known props). Keyed by propCode.
   */
  knownProps: Map<number, RuntimePropDescriptor>;

  /**
   * Properties the camera exposed that are NOT in the knowledge layer.
   * These must be preserved, never discarded.
   * Keyed by propCode.
   */
  unknownProps: Map<number, UnknownPropDescriptor>;

  // ── Derived capability summary ───────────────────────────────────────────────
  /**
   * Capability flags computed from which props were actually observed.
   * Use this to gate runtime behaviour and UI visibility.
   */
  capabilities: RuntimeCapabilities;

  // ── Poll tiers (computed from knowledge + observed set) ──────────────────────
  /** Prop codes to poll at HIGH priority (~200 ms). */
  highPriorityProps: number[];
  /** Prop codes to poll at LOW priority (~1 000 ms). */
  lowPriorityProps: number[];
  /** Prop codes to refresh only on explicit request. */
  onDemandProps: number[];
  /**
   * Prop codes explicitly excluded from polling.
   * Includes: tally lamps (bridge writes only), format ops, firmware commands,
   * BaseLook import ops, vendor markers.
   */
  skipProps: number[];
}
