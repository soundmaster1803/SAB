# SAB — Current System

Version: 1.0.1-beta
Last updated: 2026-05-13

---

## Source tree

```
electron/
  main.js           — Electron main: spawn bridge child, tray icon, IPC, window lifecycle
  preload.js        — contextBridge: exposes get-status / open-url / hide / quit to renderer
  launcher.html     — launcher UI: status dot, URL list, Open UI / Hide / Quit buttons
  assets/
    icon.icns       — macOS app icon (all iconset sizes, from real SAB logo)
    icon.ico        — Windows app icon
    tray.png        — menu bar icon (32×32 PNG, macOS only)

electron-builder.yml — packaging: universal DMG (mac), NSIS + ZIP (win)
scripts/
  copy-native-prebuilds.js  — copies freetype2 .node files into dist/ for packaging
  make-icons.js             — generates icon.icns + icon.ico from source PNG
  build-cleaners.js         — builds SAB-Cleaner.app (osacompile) + SAB-Cleaner.exe (NSIS)
  collect-release.js        — copies installers + cleaners into releases/v<version>/
  SAB-Cleaner.applescript   — AppleScript source for Mac cleaner
  SAB-Cleaner.nsi           — NSIS source for Windows cleaner

src/
  index.ts              — bootstrap: config load, manager/listener init, wireBridgeRuntime  [clean]
  config.ts             — config file I/O (loadConfig, saveConfig, addCamera, removeCamera)
  logger.ts             — logger + logBus EventEmitter (WS log broadcast)
  version.ts            — reads VERSION file at startup

  api/
    server.ts           — HTTP bootstrap: express + http.Server + route wiring              [clean, 68 lines]
    routes/
      cameras.ts        — camera management endpoints (POST/PATCH/DELETE)
      atem.ts           — ATEM connect/disconnect endpoints
      status.ts         — GET /api/status, /api/interfaces
    ws/
      broadcaster.ts    — WS server: 500ms state broadcast, 150ms log flush
    viewmodels/
      camera.ts         — uiState() — CameraState → UI payload (raw + derived + alerts)
      atem.ts           — uiAtemState() — ATEM raw + derived state
    services/
      cameras.ts        — camera service helpers (80 lines)
      network.ts        — listLanInterfaces()
      sony-debug.ts     — buildSonyDebugPayload() — debug endpoint only

  atem/
    listener.ts         — ATEM transport + tally + camera-control dispatch                  [mixed, 163 lines]
    state/
      raw.ts            — ATEMRawState, AtemTallyEntry                                      [wired via getRawState()]
      derived.ts        — ATEMDerivedState + deriveATEMState()                               [wired via uiAtemState()]
    actions/index.ts    — AtemActionId, ATEM_ACTIONS                                        [skeleton, Phase 8]
    variables/index.ts  — AtemVariableId, ATEM_VARIABLES                                    [skeleton, Phase 8]
    feedbacks/index.ts  — AtemFeedbackId, ATEM_FEEDBACKS                                    [skeleton, Phase 8]
    models/
      types.ts          — ATEMModelSpec, ATEMCapabilities                                   [skeleton, Phase 8]
      index.ts          — getATEMModelSpec()                                                [skeleton, Phase 8]

  bridge/
    runtime.ts          — wireBridgeRuntime() — orchestration core
    mapper.ts           — pure ATEM→Sony value converters                                   [clean]
    atem-decoder.ts     — ATEM command decoder helpers                                      [clean]
    policies/
      throttle.ts       — canSend() — 200ms per camera/property
      anti-loop.ts      — enterCooldown() / isInCooldown() — 500ms sync guard
    intents/
      types.ts          — BridgeProperty, ControlIntent, AtemControlPayload
      decoder.ts        — decodeControlIntent() — ATEM cmd → ControlIntent
    executors/
      sony-command-executor.ts — executeSonyIntent() + clearPrevFocus()                     [127 lines]
    sync/
      atem-sync.ts      — syncCameraStateToAtem() — reverse sync push to ATEM
    actions/index.ts    — skeleton                                                          [Phase 8]
    variables/index.ts  — skeleton                                                          [Phase 8]
    feedbacks/index.ts  — skeleton                                                          [Phase 8]

  sony/
    ptp-client.ts       — PTP/IP transport, handshake, polling, control                    [932 lines, core]
    manager.ts          — CameraManager — camera lifecycle                                  [175 lines]
    constants.ts        — PROP_CODES, OPCODES, BUTTON_VALUES, PROP_CODES_EXT
    packet-builder.ts   — PTP packet construction
    protocol/
      prop-knowledge.ts — central knowledge table: 150+ PTP3 props, semantics, safety      [1625 lines]
    runtime/
      types.ts          — RuntimePropDescriptor, RuntimeCapabilities (34 flags), RuntimeCameraModel
      builder.ts        — buildRuntimeCameraModel() + updateRuntimeModel()                  [376 lines, wired v0.11.0]
    polling/
      strategy.ts       — getPollPriority(), filterSafeToRead(), getPollSummary()           [118 lines, wired in ptp-client]
    models/
      types.ts          — SonyModelSpec, SonyCapabilities (display metadata types)
      fx30.ts           — FX30 display metadata + PTP version hint
      zve10m2.ts        — ZV-E10 II display metadata
      fx6.ts            — FX6 metadata stub
      z200.ts           — PXW-Z200 metadata stub
      index.ts          — getSonyModelSpec() — used only by debug endpoint
    state/
      raw.ts            — SonyRawState interface
      derived.ts        — SonyDerivedState + deriveSonyState()
      alerts.ts         — SonyAlertState + deriveSonyAlerts()
      runtime.ts        — getSonyRuntimeState() — assembles all three layers                [wired v0.12.0]
    actions/index.ts    — SonyActionId, SONY_ACTIONS                                        [skeleton, Phase 8]
    variables/index.ts  — SonyVariableId, SONY_VARIABLES                                    [skeleton, Phase 8]
    feedbacks/index.ts  — SonyFeedbackId, SONY_FEEDBACKS                                    [skeleton, Phase 8]
    presets/index.ts    — SonyPresetDefinition, SONY_PRESETS (empty)                        [skeleton, Phase 8]
```

---

## Domain violations

### Resolved ✅
- `src/index.ts` — all bridge logic extracted (Phase 1)
- `src/api/server.ts` — all viewmodel/routing logic extracted (Phase 3)
- `src/atem/listener.ts` — `syncCameraStateToAtem()` extracted to `bridge/sync/` (Phase 2)

### Remaining: `src/atem/listener.ts` — minor mix
`readyAfterMs` timestamp is a bridge policy value surfaced via `getRawState()` — architecturally belongs in bridge layer. Low priority — functionally clean, no behavior issue.

---

## Known structural issues

- Single polling tier at 200ms for all Sony properties — **Phase 7 target**
- `sony/models/` static specs not wired to runtime capability gating — **Phase 8 target**
- Action/variable/feedback/preset registries exist as skeletons, not wired to execution — **Phase 8 target**
- Command path still uses flat `CameraState`; read path uses derived state layers (correct direction)

---

## Key file sizes

| File | Lines | Status |
|------|-------|--------|
| src/sony/ptp-client.ts | 932 | Core transport |
| src/sony/protocol/prop-knowledge.ts | 1625 | Protocol knowledge table |
| src/sony/runtime/builder.ts | 376 | Runtime model builder |
| src/bridge/executors/sony-command-executor.ts | 127 | Intent executor |
| src/sony/manager.ts | 175 | Camera lifecycle |
| src/atem/listener.ts | 163 | ATEM transport |
| src/sony/polling/strategy.ts | 118 | Poll tier logic |
| src/index.ts | ~60 | Bootstrap only |
| src/api/server.ts | 68 | HTTP bootstrap only |

---

## Working capabilities (verified v1.0.1-beta)

- Sony PTP/IP: handshake, session, polling (ISO/shutter/aperture/WB/battery/recState/recRemain)
- Sony camera control: iris, focus, AF, shutter, ISO, WB, recording toggle
- Live runtime camera model: 34 capability flags, 150+ prop codes, discovered per-camera at connect
- State layers: raw → derived → alerts, wired to WS broadcast and UI
- ATEM: connection, tally capture, camera-control command dispatch
- Bi-directional sync: ATEM → Sony + reverse Sony → ATEM on connect
- HTTP API: camera management, ATEM management, status, diagnostics
- WebSocket: 500ms state broadcast + 150ms log flush
- Operator web console (public/index.html): live camera cards with capabilities badges
- Config: config.json with SAB_CONFIG_PATH env override support
- Electron desktop app: universal DMG (arm64+x64) + NSIS installer; launcher window with tray icon, status, URL list; config not bundled — created fresh per machine

---

## Files that must not be modified

| File | Reason |
|------|--------|
| `src/sony/ptp-client.ts` | Working PTP transport |
| `src/sony/manager.ts` | Working camera lifecycle |
| `src/sony/packet-builder.ts` | Working packet construction |
| `src/sony/constants.ts` | Single source of Sony constants |
| `src/bridge/mapper.ts` | Clean converter |
| `src/bridge/atem-decoder.ts` | Clean decoder |
| `src/config.ts` | Config I/O |
| `src/logger.ts` | Logger |
