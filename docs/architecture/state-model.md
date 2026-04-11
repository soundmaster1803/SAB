# SAB — State Model

Version: 0.4.0
Last updated: 2026-04-11

This document defines the layered state model for Sony cameras and ATEM switcher state.

---

## Principle

Device state must always use three layers. Never a single flat object.

| Layer | Purpose |
|-------|---------|
| Raw | Parsed values directly from the device protocol |
| Derived | Computed, human-usable values and normalized semantics |
| Alert | Warning conditions that the operator must act on |

Each layer is independently typed. Each layer is independently updated. No layer owns another.

---

## Sony state layers

### SonyRawState

Values as parsed directly from PTP property responses. No conversion, no interpretation.

```typescript
interface SonyRawState {
  cameraId: string;
  modelName: string;
  connected: boolean;
  lastPollAt: number;         // Unix ms

  // Exposure (raw PTP codes)
  isoRaw: number;             // Raw ISO property value
  shutterRaw: number;         // Raw shutter property value
  apertureRaw: number;        // Raw aperture / iris property value
  evRaw: number;              // Raw EV value

  // Focus
  focusModeRaw: number;       // AF / MF / etc. (raw code)
  focusPositionRaw: number;   // MF position (0–65535)

  // Recording
  recordingStateRaw: number;  // raw record state code

  // Media
  batteryLevelRaw: number;    // Battery percent or raw code
  remainingRecordTimeRaw: number; // Seconds remaining

  // Color
  wbModeRaw: number;          // WB mode code
  wbColorTempRaw: number;     // CT in Kelvin (if applicable)

  // ND (if camera supports it)
  ndModeRaw?: number;
  ndValueRaw?: number;
}
```

### SonyDerivedState

Computed from `SonyRawState`. Human-readable and normalized.

```typescript
interface SonyDerivedState {
  cameraId: string;

  // Exposure (human labels)
  isoLabel: string;           // e.g. "ISO 800"
  shutterLabel: string;       // e.g. "1/250"
  apertureLabel: string;      // e.g. "f/2.8"
  evLabel: string;            // e.g. "+0.3 EV"
  exposureIndex: number;      // Numeric EV for comparison

  // Focus
  focusModeLabel: string;     // "AF-S", "AF-C", "MF"
  focusPositionNorm: number;  // 0.0–1.0 normalized

  // Recording
  isRecording: boolean;
  recordingStateLabel: string;

  // Media
  batteryPercent: number;     // 0–100
  remainingRecordSeconds: number;
  remainingRecordLabel: string; // "1h 23m"

  // Color
  wbModeLabel: string;        // "Auto", "Daylight", "3200K", etc.
  colorTempKelvin: number | null;

  // ND (if applicable)
  ndEnabled?: boolean;
  ndLabel?: string;           // "ND4", "ND16", etc.
}
```

### SonyAlertState

Warning conditions derived from both raw and derived state.

```typescript
interface SonyAlertState {
  cameraId: string;
  hasAlerts: boolean;

  lowBattery: boolean;        // Below threshold (default: 20%)
  criticalBattery: boolean;   // Below critical threshold (default: 10%)
  noMedia: boolean;           // No SD card or media inserted
  mediaFull: boolean;         // Less than 1 minute remaining
  connectionStale: boolean;   // Last poll > 5 seconds ago
  recordingError: boolean;    // Camera reported recording fault
}
```

---

## Sony state update flow

```
PTP poll response
  → parse raw values → SonyRawState
  → derive human values → SonyDerivedState
  → derive alert conditions → SonyAlertState
  → publish to WS broadcaster
  → update bridge sync state
  → trigger feedback updates
```

High-priority and low-priority polling update different fields of `SonyRawState`.
Full derivation runs after every poll update.

---

## ATEM state layers

### AtemRawState

Values directly from the `atem-connection` library. Not converted or interpreted.

```typescript
interface AtemRawState {
  connected: boolean;
  modelName: string | null;
  lastEventAt: number;        // Unix ms

  // Tally (per input)
  tallyProgram: Set<number>;  // Input IDs in PGM
  tallyPreview: Set<number>;  // Input IDs in PVW

  // Camera control (per input)
  cameraControlState: Map<number, AtemCameraControlRaw>;
}

interface AtemCameraControlRaw {
  inputId: number;
  iris: number;               // 0.0–1.0
  focus: number;              // 0–65535
  gain: number;               // dB or index
  whiteBalance: number;       // Kelvin
  shutter: number;            // Speed index
  zoomPosition: number;       // 0–65535
  zoomSpeed: number;          // -1.0–1.0
}
```

### AtemDerivedState

Normalized ATEM state for policy checks and UI.

```typescript
interface AtemDerivedState {
  connected: boolean;
  modelLabel: string;

  // Per-input tally labels
  tallyByInput: Map<number, 'program' | 'preview' | 'none'>;

  // Per-input camera control (ready for intent generation)
  cameraControlByInput: Map<number, {
    inputId: number;
    irisNorm: number;
    focusNorm: number;
    isoLabel: string | null;
    shutterLabel: string | null;
    wbKelvin: number | null;
  }>;
}
```

---

## Bridge state

Bridge state is not a device state — it is the operational state of the bridge itself.

```typescript
interface BridgeState {
  // Camera-to-input bindings
  bindings: Map<string, number>;  // cameraId → ATEM input ID

  // Per-camera throttle (canSend)
  lastCmdTime: Map<string, number>;

  // Per-(camera, property) anti-loop cooldown
  syncCooldowns: Map<string, number>;  // key: `${cameraId}:${property}`

  // Pending intents (if queuing is enabled)
  pendingIntents: ControlIntent[];
}
```

---

## WS broadcast shape

The WebSocket `state` message sent to the UI combines all state layers into a single view model.
The view model is computed in `src/api/viewmodels/camera.ts`.

The shape of the WS `state` message must never change without a migration plan.
The UI depends on it directly.

Current shape (reference): see `uiState()` in `src/api/server.ts` (Phase 3 extraction target).

---

## State update ownership

| State type | Owner | Updated by |
|-----------|-------|-----------|
| SonyRawState | Sony domain | ptp-client.ts polling |
| SonyDerivedState | Sony domain | state/derived.ts after each poll |
| SonyAlertState | Sony domain | state/alerts.ts after each poll |
| AtemRawState | ATEM domain | atem/listener.ts on event |
| AtemDerivedState | ATEM domain | atem/state/derived.ts on event |
| BridgeState | Bridge domain | bridge/policies/ + bridge/sync/ |
