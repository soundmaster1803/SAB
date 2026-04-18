/**
 * frontend/src/types/ws.ts
 *
 * TypeScript types for all WebSocket messages sent by the SAB backend.
 *
 * These types mirror the exact shapes produced by:
 *   src/api/ws/broadcaster.ts  — state + logs messages
 *   src/api/viewmodels/camera.ts — uiState() payload
 *   src/api/viewmodels/atem.ts   — uiAtemState() payload
 *
 * Do NOT import from src/ here. Types are manually kept in sync with the
 * backend. If the server shape changes, update this file.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Tally state code: 0 = none, 1 = program, 2 = preview. */
export type TallyCode = 0 | 1 | 2;

/** PTP session mode negotiated during handshake. */
export type SessionMode = 'ptp2' | 'ptp3';

/** Battery severity bucket from SonyAlertState. */
export type BatterySeverity = 'ok' | 'low' | 'critical' | 'charging' | 'unknown';

/** Remaining record time severity bucket from SonyAlertState. */
export type RecRemainingSeverity = 'ok' | 'low' | 'critical' | 'unknown';

// ─── Sony state layers ────────────────────────────────────────────────────────

/**
 * Raw Sony camera state as parsed from PTP polling.
 * These are the wire values before any display formatting.
 */
export interface SonyRawState {
  id: string;
  ip: string;
  name: string;
  model?: string;
  connected: boolean;
  /** ISO — raw masked UINT16; 0x00FFFFFF = AUTO. */
  iso: number;
  /** F-number — raw UINT16 × 100 (e.g. 280 = f/2.8). */
  fnumber: number;
  /** Shutter — raw UINT32 fraction: (numerator<<16)|denominator. */
  shutter: number;
  /** Exposure compensation — raw INT16; divide by 1000 for EV. */
  expComp: number;
  /** Color temperature in Kelvin. */
  colorTemp: number;
  /** Battery remaining as percentage 0–100. */
  battery: number;
  /** Power source from prop 0xD03A. 0=unknown, 1=DC/AC, 2=Battery, 3=PoE. */
  powerSource: number;
  /** Battery remaining in minutes from prop 0xD038. 0=unknown. */
  batteryMinutes: number;
  /** True when camera is on AC power or PoE. */
  charging: boolean;
  /** Recording state: 0 = idle, 1 = recording. */
  recState: number;
  /** Remaining recordable time in seconds; 0 = unknown. */
  recRemainSec: number;
  /** Tally state: 0 = none, 1 = program, 2 = preview. */
  tally: TallyCode;
  fps?: number;
  /** Epoch ms of the last poll cycle that produced a state change. */
  lastUpdate: number;
  /**
   * Focus mode from prop 0x500A.
   * 0x0001=MF, 0x0002=AF-S, 0x8004=AF-C, 0x8005=AF-A, 0x8006=DMF, 0x8009=PF. 0=unknown.
   */
  focusMode: number;
  /** AF status from prop 0xD213. 0x02=focused, 0x03=not focused, 0x05=tracking. 0=unknown. */
  afStatus: number;
  /** Focal distance raw from prop 0xD004. Divide by 100 for meters. 0=unknown, 0xFFFF=∞. */
  focalDistanceM: number;
}

/** Derived display values computed from SonyRawState. */
export interface SonyDerivedState {
  isoDisplay: string;
  shutterDisplay: string;
  fnumberDisplay: string;
  colorTempDisplay: string;
  expCompEv: number;
  expCompDisplay: string;
  /** Focus mode as display string — "MF", "AF-S", "AF-C", "AF-A", "DMF", "PF", or "—". */
  focusModeDisplay: string;
  /** AF status as display string — "Focused", "Tracking", "Searching", or "—". */
  afStatusDisplay: string;
  /** Focal distance as display string — e.g. "0.20m", "∞", or "—". */
  focalDistanceDisplay: string;
}

/** Alert conditions derived from raw + derived Sony state. */
export interface SonyAlertState {
  connectionLost: boolean;
  batterySeverity: BatterySeverity;
  lowBattery: boolean;
  criticalBattery: boolean;
  recRemaining: RecRemainingSeverity;
}

// ─── Runtime capabilities ─────────────────────────────────────────────────────

/**
 * Capability flags derived from live PTP polling data.
 * Set only if the camera's polling blob contained the relevant prop code.
 * Mirrors RuntimeCapabilities from src/sony/runtime/types.ts.
 */
export interface RuntimeCapabilities {
  hasISO: boolean;
  hasShutter: boolean;
  hasFNumber: boolean;
  hasExpComp: boolean;
  hasExposureMode: boolean;
  hasRecState: boolean;
  hasMovieRecButton: boolean;
  hasBattery: boolean;
  hasFocusMode: boolean;
  hasMfNearFar: boolean;
  hasFocusPosition: boolean;
  hasSubjectRecognition: boolean;
  hasAfTransitionSpeed: boolean;
  hasWhiteBalance: boolean;
  hasColorTemp: boolean;
  hasWbTint: boolean;
  hasTouchOperation: boolean;
  hasMonitorLut: boolean;
  hasGammaDisplayAssist: boolean;
  hasHdmiOsd: boolean;
  hasHdmiTimecodeControl: boolean;
  hasSilentMode: boolean;
  hasStabilization: boolean;
  hasPictureProfile: boolean;
  hasCreativeLook: boolean;
  hasSAndQ: boolean;
  hasIntervalRec: boolean;
  hasUserBits: boolean;
  hasFocusBracketing: boolean;
  hasTallyLamps: boolean;
  hasStreaming: boolean;
  hasNdFilter: boolean;
  hasBodyKeyLock: boolean;
}

/** Runtime info summary included when the camera's runtime model has been built. */
export interface RuntimeInfo {
  ptpVersion: string;
  sessionMode: SessionMode;
  knownPropCount: number;
  unknownPropCount: number;
}

// ─── Camera UI payload ────────────────────────────────────────────────────────

/**
 * Per-camera state object included in every `state` WS message.
 *
 * Top-level `iso`, `shutter`, `fnumber`, `colorTemp` are display strings
 * (overrides from derived state). Use `raw.*` for numeric wire values.
 */
export interface CameraUIState {
  // ── Identity ────────────────────────────────────────────────────────────────
  id: string;
  ip: string;
  name: string;
  model?: string;
  connected: boolean;

  // ── Display values (formatted strings from derived state) ────────────────────
  /** ISO display string — "AUTO" or numeric (e.g. "800"). */
  iso: string;
  /** Shutter display string — e.g. "1/100", "2.0\"". */
  shutter: string;
  /** F-number display string — e.g. "2.8". UI prepends "f/". */
  fnumber: string;
  /** Color temperature display string — e.g. "5500K". */
  colorTemp: string;

  // ── Raw numeric values still present at top level ────────────────────────────
  expComp: number;
  battery: number;
  powerSource: number;
  batteryMinutes: number;
  charging: boolean;
  recState: number;
  recRemainSec: number;
  tally: TallyCode;
  fps?: number;
  lastUpdate: number;

  // ── Full state layers ────────────────────────────────────────────────────────
  raw: SonyRawState;
  derived: SonyDerivedState;
  alerts: SonyAlertState;

  // ── Config fields ────────────────────────────────────────────────────────────
  atemInput: number;
  atemControlEnabled: boolean;

  // ── Runtime model (present after first successful poll) ──────────────────────
  runtimeInfo?: RuntimeInfo;
  capabilities?: RuntimeCapabilities;
}

// ─── ATEM state ───────────────────────────────────────────────────────────────

/**
 * ATEM switcher state included in every `state` WS message.
 * Flattened from uiAtemState() viewmodel output.
 */
export interface AtemUIState {
  connected: boolean;
  model: string;
  inputCount: number;
  /** Per-input tally codes, positionally ordered by topology. */
  tally: TallyCode[];
  /** Sorted camera input IDs (1-indexed). Positional index matches tally[]. */
  topology: number[];
}

// ─── WS messages ─────────────────────────────────────────────────────────────

/** Full state snapshot broadcast every 500ms. */
export interface WsStateMessage {
  type: 'state';
  version: string;
  cameras: CameraUIState[];
  atemIp: string;
  atemConnected: boolean;
  atemModel: string;
  inputCount: number;
  tally: TallyCode[];
  topology: number[];
}

/** Log entry batch flushed every 150ms. */
export interface WsLogsMessage {
  type: 'logs';
  entries: LogEntry[];
}

/** A single log entry from the backend log bus. */
export interface LogEntry {
  category: string;
  text: string;
  timestamp: string;
}

/** Union of all possible WS message types. */
export type WsMessage = WsStateMessage | WsLogsMessage;
