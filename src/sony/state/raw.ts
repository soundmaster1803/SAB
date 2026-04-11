/**
 * sony/state/raw.ts
 *
 * Raw Sony camera state — values as received directly from the PTP/IP transport.
 *
 * This type mirrors the fields actively polled and stored by SonyPTPClient today.
 * Every field here is grounded in actual runtime data from ptp-client.ts.
 *
 * Do not add fields here unless they are confirmed to be produced by the transport.
 *
 * Phase: skeleton only — not wired into runtime yet (Phase 5).
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
 *   - `battery`      prop 0xD218 — percentage 0–100 (clamped; >100 signals charging)
 *   - `charging`     derived from battery > 100 in transport
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
  /** Model name string as reported by GetDeviceInfo. */
  name: string;
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
  /** True when camera is on AC power / charging (raw battery > 100). */
  charging: boolean;

  // --- Recording ---
  /** Recording state: 0 = idle, 1 = recording. */
  recState: number;
  /** Remaining recordable time in seconds; 0 = unknown. */
  recRemainSec: number;

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
