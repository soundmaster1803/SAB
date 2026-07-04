/**
 * sony/protocol/prop-knowledge.ts
 *
 * Protocol-centric knowledge layer for Sony PTP/PTP3 property codes.
 *
 * This file maps known propCodes to their semantic meaning, type, enum decoding,
 * write safety, polling priority, and UI hints.
 *
 * Design principles:
 * - This layer NEVER assumes a camera supports a property.
 *   A property becomes active for a runtime model only if the camera actually
 *   reports it during polling.
 * - Confidence levels: 'confirmed' (SDK docs + hardware) → 'high' → 'medium'
 *   → 'provisional' → 'inferred' (context-only reasoning).
 * - Low-confidence entries are marked provisional and must not expose controls
 *   by default.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PropCategory =
  | 'exposure'
  | 'focus'
  | 'color'
  | 'recording'
  | 'media'
  | 'battery'
  | 'streaming'
  | 'display'
  | 'audio'
  | 'network'
  | 'system'
  | 'lens'
  | 'stabilization'
  | 'bracketing'
  | 'ptp'
  | 'lut'
  | 'picture-profile'
  | 'creative-look'
  | 'subject-recognition'
  | 'hdmi'
  | 'alerts'
  | 'other';

/**
 * Safety classification for a property or control.
 *   safe        — routine use, safe for operators and bridge automation
 *   advanced    — configuration-level, show in advanced UI, safe to write
 *   risky       — one-time or service operations; write only with confirmation
 *   dangerous   — destructive (delete, format, firmware) — gate with explicit confirmation
 *   read-only   — camera does not accept writes
 */
export type SafetyLevel = 'safe' | 'advanced' | 'risky' | 'dangerous' | 'read-only';

/**
 * Polling priority for this property.
 *   high      — poll every ~200 ms (exposure, rec state, battery)
 *   low       — poll every ~1 000 ms (display/config settings)
 *   on-demand — only refresh when explicitly requested
 *   skip      — do not poll (vendor markers, firmware commands, format ops)
 */
export type PollPriority = 'high' | 'low' | 'on-demand' | 'skip';

/**
 * Knowledge confidence level.
 *   confirmed   — from official Sony SDK/protocol docs AND hardware-verified
 *   high        — from official docs, not yet hardware-verified
 *   medium      — from official docs, field meaning inferred by context
 *   provisional — plausible interpretation, not confirmed
 *   inferred    — context-only reasoning from neighbour codes in blob
 */
export type PropConfidence = 'confirmed' | 'high' | 'medium' | 'provisional' | 'inferred';

/** PTP data type hint (descriptive string, not the wire numeric). */
export type DataTypeHint =
  | 'UINT8' | 'INT8' | 'UINT16' | 'INT16' | 'UINT32' | 'INT32' | 'UINT64'
  | 'STRING' | 'ARRAY' | 'STRUCT' | 'MASK32' | 'unknown';

/** UI widget suggestion for the operator console. */
export type UIWidget =
  | 'slider'
  | 'enum-select'
  | 'stepper'
  | 'toggle'
  | 'read-only'
  | 'hidden'
  | 'debug-only';

export interface PropKnowledgeEntry {
  propCode: number;
  /** Machine-readable semantic identifier (snake_case). */
  semanticId: string;
  /** Human-readable display name. */
  name: string;
  category: PropCategory;
  dataType: DataTypeHint;
  /** Whether the property supports PTP Set operations. */
  writable: boolean;
  /**
   * Whether it is safe to write this property without special preconditions.
   * False for risky/dangerous ops even when writable.
   */
  safeToWrite: boolean;
  pollPriority: PollPriority;
  safety: SafetyLevel;
  confidence: PropConfidence;
  /** Suggested UI widget. 'debug-only' = visible in service panel only. */
  uiWidget: UIWidget;
  /** Known enum value → label mapping. Prefer live enum list if camera provides one. */
  enumDecoding?: Record<number, string>;
  /** Fallback range when camera does not return range descriptor. */
  fallbackRange?: { min: number; max: number };
  /** True if this property should raise an alert condition when changed. */
  alertRelevant: boolean;
  /** Additional notes about quirks, version requirements, or usage. */
  notes?: string;
}

// ─── Knowledge entries ───────────────────────────────────────────────────────

const RAW_ENTRIES: PropKnowledgeEntry[] = [

  // ──────────────────────────── Standard PTP properties (0x5xxx) ────────────

  {
    propCode: 0x5005, semanticId: 'white_balance', name: 'White Balance',
    category: 'color', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    // Values confirmed against Camera Control PTP 3 Reference (raw wire values).
    enumDecoding: {
      1: 'Manual', 2: 'Auto (AWB)', 3: 'One-push Auto', 4: 'Daylight',
      5: 'Fluorescent', 6: 'Tungsten', 7: 'Flash',
      0x8001: 'Fluor: Warm White', 0x8002: 'Fluor: Cool White',
      0x8003: 'Fluor: Day White', 0x8004: 'Fluor: Daylight',
      0x8010: 'Cloudy', 0x8011: 'Shade', 0x8012: 'Color Temp',
      0x8020: 'Custom 1', 0x8021: 'Custom 2', 0x8022: 'Custom 3', 0x8023: 'Custom',
      0x8030: 'Underwater Auto',
    },
    alertRelevant: false,
  },
  {
    propCode: 0x5007, semanticId: 'fnumber', name: 'F-Number',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Value × 100; e.g. 280 = f/2.8',
  },
  {
    propCode: 0x500A, semanticId: 'focus_mode', name: 'Focus Mode',
    category: 'focus', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 1: 'MF', 2: 'AF', 0x8004: 'DMF', 0x8005: 'AF-S', 0x8006: 'AF-C', 0x8007: 'AF-A' },
    alertRelevant: false,
  },
  {
    propCode: 0x500B, semanticId: 'metering_mode', name: 'Metering Mode',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Average', 2: 'Center Weighted', 3: 'Multi Spot', 4: 'Center Spot', 0x8001: 'Multi Segment', 0x8002: 'Center', 0x8004: 'Spot', 0x8006: 'Highlight' },
    alertRelevant: false,
  },
  {
    propCode: 0x500E, semanticId: 'exposure_mode', name: 'Exposure Mode',
    category: 'exposure', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    // UINT32 wire values confirmed against Camera Control PTP 3 Reference.
    // Stills M/P/A/S plus the movie-mode block used by FX/cinema bodies.
    enumDecoding: {
      0x00000001: 'M', 0x00010002: 'P', 0x00020003: 'A', 0x00030004: 'S',
      0x00048000: 'Auto', 0x00048001: 'Auto+',
      0x00078050: 'Movie (P)', 0x00078051: 'Movie (A)', 0x00078052: 'Movie (S)',
      0x00078053: 'Movie (M)', 0x00078054: 'Movie (Auto)', 0x00078090: 'Movie (F)',
      0x00098059: 'S&Q (P)', 0x0009805A: 'S&Q (A)', 0x0009805B: 'S&Q (S)',
      0x0009805C: 'S&Q (M)', 0x0009805D: 'S&Q (Auto)',
    },
    alertRelevant: false,
  },
  {
    propCode: 0x5010, semanticId: 'exposure_comp', name: 'Exposure Compensation',
    category: 'exposure', dataType: 'INT16', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Raw INT16 / 1000 = EV value',
  },
  {
    propCode: 0x5013, semanticId: 'drive_mode', name: 'Drive Mode',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Single', 0x8001: 'Cont Hi', 0x8002: 'Cont Mid', 0x8003: 'Cont Lo', 0x8004: 'Timer 2s', 0x8005: 'Timer 10s', 0x8010: 'Interval' },
    alertRelevant: false,
  },

  // ──────────────────────────── Sony vendor props (0xDxxx) ─────────────────

  // --- Exposure / Cinema exposure ---
  {
    propCode: 0xD000, semanticId: 't_number', name: 'T-Number',
    category: 'exposure', dataType: 'UINT16', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: false, notes: 'Value × 100; cinema lens T-stop',
  },
  {
    propCode: 0xD00E, semanticId: 'shutter_angle', name: 'Shutter Angle',
    category: 'exposure', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Value × 100; degrees × 100',
  },
  {
    propCode: 0xD010, semanticId: 'shutter_mode', name: 'Shutter Mode',
    category: 'exposure', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 1: 'Speed', 2: 'Angle', 3: 'ECS' },
    alertRelevant: false,
  },
  {
    propCode: 0xD01C, semanticId: 'gain_control_setting', name: 'Gain Control Setting',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Manual', 2: 'Auto', 3: 'ISO' },
    alertRelevant: false,
  },
  {
    propCode: 0xD01E, semanticId: 'gain_db', name: 'Gain dB',
    category: 'exposure', dataType: 'INT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Value / 10 = dB',
  },
  {
    propCode: 0xD020, semanticId: 'gain_base_iso', name: 'Gain Base ISO',
    category: 'exposure', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'confirmed', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD022, semanticId: 'exposure_index_ei', name: 'Exposure Index (EI)',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false,
  },

  // --- ND Filter ---
  {
    propCode: 0xD018, semanticId: 'nd_filter', name: 'ND Filter',
    category: 'exposure', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Auto', 0x10002: 'ND4', 0x10003: 'ND8', 0x10004: 'ND16', 0x10005: 'ND32', 0x10006: 'ND64', 0x10007: 'ND128' },
    alertRelevant: false, notes: 'Only cameras with hardware ND (FX3, FX6) — not FX30, ZV-E10 II',
  },
  {
    propCode: 0xD01A, semanticId: 'nd_filter_mode_setting', name: 'ND Filter Mode Setting',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Manual', 2: 'Auto' },
    alertRelevant: false,
  },

  // --- Color / WB ---
  {
    propCode: 0xD200, semanticId: 'flash_compensation', name: 'Flash Compensation',
    category: 'exposure', dataType: 'INT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false,
  },
  {
    propCode: 0xD201, semanticId: 'dro_d_lighting', name: 'DRO / D-Lighting',
    category: 'color', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 0: 'Off', 1: 'Auto', 0x11: 'Lv1', 0x12: 'Lv2', 0x13: 'Lv3', 0x14: 'Lv4', 0x15: 'Lv5' },
    alertRelevant: false,
  },
  {
    propCode: 0xD20D, semanticId: 'shutter_speed', name: 'Shutter Speed',
    category: 'exposure', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Fraction encoding: (numerator<<16)|denominator',
  },
  {
    propCode: 0xD20F, semanticId: 'color_temp', name: 'Color Temperature',
    category: 'color', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Kelvin value; requires WB mode = Color Temp',
  },
  {
    propCode: 0xD210, semanticId: 'wb_shift_gm', name: 'WB Shift G/M',
    category: 'color', dataType: 'INT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false,
  },
  {
    propCode: 0xD21B, semanticId: 'picture_effect', name: 'Picture Effect',
    category: 'color', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 0x8000: 'Off', 0x8001: 'Toy Camera', 0x8002: 'Pop Color', 0x8003: 'Poster', 0x8004: 'Retro', 0x8007: 'Hi Contrast Mono', 0x800A: 'Rich-tone Mono' },
    alertRelevant: false,
  },
  {
    propCode: 0xD21C, semanticId: 'wb_shift_ab', name: 'WB Shift A/B',
    category: 'color', dataType: 'INT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false,
  },
  {
    propCode: 0xD21E, semanticId: 'iso', name: 'ISO',
    category: 'exposure', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'High bytes are flags; mask to low 16 bits for display. 0x00FFFFFF = AUTO. Keep original list value for round-trip writes.',
  },

  // --- Focus ---
  {
    propCode: 0xD213, semanticId: 'af_status', name: 'AF Status',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 1: 'Not Focused', 2: 'Focused', 3: 'Tracking Failed', 4: 'N/A' },
    alertRelevant: false,
  },
  {
    propCode: 0xD22C, semanticId: 'focus_area', name: 'Focus Area',
    category: 'focus', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    // UINT16 wire values confirmed against Camera Control PTP 3 Reference.
    enumDecoding: {
      1: 'Wide', 2: 'Zone', 3: 'Center',
      0x0101: 'Flexible Spot S', 0x0102: 'Flexible Spot M', 0x0103: 'Flexible Spot L',
      0x0104: 'Expand Flexible Spot', 0x0105: 'Flexible Spot',
      0x0106: 'Flexible Spot XS', 0x0107: 'Flexible Spot XL',
      0x0201: 'Lock-on Wide', 0x0202: 'Lock-on Zone', 0x0203: 'Lock-on Center',
    },
    alertRelevant: false,
  },
  {
    propCode: 0xD235, semanticId: 'nearfar_enable', name: 'NearFar Enable',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'Disabled', 1: 'Enabled' },
    alertRelevant: false,
  },
  {
    propCode: 0xD2D1, semanticId: 'mf_near_far', name: 'MF Near/Far Step',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'skip', safety: 'safe', confidence: 'confirmed', uiWidget: 'stepper',
    alertRelevant: false, notes: 'Write-only button-style control; step value 1 = near, 2 = far',
  },
  {
    propCode: 0xD380, semanticId: 'focus_position_raw', name: 'Focus Position (Raw)',
    category: 'focus', dataType: 'UINT16', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: false, notes: 'PTP3 only',
  },
  {
    propCode: 0xD381, semanticId: 'focus_position_pct', name: 'Focus Position (%)',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'confirmed', uiWidget: 'slider',
    alertRelevant: false, notes: 'PTP3 only; 0–100%',
  },

  // --- Recording / Media ---
  {
    propCode: 0xD21D, semanticId: 'rec_state', name: 'Rec State',
    category: 'recording', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'Idle', 1: 'Recording', 2: 'Standby', 4: 'Paused' },
    alertRelevant: true,
  },
  {
    propCode: 0xD241, semanticId: 'movie_file_format', name: 'Movie File Format',
    category: 'recording', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 0x10001: 'XAVC S 4K', 0x10002: 'XAVC S HD', 0x20001: 'XAVC HS 4K', 0x20002: 'XAVC HS HD', 0x30001: 'XAVC S-I 4K', 0x30002: 'XAVC S-I HD', 0x40001: 'AVCHD', 0x50001: 'XAVC I 4K', 0x50002: 'XAVC I HD' },
    alertRelevant: false,
  },
  {
    propCode: 0xD248, semanticId: 'slot1_status', name: 'Slot1 Status',
    category: 'media', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'No Media', 1: 'Normal', 2: 'Error', 3: 'Recording', 4: 'Format Error' },
    alertRelevant: true,
  },
  {
    propCode: 0xD249, semanticId: 'slot1_remaining_shots', name: 'Slot1 Remaining Shots',
    category: 'media', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD24A, semanticId: 'slot1_remaining_time', name: 'Slot1 Remaining Time',
    category: 'media', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD256, semanticId: 'slot2_status', name: 'Slot2 Status',
    category: 'media', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'No Media', 1: 'Normal', 2: 'Error', 3: 'Recording', 4: 'Format Error' },
    alertRelevant: true,
  },
  {
    propCode: 0xD2C8, semanticId: 'movie_rec_button', name: 'Movie Rec Button',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'skip', safety: 'safe', confidence: 'confirmed', uiWidget: 'hidden',
    enumDecoding: { 1: 'Up', 2: 'Down' },
    alertRelevant: false, notes: 'Button trigger; press=2, release=1',
  },
  {
    propCode: 0xD286, semanticId: 'rec_frame_rate', name: 'Rec Frame Rate',
    category: 'recording', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'confirmed', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD120, semanticId: 'rec_duration', name: 'Rec Duration',
    category: 'recording', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD3C2, semanticId: 'slot1_remain_alt', name: 'Slot1 Remaining Time (alt)',
    category: 'media', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD3C4, semanticId: 'slot3_remain_alt', name: 'Slot3 Remaining Time (alt)',
    category: 'media', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: true,
  },

  // --- Battery ---
  {
    propCode: 0xD204, semanticId: 'battery_pct', name: 'Battery %',
    category: 'battery', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD205, semanticId: 'battery_level_icon', name: 'Battery Level Icon',
    category: 'battery', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'Empty', 1: 'Level1', 2: 'Level2', 3: 'Level3', 4: 'Full', 5: 'AC' },
    alertRelevant: true,
  },
  {
    propCode: 0xD20E, semanticId: 'battery_level_step', name: 'Battery Level (step)',
    category: 'battery', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'Empty', 1: 'Level1', 2: 'Level2', 3: 'Full' },
    alertRelevant: true,
  },
  {
    propCode: 0xD218, semanticId: 'battery_remain', name: 'Battery Remain',
    category: 'battery', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true, notes: '>100 signals AC power / charging on some models',
  },
  {
    propCode: 0xD12D, semanticId: 'second_battery_remain', name: 'Second Battery Remaining',
    category: 'battery', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: true, notes: 'Battery grip / external power supply %',
  },
  {
    propCode: 0xD12E, semanticId: 'second_battery_level', name: 'Second Battery Level',
    category: 'battery', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    enumDecoding: { 0: 'Empty', 1: 'Level1', 2: 'Level2', 3: 'Level3', 4: 'Full', 5: 'AC' },
    alertRelevant: true,
  },

  // --- Alerts / System ---
  {
    propCode: 0xD07A, semanticId: 'system_error_info', name: 'System Error Info',
    category: 'alerts', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD251, semanticId: 'overheating_state', name: 'Overheating State',
    category: 'alerts', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'Normal', 1: 'Warning', 2: 'Error' },
    alertRelevant: true,
  },
  {
    propCode: 0xD1BB, semanticId: 'camera_error_status', name: 'Camera Error Status',
    category: 'alerts', dataType: 'UINT16', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD1BC, semanticId: 'system_error_status', name: 'System Error Status',
    category: 'alerts', dataType: 'UINT16', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD194, semanticId: 'camera_shake_status', name: 'Camera Shake Status',
    category: 'alerts', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    enumDecoding: { 1: 'No Error', 2: 'Error' },
    alertRelevant: true,
  },

  // ──────────────────── NEW PTP3 properties from research ──────────────────

  // --- REC / System enable status ---
  {
    propCode: 0xD043, semanticId: 'rec_settings_reset_enable', name: 'REC Settings Reset Enable Status',
    category: 'system', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    enumDecoding: { 0: 'Disable', 1: 'Enable' },
    alertRelevant: false,
  },

  // --- Display ---
  {
    propCode: 0xD044, semanticId: 'monitor_disp_mode_candidates', name: 'Monitor DISP Mode Candidates',
    category: 'display', dataType: 'MASK32', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false, notes: 'Bitmask of available display modes',
  },
  {
    propCode: 0xD045, semanticId: 'monitor_disp_mode_setting', name: 'Monitor DISP Mode Setting',
    category: 'display', dataType: 'MASK32', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false, notes: 'Bitmask of enabled display modes in menu',
  },
  {
    propCode: 0xD046, semanticId: 'monitor_disp_mode', name: 'Monitor DISP Mode',
    category: 'display', dataType: 'MASK32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false, notes: 'Active display mode (Info, Histogram, etc.)',
  },
  {
    propCode: 0xD047, semanticId: 'touch_operation', name: 'Touch Operation',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },

  // --- System settings ---
  {
    propCode: 0xD049, semanticId: 'auto_power_off_temp', name: 'Auto Power OFF Temperature',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Standard', 2: 'High' },
    alertRelevant: false,
  },
  {
    propCode: 0xD04A, semanticId: 'body_key_lock', name: 'Body Key Lock',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD04B, semanticId: 'image_id', name: 'Image ID (Numerical Value)',
    category: 'media', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD04D, semanticId: 'monitor_lut_setting', name: 'Monitor LUT Setting (All Line)',
    category: 'lut', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },

  // --- S&Q ---
  {
    propCode: 0xD052, semanticId: 'sq_frame_rate', name: 'S&Q Frame Rate',
    category: 'recording', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false, notes: 'Slow & Quick motion frame rate; e.g. 0x78 = 120fps',
  },
  {
    propCode: 0xD0D0, semanticId: 'sq_rec_frame_rate', name: 'S&Q Rec Frame Rate',
    category: 'recording', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false, notes: 'S&Q recording frame rate (output FPS)',
  },

  // --- Interval Rec ---
  {
    propCode: 0xD055, semanticId: 'interval_rec_time', name: 'Interval REC Time',
    category: 'recording', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'slider',
    alertRelevant: false,
  },
  {
    propCode: 0xD11F, semanticId: 'interval_rec_countdown', name: 'Interval REC Countdown Interval',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'slider',
    alertRelevant: false,
  },
  {
    propCode: 0xD151, semanticId: 'interval_rec_fps', name: 'Interval REC Frame Rate',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },

  // --- PTP service / protocol versions ---
  {
    propCode: 0xD057, semanticId: 'upload_dataset_version', name: 'Upload Dataset Version',
    category: 'ptp', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'skip', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD059, semanticId: 'baselook_import_cmd_version', name: 'BaseLook Import Command Version',
    category: 'ptp', dataType: 'UINT16', writable: false, safeToWrite: false,
    pollPriority: 'skip', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD0BF, semanticId: 'firmware_update_cmd_version', name: 'Firmware Update Command Version',
    category: 'ptp', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'skip', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD195, semanticId: 'update_body_status', name: 'Update Body Status',
    category: 'ptp', dataType: 'UINT16', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- Subject Recognition / AF ---
  {
    propCode: 0xD060, semanticId: 'subject_recognition_af', name: 'Subject Recognition AF',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD061, semanticId: 'af_transition_speed', name: 'AF Transition Speed',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'slider',
    fallbackRange: { min: 1, max: 7 },
    alertRelevant: false,
  },
  {
    propCode: 0xD062, semanticId: 'af_subject_shift_sens', name: 'AF Subject Shift Sensitivity',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'slider',
    fallbackRange: { min: 1, max: 5 },
    alertRelevant: false,
  },
  {
    propCode: 0xD0AB, semanticId: 'focus_bracket_status', name: 'Focus Bracket Shooting Status',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD157, semanticId: 'subject_recognition_in_af', name: 'Subject Recognition in AF',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD158, semanticId: 'recognition_target', name: 'Recognition Target',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Human', 2: 'Animal/Bird', 3: 'Animal', 4: 'Bird', 5: 'Insect', 6: 'Car/Train', 7: 'Airplane', 8: 'Auto' },
    alertRelevant: false,
  },
  {
    propCode: 0xD159, semanticId: 'eye_select', name: 'Right/Left Eye Select',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'Right', 3: 'Left' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1C6, semanticId: 'tracking_af_on_enable', name: 'Tracking On + AF On Enable Status',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD255, semanticId: 'af_tracking_sensitivity', name: 'AF Tracking Sensitivity',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'slider',
    fallbackRange: { min: 1, max: 5 },
    alertRelevant: false,
  },
  {
    propCode: 0xD2AD, semanticId: 'af_track_speed_change', name: 'AF Track for Speed Change',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },

  // --- HDMI ---
  {
    propCode: 0xD079, semanticId: 'hdmi_osd', name: 'Monitoring Output Display HDMI',
    category: 'hdmi', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD180, semanticId: 'hdmi_rec_media_movie', name: 'HDMI Output Rec Media (Movie)',
    category: 'hdmi', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD182, semanticId: 'hdmi_4k_movie', name: 'HDMI Output 4K (Movie)',
    category: 'hdmi', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD186, semanticId: 'hdmi_timecode_movie', name: 'HDMI Output Time Code (Movie)',
    category: 'hdmi', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD187, semanticId: 'hdmi_rec_control_movie', name: 'HDMI Output REC Control (Movie)',
    category: 'hdmi', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD1B2, semanticId: 'hdmi_cec', name: 'Control for HDMI (CEC)',
    category: 'hdmi', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },

  // --- BaseLook / LUT / Picture Profile ---
  {
    propCode: 0xD08B, semanticId: 'baselook_import_enable', name: 'BaseLook Import Enable Status',
    category: 'lut', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    enumDecoding: { 1: 'Enable', 0: 'Disable' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0C7, semanticId: 'delete_user_baselook', name: 'Delete UserBaseLook',
    category: 'lut', dataType: 'UINT16', writable: true, safeToWrite: false,
    pollPriority: 'skip', safety: 'dangerous', confidence: 'high', uiWidget: 'hidden',
    alertRelevant: false, notes: '0xFFFF = delete all; requires explicit confirmation',
  },
  {
    propCode: 0xD0C8, semanticId: 'select_user_baselook_edit', name: 'Select UserBaseLook to Edit',
    category: 'lut', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'risky', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD0C9, semanticId: 'user_baselook_input', name: 'UserBaseLook Input',
    category: 'lut', dataType: 'STRING', writable: true, safeToWrite: false,
    pollPriority: 'skip', safety: 'risky', confidence: 'high', uiWidget: 'hidden',
    alertRelevant: false,
  },
  {
    propCode: 0xD0CA, semanticId: 'user_baselook_ae_offset', name: 'UserBaseLook AE Level Offset',
    category: 'lut', dataType: 'INT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'risky', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD0CC, semanticId: 'select_baselook_for_pplut', name: 'Select BaseLook to Set in PPLUT',
    category: 'lut', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'risky', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD196, semanticId: 'embed_lut_file', name: 'Embed LUT File',
    category: 'lut', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },

  // --- Picture Profile ---
  {
    propCode: 0xD23F, semanticId: 'picture_profile', name: 'Picture Profile',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'confirmed', uiWidget: 'enum-select',
    enumDecoding: { 0: 'Off', 1: 'PP1', 2: 'PP2', 3: 'PP3', 4: 'PP4', 5: 'PP5', 6: 'PP6', 7: 'PP7', 8: 'PP8', 9: 'PP9', 10: 'PP10', 11: 'PP11' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0E0, semanticId: 'pp_black_level', name: 'Picture Profile Black Level',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'slider',
    alertRelevant: false,
  },
  {
    propCode: 0xD0E1, semanticId: 'pp_gamma', name: 'Picture Profile Gamma',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Movie', 2: 'Still', 3: 'Cine1', 4: 'Cine2', 5: 'Cine3', 6: 'Cine4', 7: 'ITU709', 8: 'S-Log2', 9: 'S-Log3', 10: 'HLG' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0E4, semanticId: 'pp_knee_mode', name: 'Picture Profile Knee Mode',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'Manual' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0E9, semanticId: 'pp_color_mode', name: 'Picture Profile Color Mode',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Movie', 2: 'Still', 3: 'Cinema', 4: 'Pro', 5: 'ITU709 Matrix', 6: 'Black & White', 7: 'S-Gamut', 8: 'S-Gamut3.Cine', 9: 'S-Gamut3', 10: 'BT.2020' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0EA, semanticId: 'pp_saturation', name: 'Picture Profile Saturation',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'slider',
    alertRelevant: false,
  },
  {
    propCode: 0xD0F9, semanticId: 'pp_copy', name: 'Copy Picture Profile',
    category: 'picture-profile', dataType: 'UINT8', writable: true, safeToWrite: false,
    pollPriority: 'skip', safety: 'risky', confidence: 'high', uiWidget: 'hidden',
    alertRelevant: false,
  },
  {
    propCode: 0xD107, semanticId: 'pp_reset_enable', name: 'Reset Picture Profile Enable Status',
    category: 'picture-profile', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- Creative Look ---
  {
    propCode: 0xD0FA, semanticId: 'creative_look', name: 'Creative Look',
    category: 'creative-look', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'ST', 2: 'PT', 3: 'NT', 4: 'VV', 5: 'VV2', 6: 'FL', 7: 'IN', 8: 'SH', 9: 'BW', 10: 'SE', 11: 'Custom1', 12: 'Custom2', 13: 'Custom3' },
    alertRelevant: false,
  },
  {
    propCode: 0xD108, semanticId: 'creative_look_reset_enable', name: 'Reset Creative Look Enable Status',
    category: 'creative-look', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- Silent Mode ---
  {
    propCode: 0xD0DB, semanticId: 'silent_mode', name: 'Silent Mode',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0DC, semanticId: 'silent_mode_aperture_drive', name: 'Silent Mode Aperture Drive in AF',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },

  // --- Image Stabilization ---
  {
    propCode: 0xD0DA, semanticId: 'stabilization_movie', name: 'Image Stabilization (Movie)',
    category: 'stabilization', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Standard', 3: 'Active', 4: 'Hybrid' },
    alertRelevant: false,
  },
  {
    propCode: 0xD192, semanticId: 'stabilization_adj', name: 'Image Stabilization Adjustment',
    category: 'stabilization', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'Manual' },
    alertRelevant: false,
  },
  {
    propCode: 0xD193, semanticId: 'stabilization_focal_length', name: 'Stabilization Focal Length',
    category: 'stabilization', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'slider',
    alertRelevant: false, notes: 'Manual focal length input in mm for stabilizer',
  },

  // --- User Bits ---
  {
    propCode: 0xD0D4, semanticId: 'user_bit_preset', name: 'User Bit Preset',
    category: 'recording', dataType: 'ARRAY', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD0D8, semanticId: 'user_bit_time_rec', name: 'User Bit Time Rec',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD105, semanticId: 'user_bit_reset_enable', name: 'User Bit Reset Enable Status',
    category: 'recording', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- System state ---
  {
    propCode: 0xD0BC, semanticId: 'camera_operating_mode', name: 'Camera Operating Mode',
    category: 'system', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    enumDecoding: { 1: 'Still Shooting', 2: 'Movie Shooting', 3: 'Playback', 4: 'Menu' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0BF, semanticId: 'fw_update_cmd_version', name: 'Firmware Update Command Version',
    category: 'ptp', dataType: 'UINT32', writable: false, safeToWrite: false,
    pollPriority: 'skip', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD0C0, semanticId: 'firmware_update_status', name: 'Firmware Update Status',
    category: 'system', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD0C5, semanticId: 'type_c_accessory_mode', name: 'Type-C Accessory Mode',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD0C6, semanticId: 'pixel_mapping_enable', name: 'Pixel Mapping Enable Status',
    category: 'system', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    enumDecoding: { 1: 'Enable' },
    alertRelevant: false,
  },
  {
    propCode: 0xD092, semanticId: 'image_id_setting', name: 'Image ID Setting',
    category: 'media', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD09A, semanticId: 'ftp_setting_enable', name: 'FTP Setting List Enable Status',
    category: 'network', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD197, semanticId: 'media_slot1_writing', name: 'Media SLOT1 Writing State',
    category: 'media', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'high', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: true,
  },
  {
    propCode: 0xD119, semanticId: 'stream_status', name: 'Stream Status',
    category: 'streaming', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },

  // --- Streaming ---
  {
    propCode: 0xD450, semanticId: 'stream_setting', name: 'Stream Setting',
    category: 'streaming', dataType: 'UINT32', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'confirmed', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD456, semanticId: 'stream_state', name: 'Stream State',
    category: 'streaming', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'confirmed', uiWidget: 'read-only',
    enumDecoding: { 0: 'Stopped', 1: 'Running', 2: 'Error' },
    alertRelevant: false,
  },

  // --- Audio ---
  {
    propCode: 0xD171, semanticId: 'wind_noise_reduction', name: 'Wind Noise Reduction',
    category: 'audio', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'On', 3: 'Auto' },
    alertRelevant: false,
  },
  {
    propCode: 0xD17C, semanticId: 'playback_volume', name: 'Playback Volume',
    category: 'audio', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'slider',
    fallbackRange: { min: 0, max: 15 },
    alertRelevant: false,
  },
  {
    propCode: 0xD17E, semanticId: 'audio_signals', name: 'Audio Signals',
    category: 'audio', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1B1, semanticId: 'audio_signals_volume', name: 'Audio Signals Volume',
    category: 'audio', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'slider',
    fallbackRange: { min: 0, max: 15 },
    alertRelevant: false,
  },
  {
    propCode: 0xD1DD, semanticId: 'mic_directivity', name: 'Microphone Directivity',
    category: 'audio', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'Front', 3: 'Rear', 4: 'All' },
    alertRelevant: false,
  },
  {
    propCode: 0xD220, semanticId: 'audio_signals_start_end', name: 'Audio Signals (Start/End)',
    category: 'audio', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },

  // --- ISO / Exposure advanced ---
  {
    propCode: 0xD14D, semanticId: 'iso_auto_min_shutter_mode', name: 'ISO Auto Min Shutter Speed Mode',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD176, semanticId: 'iso_auto_min_shutter_manual', name: 'ISO Auto Min Shutter Speed Manual',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD1B6, semanticId: 'iso_auto_range_min', name: 'ISO Auto Range Limit (min)',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD1B7, semanticId: 'iso_auto_range_max', name: 'ISO Auto Range Limit (max)',
    category: 'exposure', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD15C, semanticId: 'high_iso_nr', name: 'High ISO NR',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Low', 3: 'Normal' },
    alertRelevant: false,
  },

  // --- Display settings ---
  {
    propCode: 0xD1B0, semanticId: 'display_quality', name: 'Display Quality',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Standard', 2: 'High' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1B8, semanticId: 'face_eye_frame_display', name: 'Face/Eye Frame Display',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD1DE, semanticId: 'grid_line_display', name: 'Grid Line Display',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD1FB, semanticId: 'monitor_brightness_type', name: 'Monitor Brightness Type',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'Manual' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1FD, semanticId: 'tc_ub_display', name: 'TC/UB Display Setting',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'TC', 2: 'UB' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1FE, semanticId: 'gamma_display_assist', name: 'Gamma Display Assist',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1FF, semanticId: 'gamma_display_assist_type', name: 'Gamma Display Assist Type',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'S-Log3→709', 3: 'HLG→709', 4: 'S-Log2→709' },
    alertRelevant: false,
  },
  {
    propCode: 0xD207, semanticId: 'osd_image_mode', name: 'OSD Image Mode',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false, notes: 'Enables OSD image transfer over PTP',
  },

  // --- Lens compensation ---
  {
    propCode: 0xD1A2, semanticId: 'lens_comp_shading', name: 'Lens Compensation: Shading',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Auto' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1A3, semanticId: 'lens_comp_chromatic', name: 'Lens Compensation: Chromatic Aberration',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Auto' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1A4, semanticId: 'lens_comp_distortion', name: 'Lens Compensation: Distortion',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Auto' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1A5, semanticId: 'lens_comp_breathing', name: 'Lens Compensation: Breathing',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false, notes: 'Focus breathing compensation',
  },
  {
    propCode: 0xD1A7, semanticId: 'release_without_lens', name: 'Release Without Lens',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Disable', 2: 'Enable' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1A8, semanticId: 'release_without_card', name: 'Release Without Card',
    category: 'media', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Disable', 2: 'Enable' },
    alertRelevant: false,
  },

  // --- AF detailed settings ---
  {
    propCode: 0xD1AA, semanticId: 'priority_awb', name: 'Priority Set in AWB',
    category: 'color', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Standard', 2: 'Ambience', 3: 'White' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1AC, semanticId: 'aperture_drive_in_af', name: 'Aperture Drive in AF',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Focus Priority', 2: 'Standard' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1AD, semanticId: 'af_with_shutter', name: 'AF with Shutter',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD1AF, semanticId: 'pre_af', name: 'Pre-AF',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xD179, semanticId: 'priority_af_s', name: 'Priority Set in AF-S',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'AF', 2: 'Release', 3: 'Balanced' },
    alertRelevant: false,
  },
  {
    propCode: 0xD17A, semanticId: 'priority_af_c', name: 'Priority Set in AF-C',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'AF', 2: 'Release', 3: 'Balanced' },
    alertRelevant: false,
  },
  {
    propCode: 0xD17B, semanticId: 'focus_magnification_time', name: 'Focus Magnification Time',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: '2 sec', 2: '5 sec', 3: 'No Limit' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1BA, semanticId: 'af_in_focus_magnifier', name: 'AF in Focus Magnifier',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },

  // --- Bracketing ---
  {
    propCode: 0xD166, semanticId: 'bracket_order', name: 'Bracket Order',
    category: 'bracketing', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: '0 → - → +', 2: '- → 0 → +' },
    alertRelevant: false,
  },
  {
    propCode: 0xD167, semanticId: 'focus_bracket_order', name: 'Focus Bracket Order',
    category: 'bracketing', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD168, semanticId: 'focus_bracket_ael', name: 'Focus Bracket Exposure Lock 1st Image',
    category: 'bracketing', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD2A2, semanticId: 'focus_bracket_range', name: 'Focus Bracket Focus Range',
    category: 'bracketing', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },

  // --- File / Media format ---
  {
    propCode: 0xD252, semanticId: 'still_image_quality', name: 'Still Image Quality',
    category: 'media', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'RAW+JPEG', 2: 'JPEG Fine', 3: 'JPEG Std', 4: 'RAW', 5: 'HEIF' },
    alertRelevant: false,
  },
  {
    propCode: 0xD253, semanticId: 'file_format_still', name: 'File Format (Still)',
    category: 'media', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD279, semanticId: 'slot1_format_enable', name: 'Media SLOT1 Format Enable Status',
    category: 'media', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD27B, semanticId: 'format_progress', name: 'Media Format Progress Rate',
    category: 'media', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false, notes: '0–100%',
  },
  {
    propCode: 0xD292, semanticId: 'slot1_quick_format_enable', name: 'Media SLOT1 Quick Format Enable Status',
    category: 'media', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- FTP ---
  {
    propCode: 0xD27C, semanticId: 'select_ftp_server', name: 'Select FTP Server',
    category: 'network', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    fallbackRange: { min: 1, max: 9 },
    alertRelevant: false,
  },

  // --- Zoom ---
  {
    propCode: 0xD25C, semanticId: 'zoom_scale', name: 'Zoom Scale',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD25D, semanticId: 'zoom_bar_info', name: 'Zoom Bar Information',
    category: 'lens', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD25F, semanticId: 'zoom_setting', name: 'Zoom Setting',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Optical Only', 2: 'Clear Image', 3: 'Digital' },
    alertRelevant: false,
  },
  {
    propCode: 0xD297, semanticId: 'save_zoom_focus_position', name: 'Save Zoom and Focus Position',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: false,
    pollPriority: 'skip', safety: 'risky', confidence: 'high', uiWidget: 'hidden',
    alertRelevant: false,
  },
  {
    propCode: 0xD298, semanticId: 'load_zoom_focus_position', name: 'Load Zoom and Focus Position',
    category: 'lens', dataType: 'UINT8', writable: true, safeToWrite: false,
    pollPriority: 'skip', safety: 'risky', confidence: 'high', uiWidget: 'hidden',
    alertRelevant: false,
  },

  // --- WB custom capture ---
  {
    propCode: 0xD135, semanticId: 'custom_wb_size', name: 'Custom WB Size Setting',
    category: 'color', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD270, semanticId: 'custom_wb_exec_state', name: 'Custom WB Execution State',
    category: 'color', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- Movie mode ---
  {
    propCode: 0xD173, semanticId: 'auto_slow_shutter', name: 'Auto Slow Shutter',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD178, semanticId: 'soft_skin_effect', name: 'Soft Skin Effect',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: 'Low', 3: 'Mid', 4: 'High' },
    alertRelevant: false,
  },
  {
    propCode: 0xD17D, semanticId: 'auto_review', name: 'Auto Review',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: '2s', 3: '5s', 4: '10s' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1BF, semanticId: 'program_shift_status', name: 'Program Shift Status',
    category: 'exposure', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },

  // --- Flicker ---
  {
    propCode: 0xD2BA, semanticId: 'flicker_scan_status', name: 'Flicker Scan Status',
    category: 'exposure', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD2BB, semanticId: 'flicker_scan_enable', name: 'Flicker Scan Enable Status',
    category: 'exposure', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- USB power ---
  {
    propCode: 0xD150, semanticId: 'usb_power_supply', name: 'USB Power Supply',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'high', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 0: 'Off', 1: 'On' },
    alertRelevant: false,
    notes: 'value=1 when camera is powered from USB/AC; used for charging indicator',
  },

  // --- Touch functionality ---
  {
    propCode: 0xD283, semanticId: 'function_of_touch', name: 'Function of Touch Operation',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Touch Focus', 2: 'Touch Tracking', 3: 'Touch Shutter', 4: 'Off' },
    alertRelevant: false,
  },
  {
    propCode: 0xD284, semanticId: 'remote_touch_enable', name: 'Remote Touch Operation Enable Status',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD138, semanticId: 'af_free_size_position', name: 'AF Free Size and Position',
    category: 'focus', dataType: 'STRUCT', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- File numbering ---
  {
    propCode: 0xD1C8, semanticId: 'recording_file_number', name: 'Recording File Number (Still)',
    category: 'media', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Series', 2: 'Reset' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1CB, semanticId: 'recording_folder_format', name: 'Recording Folder Format',
    category: 'media', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Standard', 2: 'Date' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1CD, semanticId: 'write_copyright_info', name: 'Write Copyright Info',
    category: 'media', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },

  // --- Self-timer ---
  {
    propCode: 0xD1B4, semanticId: 'self_timer_status', name: 'Shooting Self-timer Status',
    category: 'recording', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD29C, semanticId: 'movie_rec_self_timer', name: 'Movie Rec Self Timer',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Off', 2: '3s', 3: '5s', 4: '10s' },
    alertRelevant: false,
  },

  // --- APS-C crop ---
  {
    propCode: 0xD29B, semanticId: 'apsc_full_switch_enable', name: 'APS-C or Full Switch Enable Status',
    category: 'system', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },

  // --- Focus driving status ---
  {
    propCode: 0xD19C, semanticId: 'focus_driving_status', name: 'Focus Driving Status (Absolute)',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD19D, semanticId: 'zoom_driving_status', name: 'Zoom Driving Status (Absolute)',
    category: 'lens', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xD19F, semanticId: 'extended_shutter_speed', name: 'Extended Shutter Speed',
    category: 'exposure', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },

  // --- Subject recognition detailed settings ---
  {
    propCode: 0xD1E0, semanticId: 'amount_of_defocus', name: 'Amount of Defocus Setting',
    category: 'subject-recognition', dataType: 'UINT16', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'slider',
    alertRelevant: false, notes: 'Background blur level for Cinematic Vlog',
  },
  {
    propCode: 0xD1E1, semanticId: 'cinematic_vlog_setting', name: 'Cinematic Vlog Setting',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD1E3, semanticId: 'cinematic_vlog_mood', name: 'Cinematic Vlog Mood',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'Auto', 2: 'Gold', 3: 'Ocean', 4: 'Forest' },
    alertRelevant: false,
  },
  {
    propCode: 0xD1E4, semanticId: 'cinematic_vlog_af_speed', name: 'Cinematic Vlog AF Transition Speed',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xD1E5, semanticId: 'face_priority_metering', name: 'Face Priority in Multi Metering',
    category: 'subject-recognition', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },

  // --- E-series movie properties (0xE000+) ---
  {
    propCode: 0xE000, semanticId: 'movie_shooting_mode', name: 'Movie Shooting Mode',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'P', 2: 'A', 3: 'S', 4: 'M', 5: 'Flexible Exposure' },
    alertRelevant: false, notes: 'PTP3 movie exposure mode; separate from still exposure mode',
  },
  {
    propCode: 0xE001, semanticId: 'movie_color_gamut', name: 'Movie Shooting Mode Color Gamut',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'low', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },
  {
    propCode: 0xE004, semanticId: 'focus_touch_spot_status', name: 'Focus Touch Spot Status',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xE005, semanticId: 'focus_tracking_status', name: 'Focus Tracking Status',
    category: 'focus', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'low', safety: 'read-only', confidence: 'high', uiWidget: 'read-only',
    alertRelevant: false,
  },
  {
    propCode: 0xE00D, semanticId: 'recorder_proxy_setting', name: 'Recorder Control Proxy Setting',
    category: 'recording', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xE084, semanticId: 'af_assist', name: 'AF Assist',
    category: 'focus', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'toggle',
    enumDecoding: { 1: 'Off', 2: 'On' },
    alertRelevant: false,
  },
  {
    propCode: 0xE086, semanticId: 'lens_info_enable', name: 'Lens Information Enable Status',
    category: 'lens', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'high', uiWidget: 'debug-only',
    alertRelevant: false,
  },
  {
    propCode: 0xE0CD, semanticId: 'enlarge_screen_setting', name: 'Enlarge Screen Setting',
    category: 'display', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'safe', confidence: 'high', uiWidget: 'enum-select',
    alertRelevant: false,
  },

  // --- HLG/color space (still) ---
  {
    propCode: 0xD15D, semanticId: 'hlg_still_image', name: 'HLG Still Image',
    category: 'color', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'toggle',
    alertRelevant: false,
  },
  {
    propCode: 0xD15E, semanticId: 'color_space_still', name: 'Color Space (Still Image)',
    category: 'color', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'on-demand', safety: 'advanced', confidence: 'high', uiWidget: 'enum-select',
    enumDecoding: { 1: 'sRGB', 2: 'AdobeRGB' },
    alertRelevant: false,
  },

  // --- Tally (PTP3 v1.3+) ---
  {
    propCode: 0xD513, semanticId: 'tally_lamp_red', name: 'Tally Lamp Red',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'skip', safety: 'safe', confidence: 'confirmed', uiWidget: 'hidden',
    alertRelevant: false, notes: 'PTP3 v1.3+ only; controlled by bridge sync',
  },
  {
    propCode: 0xD514, semanticId: 'tally_lamp_green', name: 'Tally Lamp Green',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'skip', safety: 'safe', confidence: 'confirmed', uiWidget: 'hidden',
    alertRelevant: false, notes: 'PTP3 v1.3+ only; controlled by bridge sync',
  },
  {
    propCode: 0xD515, semanticId: 'tally_lamp_yellow', name: 'Tally Lamp Yellow',
    category: 'system', dataType: 'UINT8', writable: true, safeToWrite: true,
    pollPriority: 'skip', safety: 'safe', confidence: 'confirmed', uiWidget: 'hidden',
    alertRelevant: false, notes: 'PTP3 v1.3+ only; controlled by bridge sync',
  },

  // --- Provisional / inferred (confidence = provisional/inferred) ---
  {
    propCode: 0xD05A, semanticId: 'push_auto_iris', name: 'Push Auto Iris (Inferred)',
    category: 'exposure', dataType: 'UINT8', writable: false, safeToWrite: false,
    pollPriority: 'on-demand', safety: 'read-only', confidence: 'inferred', uiWidget: 'debug-only',
    alertRelevant: false, notes: 'Context-inferred; between D059 and D060. Not confirmed.',
  },

];

// ─── Build lookup map ─────────────────────────────────────────────────────────

/** Immutable protocol knowledge map, keyed by propCode. */
export const PROP_KNOWLEDGE: ReadonlyMap<number, PropKnowledgeEntry> = new Map(
  RAW_ENTRIES.map(e => [e.propCode, e]),
);

/**
 * Vendor marker codes that must not be treated as camera properties.
 * Filter these out of any prop scan before enrichment.
 */
export const VENDOR_MARKER_CODES = new Set<number>([
  0x8000, // Vendor Extension Base — base address marker, not a prop
  0x9000, // Vendor Operation Base — base address for SDIO operations
]);

/**
 * Look up protocol knowledge for a prop code.
 * Returns null for unknown codes (caller must handle unknown props separately).
 */
export function getPropKnowledge(propCode: number): PropKnowledgeEntry | null {
  return PROP_KNOWLEDGE.get(propCode) ?? null;
}

/**
 * Return true if the given code is a vendor marker that should be excluded
 * from all prop scans, poll lists, and runtime models.
 */
export function isVendorMarker(propCode: number): boolean {
  return VENDOR_MARKER_CODES.has(propCode);
}

/**
 * Return all knowledge entries that match a given category.
 */
export function getKnowledgeByCategory(category: PropCategory): PropKnowledgeEntry[] {
  return RAW_ENTRIES.filter(e => e.category === category);
}

/**
 * Return all knowledge entries with poll priority matching the given level.
 */
export function getKnowledgeByPollPriority(priority: PollPriority): PropKnowledgeEntry[] {
  return RAW_ENTRIES.filter(e => e.pollPriority === priority);
}
