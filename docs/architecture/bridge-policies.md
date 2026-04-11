# SAB — Bridge Policies

Version: 0.4.0
Last updated: 2026-04-11

This document defines all bridge domain policies: throttle, anti-loop, intent flow, and conversion rules.

---

## Intent flow (mandatory)

All ATEM → Sony commands must follow this chain. No shortcuts. No exceptions.

```
ATEM event
  → ControlIntent (normalized, domain-typed)
  → Capability check  (does the camera support this action?)
  → Policy check      (throttle + anti-loop)
  → Conversion        (ATEM values → Sony values)
  → Executor          (Sony PTP command dispatch)
  → State update      (camera raw state + derived state)
  → Feedback update   (variables + feedbacks)
```

Violations of this chain — such as mapping ATEM events directly to Sony commands inside `src/index.ts` — are Phase 1 extraction targets.

---

## ControlIntent type

```typescript
interface ControlIntent {
  cameraId: string;          // Which camera
  property: SonyProperty;    // Which property (ISO, shutter, iris, focus, etc.)
  value: number;             // Raw requested value (ATEM units)
  source: 'atem' | 'api';   // Origin of the intent
  timestamp: number;         // Intent creation time (ms)
}
```

Intent is normalized before any policy or conversion check.
Raw ATEM values are never passed directly to Sony executors.

---

## Throttle policy

**Location:** `src/bridge/policies/throttle.ts`

**Purpose:** Prevent sending Sony PTP commands faster than the camera can process them.

**Rule:** A Sony command may only be sent if `now - lastCmdTime[cameraId] >= MIN_INTERVAL_MS`.

**Current MIN_INTERVAL_MS:** 80ms (per camera, not global)

**canSend() signature:**
```typescript
function canSend(cameraId: string): boolean
function markSent(cameraId: string): void
```

**State:** `lastCmdTime: Map<string, number>` — per-camera timestamp of last sent command.

**Violations logged:** Yes — log at debug level when throttled.

**Current violation:** This logic lives in `src/index.ts` as an inline variable. Phase 1 extracts it.

---

## Anti-loop policy

**Location:** `src/bridge/policies/anti-loop.ts`

**Purpose:** Prevent a Sony state change (triggered by an ATEM command) from being re-read as a new ATEM event and looping.

**Problem it solves:** SAB writes a camera property. The camera's poll response reflects the new value. `syncCameraStateToAtem()` reads that value and tries to update ATEM with it. ATEM sends a camera-control event. SAB interprets it as a new command. Loop.

**Rule:** After a Sony command is sent for property `P` on camera `C`, suppress incoming ATEM events for `P` on `C` for `COOLDOWN_MS`.

**Current COOLDOWN_MS:** 500ms

**syncCooldowns signature:**
```typescript
function enterCooldown(cameraId: string, property: SonyProperty): void
function isInCooldown(cameraId: string, property: SonyProperty): boolean
```

**State:** `syncCooldowns: Map<string, number>` — per-(camera, property) expiry timestamp.

**Current violation:** `syncCooldowns` lives in `src/atem/listener.ts`. Phase 1/2 extracts it.

---

## Conversion rules

**Location:** `src/bridge/conversion/` (to be created) and currently `src/bridge/mapper.ts`

### ATEM iris → Sony iris

ATEM iris is sent as a float 0.0–1.0 normalized value.
Sony iris is controlled via aperture steps.

Conversion: map ATEM 0.0–1.0 to Sony aperture step list derived from model spec.
The exact mapping is in `src/bridge/mapper.ts`.

### ATEM focus → Sony focus

ATEM focus is 0–65535 (0x0000–0xFFFF).
Sony focus (MF position) is also a 16-bit value but scaled differently by camera model.

Current mapping: direct passthrough (approximate). Needs calibration per model.

### ATEM shutter → Sony shutter

ATEM sends shutter as a speed index value.
Sony shutter is set by property code with a list of valid values.

Conversion: `decodeShutter()` maps ATEM index to Sony shutter speed value.
Located currently in `src/api/server.ts` — Phase 3 extraction target.

### ATEM ISO → Sony ISO

ATEM ISO is a gain value in dB or a direct ISO integer.
Sony ISO is set by property code with a list of valid ISO values.

Conversion: `decodeISO()` maps ATEM gain to Sony ISO value.
Located currently in `src/api/server.ts` — Phase 3 extraction target.

---

## Sync policy (ATEM ← Sony)

**Location:** `src/bridge/sync/atem-sync.ts` (to be created)

**Purpose:** When Sony camera state changes (from polling), update ATEM camera-control state so the ATEM hardware reflects the camera's real state.

**Current violation:** `syncCameraStateToAtem()` lives in `src/atem/listener.ts`. Phase 2 extracts it.

**Sync properties:**
- ISO
- Shutter
- Iris / aperture
- White balance

**Anti-loop integration:** All sync writes must call `enterCooldown()` before sending.

---

## Policy interaction order

When an ATEM event arrives:

1. Decode to ControlIntent (`bridge/intents/decoder.ts`)
2. Check `isInCooldown()` — if true, discard the event (anti-loop)
3. Check `canSend()` — if false, discard or queue (throttle)
4. Run capability check — if not supported, log and discard
5. Convert ATEM values to Sony values (`bridge/conversion/`)
6. Call executor (`bridge/executors/sony-command-executor.ts`)
7. Call `markSent()` (throttle)
8. Call `enterCooldown()` (anti-loop)
