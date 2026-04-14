/**
 * sony/state/alerts.ts
 *
 * Sony camera alert state — operator-visible warning conditions derived from
 * raw and derived state.
 *
 * Only alerts that are grounded in fields actively produced by the current
 * runtime are included. No speculative alerts.
 */

import type { SonyRawState } from './raw';
import type { SonyDerivedState } from './derived';

/**
 * Battery level severity bucket.
 * - 'ok'       — battery is sufficient for normal operation
 * - 'low'      — battery < 20%; operator should be notified
 * - 'critical' — battery < 10%; action required soon
 * - 'charging' — camera is on AC power / charging
 * - 'unknown'  — battery value not yet available (0)
 */
export type BatterySeverity = 'ok' | 'low' | 'critical' | 'charging' | 'unknown';

/**
 * Remaining record time severity bucket.
 * - 'ok'       — more than 5 minutes remaining
 * - 'low'      — between 1 and 5 minutes remaining
 * - 'critical' — less than 1 minute remaining
 * - 'unknown'  — recRemainSec is 0 (camera did not report it)
 */
export type RecRemainingSeverity = 'ok' | 'low' | 'critical' | 'unknown';

/**
 * Alert state for a Sony camera.
 *
 * All fields are derived from SonyRawState. Alerts are computed, not stored.
 * No alert field is authoritative — always re-derive from current raw state.
 */
export interface SonyAlertState {
  /** True when the camera PTP/IP session is not active. */
  connectionLost: boolean;
  /** Battery severity classification. */
  batterySeverity: BatterySeverity;
  /** True when battery is below the low threshold (< 20%) and not charging. */
  lowBattery: boolean;
  /** True when battery is below the critical threshold (< 10%) and not charging. */
  criticalBattery: boolean;
  /** Remaining record time severity classification. */
  recRemaining: RecRemainingSeverity;
}

// ─── Thresholds ────────────────────────────────────────────────────────────────

/** Battery % below which a low-battery alert is raised. */
const BATTERY_LOW_PCT = 20;
/** Battery % below which a critical-battery alert is raised. */
const BATTERY_CRITICAL_PCT = 10;

/** Remaining record time in seconds below which a low-remaining alert is raised (5 min). */
const REC_REMAIN_LOW_SEC = 300;
/** Remaining record time in seconds below which a critical alert is raised (1 min). */
const REC_REMAIN_CRITICAL_SEC = 60;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function classifyBattery(raw: SonyRawState): BatterySeverity {
  if (raw.charging) return 'charging';
  if (raw.battery === 0) return 'unknown';
  if (raw.battery < BATTERY_CRITICAL_PCT) return 'critical';
  if (raw.battery < BATTERY_LOW_PCT) return 'low';
  return 'ok';
}

function classifyRecRemaining(raw: SonyRawState): RecRemainingSeverity {
  if (raw.recRemainSec === 0) return 'unknown';
  if (raw.recRemainSec < REC_REMAIN_CRITICAL_SEC) return 'critical';
  if (raw.recRemainSec < REC_REMAIN_LOW_SEC) return 'low';
  return 'ok';
}

// ─── Main alert derivation function ───────────────────────────────────────────

/**
 * Derive alert state from raw (and optionally derived) Sony camera state.
 * Pure function — no side effects.
 *
 * The `_derived` parameter is reserved for future alerts that need derived values.
 * It is accepted now to maintain a stable function signature across phases.
 */
export function deriveSonyAlerts(
  raw: SonyRawState,
  _derived: SonyDerivedState,
): SonyAlertState {
  const batterySeverity = classifyBattery(raw);

  return {
    connectionLost:  !raw.connected,
    batterySeverity,
    lowBattery:      batterySeverity === 'low',
    criticalBattery: batterySeverity === 'critical',
    recRemaining:    classifyRecRemaining(raw),
  };
}
