/**
 * sony/state/raw.ts
 *
 * Raw Sony camera state — values as received directly from the PTP/IP transport.
 *
 * This type mirrors the fields actively polled and stored by SonyPTPClient today.
 * Every field here is grounded in actual runtime data from ptp-client.ts.
 *
 * Do not add fields here unless they are confirmed to be produced by the transport.
 */

/**
 * Raw state as parsed from Sony PTP/IP polling responses.
 *
 * Field notes:
 *   - `iso`          prop 0xD21E — UINT32 masked to low 16 bits; 0x00FFFFFF = AUTO
 *   - `fnumber`      prop 0x5007 — UINT16 × 100 (e.g. 280 = f/2.8)
 *   - `shutter`      prop 0xD20D — UINT32 fraction: (numerator<<16)|denominator
 *   - `expComp`      prop 0x5010 — INT16 raw value; divide by 1000 to get EV
 *   - `colorTemp`    prop 0xD20F — Kelvin (e.g. 5500)
 *   - `battery`      prop 0xD218 — percentage 0–100 (clamped; >100 signals charging on older models)
 *   - `powerSource`  prop 0xD03A — 0=unknown, 1=DC, 2=Battery, 3=PoE
 *   - `batteryMinutes` prop 0xD038 — remaining minutes; 0=unknown
 *   - `charging`     derived: powerSource ∈ {1,3} if available, else batteryIcon bit 3
 *   - `recState`     prop 0xD21D — 0 = idle, 1 = recording
 *   - `recRemainSec` props 0xD3C2/0xD3C4 — remaining card capacity in seconds; 0 = unknown
 *   - `tally`        written by bridge sync — 0 = none, 1 = program, 2 = preview
 *   - `fps`          from config or camera; optional
 *   - `lastUpdate`   epoch ms of last poll that produced a changed value
 */
export interface SonyRawState {
  /** Camera identifier (from config or GUID). */
  id: string;
  /** Camera IP address. */
  ip: string;
  /** Operator-facing camera name from config/pairing. */
  name: string;
  /** Camera model string as reported by GetDeviceInfo, when known. */
  model?: string;
  /** True while PTP/IP session is active and sockets are open. */
  connected: boolean;

  // --- Exposure ---
  /** ISO — raw masked value; 0x00FFFFFF = AUTO. */
  iso: number;
  /** F-number — raw UINT16 × 100 (e.g. 280 = f/2.8). */
  fnumber: number;
  /** Shutter speed — raw UINT32 fraction encoding (numerator<<16 | denominator). */
  shutter: number;
  /** Exposure compensation — raw INT16; divide by 1000 to get EV. */
  expComp: number;

  // --- White balance ---
  /** Color temperature in Kelvin. */
  colorTemp: number;

  // --- Power ---
  /** Battery remaining as percentage 0–100 (clamped). */
  battery: number;
  /**
   * Power source from prop 0xD03A.
   * 0 = unknown (not yet polled), 1 = DC/AC adapter, 2 = Battery, 3 = PoE.
   */
  powerSource: number;
  /** Battery remaining in minutes from prop 0xD038. 0 = unknown. */
  batteryMinutes: number;
  /** True when camera is on AC power or PoE (derived from powerSource when available,
   *  falls back to batteryIcon bit 3 heuristic). */
  charging: boolean;

  // --- Recording ---
  /** Recording state: 0 = idle, 1 = recording. */
  recState: number;
  /** Remaining recordable time in seconds; 0 = unknown. */
  recRemainSec: number;
  /** Elapsed recording time in seconds from prop 0xD120; 0 = not recording / unknown. */
  recDurationSec: number;
  /** Media slot 1 status from prop 0xD248: 0=unknown, 1=OK, 2=NoCard, 3=Error, 4/6=Recognizing, 7=Locked. */
  slotStatus: number;
  /** Media slot 2 status from prop 0xD256; same codes as slotStatus. */
  slotStatus2: number;
  /** Remaining recordable seconds for slot 2 from prop 0xD258; 0=unknown. */
  recRemainSec2: number;
  /** Movie file format code from prop 0xD241; 0=unknown. */
  movieFileFormat: number;
  /** Enumerated list of file formats this camera supports (from 0xD241 blob); empty = unknown. */
  movieFileFormatList: number[];
  /** Recording setting (fps+bitrate) code from prop 0xD242; 0=unknown. */
  recSetting: number;
  /** Enumerated list of recording settings this camera supports (from 0xD242 blob); empty = unknown. */
  recSettingList: number[];
  /** Recording media (slot selection) from prop 0xD160; 0=unknown, 1=Slot1, 2=Slot2, 0x0101=Simultaneous. */
  recMedia: number;
  /** Rec video frame rate code from prop 0xD286; 0=unknown. */
  recFrameRate: number;
  /** Enumerated list of frame rates this camera supports (from 0xD286 blob); empty = unknown. */
  recFrameRateList: number[];

  // --- Focus ---
  /**
   * Focus mode from prop 0x500A.
   * 0x0001=MF, 0x0002=AF-S, 0x8004=AF-C, 0x8005=AF-A, 0x8006=DMF, 0x8009=PF.
   * 0 = not yet polled.
   */
  focusMode: number;
  /**
   * AF status (Focus Indication) from prop 0xD213.
   * 0x02=focused, 0x03=not focused, 0x05=tracking. 0 = not yet polled.
   */
  afStatus: number;
  /**
   * Focal distance from prop 0xD004 (raw value; divide by 100 for meters).
   * 0xFFFF or 0 = infinity / not available.
   */
  focalDistanceM: number;
  /**
   * Focal distance minimum from prop 0xD004 range form (UINT32 raw; /100 = meters).
   * 0 = unknown / not yet polled.
   */
  focalDistanceMin: number;
  /**
   * Focal distance maximum from prop 0xD004 range form (UINT32 raw; /100 = meters).
   * 0 = unknown / not yet polled; may equal 0xFFFFFFFF when camera reports ∞.
   */
  focalDistanceMax: number;
  /**
   * Focal distance step from prop 0xD004 range form (UINT32 raw).
   * 0 = unknown / not yet polled.
   */
  focalDistanceStep: number;
  /**
   * Focal distance writability flag from prop 0xD004 IsEnabled byte.
   * true = direct set via 0x9205 is accepted; false = blocked by lens/mode.
   */
  focalDistanceEnabled: boolean;
  /**
   * Current lens position from prop 0xE043 (PTP3 only).
   * 0x0000 = near limit, 0xFFFF = infinity. 0 = not yet polled / not supported.
   */
  focusPosition: number;
  /**
   * Near/Far drive enable status from prop 0xD235.
   * 0x01 = enabled (step commands allowed). 0 = not polled / disabled.
   */
  nearFarEnable: number;

  // --- Tally (written by bridge sync) ---
  /** Tally state: 0 = none, 1 = program, 2 = preview. */
  tally: number;

  // --- Frame rate ---
  /** Current frame rate (from config or camera, if available). */
  fps?: number;

  // --- Freshness ---
  /** Epoch ms of the last poll cycle that produced a state change. */
  lastUpdate: number;
}
