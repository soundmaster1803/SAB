# ATEM → Sony Mapping Table

## Overview
ATEM sends floats (0.0–1.0 normalized) or raw int values.
Sony accepts either Notch (differential ±1 step) or SetExtDevicePropValue (absolute UINT32/INT16).
Bridge strategy: use Notch for continuous params (iris/shutter/iso), SetExtDevicePropValue for discrete/exact (WB, expcomp when possible).

## Mapping Table

| ATEM cat | param | field | Sony PropCode | Sony method | Conversion |
|----------|-------|-------|--------------|-------------|------------|
| 0 | 2 | float[0] iris | 0x5007 FNumber | Notch 0x82 | see Iris conversion |
| 0 | 0 | float[0] focus | (no Sony eq.) | — | not supported |
| 0 | 9 | float[0] zoom | (model dep.) | — | PTP3 only |
| 1 | 6 | int32[0] ISO | 0xD21E | SetExtDevicePropValue | direct ISO value |
| 1 | 5 | int32[0]/[1] shutter | 0xD20D | Notch 0x82 | see Shutter conversion |
| 1 | 0 | int16[0] WB mode | 0x5005 | SetExtDevicePropValue | see WB mapping |
| 5 | 0 | int32[0] shutter exp | 0xD20D | Notch 0x82 | same as cat1 param5 |
| 8 | 0..6 | color grading | (unsupported) | — | no Sony PTP equiv |

## Iris Conversion (ATEM float → Sony Notch)
ATEM float 0.0=closed/max-f, 1.0=open/min-f. Sony Notch ±1 changes one step.
Strategy: track current FNumber from polling. Compare desired f-number, send ±1 steps.

```typescript
// ATEM iris 0.0–1.0 → FNumber target
// FNumber scale for FX30 (from ref-cameras.md):
const FNUMBER_SCALE = [180,200,220,250,280,320,350,400,450,500,560,630,710,800,900,1000,1100,1200,1400,1600,1800,2000]
// float 1.0 = f/1.8 (index 0 = most open), float 0.0 = f/22 (most closed)
function atemIrisToFNumber(atemFloat: number): number {
  const idx = Math.round((1.0 - atemFloat) * (FNUMBER_SCALE.length - 1))
  return FNUMBER_SCALE[Math.min(idx, FNUMBER_SCALE.length - 1)]
}

// To send: calculate delta steps between current and target
function calcNotchSteps(currentFN: number, targetFN: number): number {
  const ci = FNUMBER_SCALE.indexOf(currentFN)
  const ti = FNUMBER_SCALE.indexOf(targetFN)
  if (ci < 0 || ti < 0) return 0
  return ti - ci  // positive = increase f (close iris), negative = open
}
```

## Shutter Conversion (ATEM → Sony Notch)
ATEM sends category=1 param=5 with int32[0]=numerator, int32[1]=denominator.
Or category=1 param=5 with float[0] normalized.

```typescript
// Shutter scale (FX30 common values, denominator form for "1/X"):
const SHUTTER_SCALE = [50,60,100,120,125,200,250,500,1000,2000,4000,8000]
// Sony stores as (1<<16)|den for "1/den"

// From ATEM int32 numerator/denominator:
function atemShutterToSonyVal(num: number, den: number): number {
  // Normalize to "1/X" form
  const normalized = Math.round(den / num)
  return (1 << 16) | normalized
}

// Find step delta to notch to target shutter:
function shutterNotchDelta(currentVal: number, targetVal: number): number {
  const currentDen = currentVal & 0xFFFF
  const targetDen = targetVal & 0xFFFF
  const ci = SHUTTER_SCALE.indexOf(currentDen)
  const ti = SHUTTER_SCALE.indexOf(targetDen)
  if (ci < 0 || ti < 0) return 0
  return ti - ci
}
```

## ISO Conversion (ATEM → Sony direct)
ATEM sends int32 ISO value directly (category=1, param=6).
Sony 0xD21E accepts absolute UINT32. Just send it.

```typescript
function atemISOToSony(atemISO: number): number {
  // Clamp to valid Sony values
  const valid = [100,200,400,800,1600,3200,6400,12800,25600,51200,102400]
  // find nearest
  return valid.reduce((a, b) => Math.abs(b - atemISO) < Math.abs(a - atemISO) ? b : a)
}
```

## White Balance Conversion
ATEM category=1, param=0: int16[0]=WB mode, int16[1]=tint

```typescript
// ATEM WB mode → Sony DPC_WHITE_BALANCE (0x5005):
const WB_MAP: Record<number, number> = {
  1: 0x0001,  // Auto
  2: 0x0002,  // Daylight
  3: 0x0003,  // Cloudy
  4: 0x0005,  // Tungsten/Incandescent
  5: 0x0006,  // Fluorescent
  // Color temp: ATEM sends mode=8 with Kelvin in int16[1] or separate param
}
// If ATEM sends Kelvin: set Sony 0x5005=0x8010, then set 0xD20F=Kelvin value
```

## ExpComp
ATEM does not have a direct expcomp camera control command in most firmware.
If received via category=1 param=4: float[0] normalized -1.0 to +1.0

```typescript
function atemExpCompToSony(atemFloat: number): number {
  // -1.0 = -5EV, +1.0 = +5EV, Sony INT16 × 1000
  return Math.round(atemFloat * 5000)
}
// Use SetExtDevicePropValue with INT16 value
```

## Record Toggle
No standard ATEM camera control category for record. Use ATEM Transport Control or handle via UI button in bridge.
Bridge: UI sends "record" → mapper calls Sony MovieRec button sequence:
```
ControlDevice(0xD2C8, [0x81, 0x01, 0x02])  // ButtonCode=0x01(MovieRec), Down=0x02
wait 100ms
ControlDevice(0xD2C8, [0x81, 0x01, 0x03])  // Up=0x03
```

## Config Schema
```json
{
  "atemIp": "192.168.1.100",
  "cameras": [
    { "id": "cam1", "name": "Camera 1", "ip": "192.168.1.11", "atm_slot": 1 }
  ]
}
```
atm_slot = ATEM cameraId (1-indexed). Match to cmd.cameraId.

## Bridge Logic Summary
```typescript
// In mapper.ts:
atem.on('receivedCommands', (cmds) => {
  for (const cmd of cmds) {
    if (!(cmd instanceof Commands.CameraControlUpdateCommand)) continue
    const cam = getCameraBySlot(cmd.cameraId)  // lookup from config
    if (!cam) continue
    const { category, parameter } = cmd
    if (category === 0 && parameter === 2) {
      // iris → notch FNumber
    } else if (category === 1 && parameter === 6) {
      // ISO → SetExtDevicePropValue 0xD21E
    } else if (category === 1 && parameter === 5) {
      // shutter → notch 0xD20D
    } else if (category === 1 && parameter === 0) {
      // WB → SetExtDevicePropValue 0x5005
    }
  }
})
```
