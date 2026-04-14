/**
 * sony/state/derived.ts
 *
 * Derived Sony camera state — computed values that are not raw wire values but
 * are clearly useful for UI display and bridge logic.
 *
 * All derivations are deterministic functions of SonyRawState.
 * No I/O, no side effects, no transport imports.
 */

import type { SonyRawState } from './raw';

/**
 * Derived Sony state — human-readable and computed values.
 *
 * Field notes:
 *   - `isoDisplay`        "AUTO" or numeric string (e.g. "800")
 *   - `shutterDisplay`    fraction or long-exposure string (e.g. "1/100", "2.0\"")
 *   - `fnumberDisplay`    f-number as decimal string (e.g. "2.8")
 *   - `colorTempDisplay`  color temperature with unit (e.g. "5500K") or "—"
 *   - `expCompEv`         float EV value (e.g. -0.7, +1.3)
 *   - `expCompDisplay`    formatted EV string (e.g. "+1.3", "-0.7", "0")
 */
export interface SonyDerivedState {
  /** ISO as display string — "AUTO" or numeric (e.g. "800"). */
  isoDisplay: string;
  /** Shutter speed as display string — "1/100", "2.0\"", or "—" for unknown. */
  shutterDisplay: string;
  /** F-number as decimal string — e.g. "2.8". UI prepends "f/" for display. */
  fnumberDisplay: string;
  /** Color temperature as display string — e.g. "5500K", or "—" when unavailable. */
  colorTempDisplay: string;
  /** Exposure compensation as float EV (e.g. -0.667, 1.333). */
  expCompEv: number;
  /** Exposure compensation as formatted display string — e.g. "+1.3", "-0.7", "0". */
  expCompDisplay: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Decode raw Sony shutter UINT32 to a display string.
 * Encoding: (numerator << 16) | denominator.
 * Returns "—" for unknown or zero values.
 */
function decodeShutter(raw: number): string {
  if (!raw || raw === 0xFFFFFFFF) return '—';
  const num = (raw >> 16) & 0xFFFF;
  const den = raw & 0xFFFF;
  if (num === 0 || den === 0) return '—';
  if (num === 1) return `1/${den}`;
  if (den === 10) return `${(num / 10).toFixed(1)}"`;
  return `${num}/${den}`;
}

/**
 * Decode raw Sony ISO value to a display string.
 * 0x00FFFFFF = AUTO ISO sentinel.
 */
function decodeISO(raw: number): string {
  if (!raw) return '—';
  if (raw === 0x00FFFFFF) return 'AUTO';
  const masked = raw & 0xFFFF;
  if (masked === 0xFFFF) return 'AUTO';
  return String(masked);
}

/**
 * Decode raw f-number (UINT16 × 100) to a display string.
 * e.g. 280 → "2.8", 180 → "1.8"
 */
function decodeFNumber(raw: number): string {
  if (!raw) return '—';
  return (raw / 100).toFixed(1);
}

/**
 * Decode color temperature (Kelvin) to a display string.
 * e.g. 5500 → "5500K", 0 → "—"
 */
function decodeColorTemp(raw: number): string {
  if (!raw || raw === 0) return '—';
  return `${raw}K`;
}

/**
 * Format EV float to a signed display string.
 * e.g. 1.333 → "+1.3", -0.667 → "-0.7", 0 → "0"
 */
function formatEv(ev: number): string {
  if (ev === 0) return '0';
  const sign = ev > 0 ? '+' : '';
  return `${sign}${ev.toFixed(1)}`;
}

// ─── Main derivation function ──────────────────────────────────────────────────

/**
 * Compute derived state from raw Sony camera state.
 * Pure function — no side effects.
 */
export function deriveSonyState(raw: SonyRawState): SonyDerivedState {
  const expCompEv = raw.expComp / 1000;

  return {
    isoDisplay:       decodeISO(raw.iso),
    shutterDisplay:   decodeShutter(raw.shutter),
    fnumberDisplay:   decodeFNumber(raw.fnumber),
    colorTempDisplay: decodeColorTemp(raw.colorTemp),
    expCompEv,
    expCompDisplay:   formatEv(expCompEv),
  };
}
