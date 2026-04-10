// mapper.ts — ATEM → Sony PTP value converters (pure functions, no I/O)

// ─── Camera scales ────────────────────────────────────────────────────────────

// Kelvin scale 2500–10000 step 100
export const KELVIN_SCALE: number[] = Array.from(
  { length: Math.floor((10000 - 2500) / 100) + 1 },
  (_, i) => 2500 + i * 100,
)

/**
 * Color temperature notch delta: steps from currentKelvin to targetKelvin on KELVIN_SCALE (INT8).
 */
export function kelvinToNotch(currentKelvin: number, targetKelvin: number): number {
  const cur = KELVIN_SCALE.findIndex(v => v >= currentKelvin)
  const tgt = KELVIN_SCALE.findIndex(v => v >= targetKelvin)
  const safeCur = cur === -1 ? KELVIN_SCALE.length - 1 : cur
  const safeTgt = tgt === -1 ? KELVIN_SCALE.length - 1 : tgt
  return Math.max(-127, Math.min(127, safeTgt - safeCur))
}

// ─── Converters ───────────────────────────────────────────────────────────────

/**
 * ATEM iris → Sony FNumber notch delta (INT8).
 * atem-connection decodes iris as an actual f-number float (e.g. 3.345 = f/3.3).
 * Sony FNumber is stored as f×100 (e.g. 630 = f/6.3).
 * supportedList: camera's live enumeration list for FNUMBER (values are f×100).
 */
export function irisToNotch(atemFNumber: number, currentFNumber: number, supportedList: number[]): number {
  if (supportedList.length === 0) return 0
  const targetFN100 = Math.round(atemFNumber * 100)
  const targetIdx   = supportedList.findIndex(v => v >= targetFN100)
  const currentIdx  = supportedList.findIndex(v => v >= currentFNumber)
  const safeTgt = targetIdx  === -1 ? supportedList.length - 1 : targetIdx
  const safeCur = currentIdx === -1 ? supportedList.length - 1 : currentIdx
  return Math.max(-127, Math.min(127, safeTgt - safeCur))
}

/**
 * ISO notch delta: steps from currentIsoRaw to targetIso (INT8).
 * supportedList: camera's live enumeration list for ISO (extended UINT32, e.g. 0x10000280 = ISO 640).
 * Uses closest-match so inexact ATEM values (e.g. 504) snap to nearest Sony step (500).
 * 0x00FFFFFF is Sony's "auto ISO" sentinel — kept as-is, not stripped to 0xFFFF.
 */
export function isoToNotch(targetIso: number, currentIsoRaw: number, supportedList: number[]): number {
  if (supportedList.length === 0) return 0
  const cleanList = supportedList.map(v => (v & 0x00FFFFFF) === 0x00FFFFFF ? v : v & 0xFFFF)
  const curClean  = (currentIsoRaw & 0x00FFFFFF) === 0x00FFFFFF ? currentIsoRaw : currentIsoRaw & 0xFFFF
  const curIdx = cleanList.reduce((best, v, i) =>
    Math.abs(v - curClean) < Math.abs(cleanList[best]! - curClean) ? i : best, 0)
  const tgtIdx = cleanList.reduce((best, v, i) =>
    Math.abs(v - targetIso) < Math.abs(cleanList[best]! - targetIso) ? i : best, 0)
  return Math.max(-127, Math.min(127, tgtIdx - curIdx))
}

/**
 * Gain dB → approximate ISO value.
 * 0 dB = baseIso; each +6 dB doubles ISO.
 * baseIso defaults to 400 (ATEM native base gain).
 */
export function gainDbToISO(db: number, baseIso: number = 400): number {
  return Math.round(baseIso * Math.pow(2, db / 6))
}

/**
 * ATEM shutter speed denominator (1/x) → Sony shutter notch delta (INT8).
 * currentShutterRaw: Sony encoding (numerator<<16 | denominator).
 * supportedList: camera's live enumeration list for SHUTTER_SPEED (Sony UINT32 encoding).
 * Uses closest-match so ATEM denominators (e.g. 150) snap to nearest Sony step.
 */
export function shutterToNotch(atemDenominator: number, currentShutterRaw: number, supportedList: number[]): number {
  if (supportedList.length === 0) return 0
  const cleanList = supportedList.map(v => v & 0xFFFF)
  const curClean  = currentShutterRaw & 0xFFFF
  const curIdx = cleanList.reduce((best, v, i) =>
    Math.abs(v - curClean) < Math.abs(cleanList[best]! - curClean) ? i : best, 0)
  const tgtIdx = cleanList.reduce((best, v, i) =>
    Math.abs(v - atemDenominator) < Math.abs(cleanList[best]! - atemDenominator) ? i : best, 0)
  return Math.max(-127, Math.min(127, tgtIdx - curIdx))
}

/**
 * Shutter speed in microseconds → denominator (1/x).
 * ATEM cat=1 param=5 sends microseconds (SINT32).
 * Example: 10000 μs → 1/100, 6667 μs → 1/150.
 */
export function shutterUsToSpeed(us: number): number {
  if (us <= 0) return 0
  return Math.round(1_000_000 / us)
}

/**
 * ATEM exposure compensation (Fixed16 EV, -2.0..+2.0) → Sony ExpComp notch delta (INT8).
 * currentRaw: Sony INT16/1000 EV.
 */
export function expCompToNotch(atemEV: number, currentRaw: number): number {
  const currentEV = currentRaw / 1000
  const delta = atemEV - currentEV
  return Math.max(-127, Math.min(127, Math.round(delta / 0.333)))
}

/**
 * ATEM focus position delta → Sony NearFar notch (INT16, -7..+7).
 * Since Sony has no absolute focus position, only relative delta is sent.
 */
export function focusToNearFar(atemValue: number, prevAtemValue: number): number {
  const delta = atemValue - prevAtemValue
  return Math.max(-7, Math.min(7, Math.round(delta * 7)))
}

