/**
 * atem-decoder.ts — ATEM Camera Control parameter decoder + conversion table
 *
 * Based on Blackmagic Camera Control Protocol v1.3 + empirical testing.
 * Use this to verify what the ATEM is actually sending before writing bridge logic.
 *
 * CameraControlDataType (atem-connection enum):
 *   0 = BOOL    1 = SINT8    2 = SINT16    3 = SINT32    4 = SINT64    128 = FLOAT
 */

export interface DecodedAtemParam {
  label:       string    // human-readable parameter name
  decoded:     string    // human-readable value
  sonyTarget:  string    // what Sony property to change
  sonyMethod:  string    // "notch" | "absolute" | "button" | "none"
  /** numeric result of the conversion, if applicable */
  numericResult?: number
}

// ─── Category 0: Lens ─────────────────────────────────────────────────────────

function decodeCat0(parameter: number, nums: number[], _fps: number): DecodedAtemParam {
  const n0 = nums[0] ?? 0
  switch (parameter) {
    case 0:
      return {
        label: 'Focus position',
        decoded: `pos=${n0.toFixed(3)} (0=near, 1=far)`,
        sonyTarget: '0xD2D1 NearFar',
        sonyMethod: 'notch (INT16 -7..+7, delta from prev)',
      }
    case 1:
      return {
        label: 'AutoFocus trigger',
        decoded: `trigger=${n0}`,
        sonyTarget: '0xD2C1 S1Button',
        sonyMethod: 'button DOWN→100ms→UP',
      }
    case 2:
      return {
        label: 'Iris (aperture)',
        decoded: `f/${n0.toFixed(2)} (actual f-number, e.g. 2.80 = f/2.8)`,
        sonyTarget: '0x5007 FNumber',
        sonyMethod: 'notch (INT8)',
        numericResult: n0,
      }
    default:
      return { label: `Cat0/param${parameter}`, decoded: `${nums}`, sonyTarget: '?', sonyMethod: 'none' }
  }
}

// ─── Category 1: Video ────────────────────────────────────────────────────────

function decodeCat1(parameter: number, nums: number[], fps: number): DecodedAtemParam {
  const n0 = nums[0] ?? 0

  switch (parameter) {
    case 1: {
      // SINT8 — gain in dB. Note: 0 dB ≈ native ISO (camera-dependent).
      // Sony FX30 native ISO = 800 (dual-native 800 / 2500).
      // Empirical: ATEM value 2 was observed at "0 dB" position on ATEM panel —
      // treat it as dB directly per BMD spec; native offset may cause ±2 dB slack.
      const targetISO = Math.round(400 * Math.pow(2, n0 / 6))
      return {
        label: 'Gain',
        decoded: `${n0} dB  →  targetISO≈${targetISO}  (base ISO 400, +6dB=×2)`,
        sonyTarget: '0xD21E ISO',
        sonyMethod: 'notch (INT8)',
        numericResult: targetISO,
      }
    }

    case 2: {
      // SINT16 — White Balance in Kelvin. nums[1] = tint fine-tune (usually 0).
      const tint = nums[1] ?? 0
      return {
        label: 'White Balance',
        decoded: `${n0}K${tint !== 0 ? ` tint=${tint}` : ''}`,
        sonyTarget: '0xD20F ColorTemp',
        sonyMethod: 'absolute (UINT16 Kelvin)',
        numericResult: n0,
      }
    }

    case 3:
      return { label: 'Auto WB trigger', decoded: 'trigger', sonyTarget: '—', sonyMethod: 'none' }

    case 4:
      return { label: 'Restore Auto WB', decoded: 'trigger', sonyTarget: '—', sonyMethod: 'none' }

    case 5: {
      // SINT32 — Shutter speed in MICROSECONDS.
      // Confirmed: 20833 μs = 1/48 s.  DO NOT treat as ExpComp.
      const den = n0 > 0 ? Math.round(1_000_000 / n0) : 0
      const angle = fps > 0 && n0 > 0 ? Math.round((360 * 1_000_000) / (fps * n0)) : 0
      return {
        label: 'Shutter Speed (μs)',
        decoded: `${n0}μs  →  1/${den}  ≈ ${angle}° @ ${fps}fps`,
        sonyTarget: '0xD20D ShutterSpeed',
        sonyMethod: 'notch (INT8)',
        numericResult: den,
      }
    }

    case 12: {
      // SINT32 — Shutter angle × 100 (18000 = 180°).
      const angle = n0 / 100
      const den = fps > 0 && n0 > 0 ? Math.round((fps * 360 * 100) / n0) : 0
      return {
        label: 'Shutter Angle',
        decoded: `${angle}°  →  1/${den} @ ${fps}fps`,
        sonyTarget: '0xD20D ShutterSpeed',
        sonyMethod: 'notch (INT8)',
        numericResult: den,
      }
    }

    case 13: {
      // SINT8 — Gain in dB (confirmed from hardware logs).
      // Maps to ISO via gainDbToISO(db, base=400).
      // NOTE: param=1 (also Gain) is intentionally ignored in bridge logic —
      // ATEM sends it redundantly alongside param=13.
      const targetISO = Math.round(400 * Math.pow(2, n0 / 6))
      return {
        label: 'Gain (dB) → ISO',
        decoded: `${n0} dB  →  targetISO≈${targetISO}  (base ISO 400, +6dB=×2)`,
        sonyTarget: '0xD21E ISO',
        sonyMethod: 'notch (INT8)',
        numericResult: targetISO,
      }
    }

    case 14: {
      // SINT32 — ISO value (direct).
      return {
        label: 'ISO',
        decoded: `ISO ${n0}`,
        sonyTarget: '0xD21E ISO',
        sonyMethod: 'notch (INT8)',
        numericResult: n0,
      }
    }

    case 15:
      return {
        label: 'ND Filter',
        decoded: `${n0.toFixed(3)} stops (normalized 0-1)`,
        sonyTarget: '—',
        sonyMethod: 'none',
      }

    default:
      return { label: `Cat1/param${parameter}`, decoded: `${nums}`, sonyTarget: '?', sonyMethod: 'none' }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decode an ATEM Camera Control command into a human-readable description.
 * @param fps Frames per second of the current project (default 25)
 */
export function decodeAtemParam(
  category: number,
  parameter: number,
  type: number,
  numberData: number[],
  fps = 25,
): DecodedAtemParam {
  const n0 = numberData[0] ?? 0
  switch (category) {
    case 0: return decodeCat0(parameter, numberData, fps)
    case 1: return decodeCat1(parameter, numberData, fps)
    default:
      return {
        label: `Cat${category}/param${parameter}`,
        decoded: `type=${type} nums=[${numberData.join(',')}]`,
        sonyTarget: '?',
        sonyMethod: 'none',
        numericResult: n0,
      }
  }
}

/**
 * One-liner summary for bridge log lines.
 * Example: "ShutterSpeed(μs): 20833μs → 1/48 ≈ 180° @ 25fps"
 */
export function decodeSummary(
  category: number,
  parameter: number,
  type: number,
  numberData: number[],
  fps = 25,
): string {
  const d = decodeAtemParam(category, parameter, type, numberData, fps)
  return `${d.label}: ${d.decoded}  →  Sony ${d.sonyTarget} [${d.sonyMethod}]`
}
