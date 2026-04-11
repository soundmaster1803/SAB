# SAB — Target Architecture

Version: 0.4.0
Last updated: 2026-04-11

---

## Target source tree

```
src/
  core/
    types/                    — shared primitive types
    events/                   — event bus definitions
    alerts/                   — alert type registry
    logging/                  — logger abstraction
    config/                   — config types and loader
    state/                    — shared state primitives

  sony/
    transport/                — PTP/IP socket and session
    protocol/                 — PTP command encoding/decoding
    packet-builder/           — PTP packet construction
    constants/                — prop codes, opcodes, button values
    models/
      types.ts                — SonyModelSpec, SonyCapabilities interfaces
      fx30.ts                 — FX30 static spec (confirmed capabilities only)
      index.ts                — getModelSpec(modelName)
    capabilities/             — capability derivation from model spec
    polling/
      high-priority.ts        — ISO, shutter, iris, battery, record (200ms)
      low-priority.ts         — focus mode, WB, ND, overlays (1000ms+)
    state/
      raw.ts                  — SonyRawState (parsed PTP values)
      derived.ts              — SonyDerivedState (computed EV, exposure index, etc.)
      alerts.ts               — SonyAlertState (battery, card, stale poll)
    executors/
      direct-command-sender.ts
      step-prop-executor.ts
      preset-applier.ts
    actions/
      lens.ts
      focus.ts
      exposure.ts
      color.ts
      media.ts
      recording.ts
      display.ts
      presets.ts
    variables/
    feedbacks/
    services/

  atem/
    transport/                — ATEM socket connection
    listener/                 — ATEM event parsing
    models/                   — AtemModelSpec
    capabilities/
    state/
      raw.ts                  — AtemRawState
      derived.ts              — AtemDerivedState
    executors/
    actions/
      routing.ts
      camera-control.ts
      multiview.ts
      macros.ts
      recording.ts
    variables/
    feedbacks/
    services/

  bridge/
    intents/
      types.ts                — ControlIntent interface
      decoder.ts              — ATEM command → ControlIntent
    bindings/                 — camera-to-input bindings
    conversion/               — ATEM values → Sony values
    policies/
      throttle.ts             — canSend() / lastCmdTime
      anti-loop.ts            — syncCooldowns
    sync/
      atem-sync.ts            — syncCameraStateToAtem()
    executors/
      sony-command-executor.ts
    actions/
    variables/
    feedbacks/

  api/
    routes/
      cameras.ts
      atem.ts
      bridge.ts
      presets.ts
      alerts.ts
      status.ts
    ws/
      broadcaster.ts
    viewmodels/
      camera.ts               — uiState(), decodeShutter(), decodeISO(), PROP_MAP

frontend/
  src/
    pages/
    components/
    stores/
    hooks/
    panels/
      cameras/
      atem/
      bridge/
      alerts/
      presets/
      logs/
```

---

## Bridge intent flow (mandatory path)

All ATEM → Sony commands must follow this chain exactly. No shortcuts.

```
ATEM event
  → ControlIntent (normalized, typed)
  → Capability check (does camera support this?)
  → Policy check (throttle, anti-loop)
  → Conversion (ATEM values → Sony values)
  → Executor (Sony PTP command)
  → State / feedback / variable update
```

---

## Polling tier design

### High priority (200ms)
- ISO
- Shutter speed
- Aperture / iris
- Recording state
- Battery level
- Remaining record time
- Connection freshness

### Low priority (1000ms+)
- Focus mode
- White balance mode
- ND mode
- Overlays and assist tools
- Optional media metadata

---

## State layer design

| Layer | Type | Contains |
|-------|------|---------|
| Raw | `SonyRawState` | Values as parsed from PTP device |
| Derived | `SonyDerivedState` | Computed values (EV, exposure index, human labels) |
| Alert | `SonyAlertState` | Warning conditions (low battery, card full, stale poll) |

State must never be a single flat object.
Each layer is independently typed and independently updated.

---

## Capability gating

Actions, feedbacks, presets, and variables must be filtered by capability.

```
SonyModelSpec
  → SonyCapabilities (derived at connect time)
    → Action registry (filtered)
    → Feedback registry (filtered)
    → Variable registry (filtered)
    → Preset registry (filtered)
```

A camera that has no ND hardware must have no ND actions.
Never assume capabilities. Only declare what is confirmed.

---

## Anti-loop and throttle design

Both live exclusively in `src/bridge/policies/`.

| Module | Responsibility |
|--------|---------------|
| `throttle.ts` | Rate-limits outbound Sony commands (`canSend()`, `lastCmdTime`) |
| `anti-loop.ts` | Prevents ATEM sync from re-triggering itself (`syncCooldowns`) |

Neither module may be imported by Sony transport or ATEM transport directly.
Both are bridge domain concerns.

---

## Entry point constraints

### src/index.ts must only:
- Initialize logging
- Load config
- Instantiate core modules
- Wire modules together
- Start services

### src/api/server.ts must only:
- Register routes from route modules
- Register WS handler
- Start HTTP server

No domain logic in either entrypoint.
