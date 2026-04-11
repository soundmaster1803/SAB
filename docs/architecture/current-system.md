# SAB — Current System

Version: 0.4.0
Last updated: 2026-04-11

---

## Source tree

```
src/
  index.ts              — bootstrap + bridge dispatch + throttle + tally sync  [OVERFULL]
  config.ts             — config file I/O
  logger.ts             — logger + WS event bus
  api/
    server.ts           — HTTP routes + WS + UI formatting                     [OVERFULL]
  atem/
    listener.ts         — ATEM transport + tally + syncCameraStateToAtem       [mixed]
  bridge/
    mapper.ts           — pure ATEM→Sony converters                            [clean]
    atem-decoder.ts     — ATEM command decoder                                 [clean]
  sony/
    ptp-client.ts       — PTP/IP transport, handshake, polling, control        [clean]
    manager.ts          — camera lifecycle                                     [clean]
    constants.ts        — prop codes, opcodes, button values                   [clean]
    packet-builder.ts   — PTP packet construction                              [clean]
```

---

## Domain violations (as of 2026-04-11)

### src/index.ts — OVERFULL

| Symbol | Correct domain |
|--------|---------------|
| `handleCameraControl()` | bridge/executors |
| `canSend()` / `lastCmdTime` | bridge/policies/throttle |
| `prevFocus` state | bridge/policies/anti-loop |
| ATEM → Sony direct dispatch | bridge/intents |

### src/api/server.ts — OVERFULL

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

### src/atem/listener.ts — mixed

| Symbol | Correct domain |
|--------|---------------|
| `syncCameraStateToAtem()` | bridge/sync |
| `syncCooldowns` | bridge/policies/anti-loop |

---

## Known structural issues

- Single polling tier at 200ms for all Sony properties
- No intent layer — ATEM events map directly to Sony PTP commands in index.ts
- Throttle (`canSend`) and anti-loop (`syncCooldowns`) scattered across index.ts and listener.ts
- No model spec system — capabilities assumed, not declared
- No action, variable, feedback, or preset registry
- No state layers — single flat camera state object

---

## File sizes (approximate, 2026-04-11)

| File | Lines | Status |
|------|-------|--------|
| src/index.ts | ~350 | Overfull |
| src/api/server.ts | ~500 | Overfull |
| src/atem/listener.ts | ~250 | Mixed |
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
