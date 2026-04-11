# SAB — Current System

Version: 0.8.0
Last updated: 2026-04-11 (Phase 6 Step 2 complete — ATEM state + registries)

---

## Source tree

```
src/
  index.ts              — bootstrap + tally sync (lean)                        [clean]
  config.ts             — config file I/O
  logger.ts             — logger + WS event bus
  api/
    server.ts           — HTTP routes + WS + UI formatting                     [OVERFULL]
  atem/
    listener.ts         — ATEM transport + tally + syncCameraStateToAtem       [mixed]
    state/
      raw.ts            — ATEMRawState, AtemTallyEntry                         [skeleton]
      derived.ts        — ATEMDerivedState + deriveATEMState()                  [skeleton]
    actions/
      index.ts          — AtemActionId, AtemActionDefinition, ATEM_ACTIONS     [skeleton]
    variables/
      index.ts          — AtemVariableId, AtemVariableDefinition, ATEM_VARIABLES [skeleton]
    feedbacks/
      index.ts          — AtemFeedbackId, AtemFeedbackDefinition, ATEM_FEEDBACKS [skeleton]
  bridge/
    mapper.ts           — pure ATEM→Sony converters                            [clean]
    atem-decoder.ts     — ATEM command decoder                                 [clean]
    policies/
      throttle.ts       — canSend() — 200ms per camera/property                [clean]
      anti-loop.ts      — enterCooldown() / isInCooldown() — 500ms sync guard  [clean]
    intents/
      types.ts          — BridgeProperty, ControlIntent                        [clean]
      decoder.ts        — decodeControlIntent() — ATEM cmd → ControlIntent     [clean]
    executors/
      sony-command-executor.ts — executeSonyIntent() — intent → Sony PTP       [clean]
  sony/
    ptp-client.ts       — PTP/IP transport, handshake, polling, control        [clean]
    manager.ts          — camera lifecycle                                     [clean]
    constants.ts        — prop codes, opcodes, button values                   [clean]
    packet-builder.ts   — PTP packet construction                              [clean]
    models/
      types.ts          — SonyModelSpec, SonyCapabilities, SonyPtpVersion      [skeleton]
      fx30.ts           — FX30 confirmed spec (PTP3 v1.0+)                     [skeleton]
      zve10m2.ts        — ZV-E10 II confirmed spec (PTP3 v1.2)                 [skeleton]
      fx6.ts            — FX6 stub spec (PTP3 v1.0, unverified)                [stub]
      z200.ts           — PXW-Z200 stub spec (PTP3 v1.3, unverified)           [stub]
      index.ts          — getSonyModelSpec() / getAllSonyModelSpecs()           [skeleton]
    state/
      raw.ts            — SonyRawState interface                                [skeleton]
      derived.ts        — SonyDerivedState + deriveSonyState()                  [skeleton]
      alerts.ts         — SonyAlertState + deriveSonyAlerts()                   [skeleton]
    actions/
      index.ts          — SonyActionId, SonyActionDefinition, SONY_ACTIONS      [skeleton]
    variables/
      index.ts          — SonyVariableId, SonyVariableDefinition, SONY_VARIABLES [skeleton]
    feedbacks/
      index.ts          — SonyFeedbackId, SonyFeedbackDefinition, SONY_FEEDBACKS [skeleton]
    presets/
      index.ts          — SonyPresetDefinition, SONY_PRESETS (empty)            [skeleton]
```

---

## Domain violations (as of Phase 1 complete)

### src/index.ts — RESOLVED ✅
All bridge logic extracted. Now contains only: bootstrap, tally sync, ATEM event wiring,
and the three-line handleCameraControl pipeline (decode → intent → executor).

### src/api/server.ts — OVERFULL (Phase 3 target)

| Symbol | Correct domain |
|--------|---------------|
| `PROP_MAP` | api/viewmodels/camera |
| `decodeShutter()` | api/viewmodels/camera |
| `decodeISO()` | api/viewmodels/camera |
| `uiState()` | api/viewmodels/camera |
| WS setup and broadcast | api/ws/broadcaster |
| Camera routes | api/routes/cameras |
| ATEM routes | api/routes/atem |
| Status/interfaces routes | api/routes/status |

### src/atem/listener.ts — mixed (Phase 2 target)

| Symbol | Correct domain |
|--------|---------------|
| `syncCameraStateToAtem()` | bridge/sync |

Note: `syncCooldowns` resolved — extracted to `bridge/policies/anti-loop.ts` in Phase 1.

---

## Known structural issues

- Single polling tier at 200ms for all Sony properties (Phase 7 target)
- `syncCameraStateToAtem()` remains in ATEM transport layer (Phase 2 target)
- Model spec skeleton added (Phase 4 Step 1) — not yet wired to runtime (Phase 8 target)
- No action, variable, feedback, or preset registry (Phase 6 target)
- State layer skeletons added (Phase 5) — not yet wired to runtime (Phase 8 target)
- Single flat camera state object still used at runtime (SonyRawState not yet wired)
- Sony registry skeletons added (Phase 6 Step 1) — not yet wired to runtime (Phase 8 target)
- ATEM state and registry skeletons added (Phase 6 Step 2) — not yet wired to runtime (Phase 8 target)
- No action, variable, feedback, or preset execution wiring yet

---

## File sizes (approximate, post Phase 1)

| File | Lines | Status |
|------|-------|--------|
| src/index.ts | ~60 | Clean |
| src/api/server.ts | ~500 | Overfull |
| src/atem/listener.ts | ~190 | Mixed |
| src/bridge/policies/throttle.ts | ~13 | Clean |
| src/bridge/policies/anti-loop.ts | ~22 | Clean |
| src/bridge/intents/types.ts | ~78 | Clean |
| src/bridge/intents/decoder.ts | ~70 | Clean |
| src/bridge/executors/sony-command-executor.ts | ~115 | Clean |
| src/sony/ptp-client.ts | ~600 | Clean |
| src/sony/manager.ts | ~150 | Clean |
| src/bridge/mapper.ts | ~80 | Clean |
| src/bridge/atem-decoder.ts | ~60 | Clean |
| src/sony/constants.ts | ~80 | Clean |
| src/sony/packet-builder.ts | ~100 | Clean |
| src/config.ts | ~50 | Clean |
| src/logger.ts | ~80 | Clean |

---

## Working capabilities (verified)

- Sony PTP/IP handshake and session establishment
- Sony property polling (ISO, shutter, aperture, focus, battery, record state)
- Sony camera control (iris, focus, shutter, ISO, WB, recording)
- ATEM connection and tally reception
- ATEM camera-control command reception and dispatch to Sony
- HTTP API for camera state and ATEM state
- WebSocket broadcast of camera state to UI
- Operator web console (public/index.html)
- Config file I/O (config.json)

---

## Files that must not be modified during Phases 1–3

| File | Reason |
|------|--------|
| `src/sony/ptp-client.ts` | Working PTP transport |
| `src/sony/manager.ts` | Working camera lifecycle |
| `src/sony/packet-builder.ts` | Working packet construction |
| `src/sony/constants.ts` | Single source of Sony constants |
| `src/bridge/mapper.ts` | Clean converter — do not disturb |
| `src/bridge/atem-decoder.ts` | Clean decoder — do not disturb |
| `src/config.ts` | Config I/O — do not disturb |
| `src/logger.ts` | Logger — do not disturb |
