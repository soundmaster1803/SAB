# SAB — Changelog

---

## v0.18.0 — 2026-04-20 (Recording settings UI + Sony state expansion + docs overhaul)

### Added

#### UI — CameraCard recording controls
- File-format dropdown — lists only formats the connected camera reports (0xD241 enumeration). Selecting a format sends `PATCH /api/cameras/:id/file-format`.
- Rec-setting dropdown — filters by selected format; lists only matching framerate/bitrate modes (0xD242 enumeration). Auto-selects first valid option when format changes.
- Frame-rate dropdown — per-camera 0xD286 enumeration. Sends `PATCH /api/cameras/:id/rec-frame-rate`.
- Slot selector — three-way button (Slot 1 / Slot 2 / Simultaneous) backed by 0xD160 `recMedia`. Optimistic local state, syncs from camera.
- Format-card dialog — modal with slot choice (1 / 2) and type (Quick / Full). Confirmation step before sending.
- Elapsed-recording timer — local `setInterval` counter seeded from `recDurationSec`; ticks while camera is recording; resets on stop.
- Slot-status badges — color-coded indicators for both slots (OK / No Card / Error / Recognizing / Locked) driven by `slotStatus` / `slotStatus2`.
- Remaining-time display for slot 2 (`recRemainSec2`).

#### Sony — new raw state fields (ptp-client + state/raw)
| Property | PTP code | Description |
|---|---|---|
| `recDurationSec` | 0xD120 | Elapsed recording seconds |
| `slotStatus` | 0xD248 | Card-slot 1 status (0–7 codes) |
| `slotStatus2` | 0xD256 | Card-slot 2 status |
| `recRemainSec2` | 0xD258 | Remaining recordable seconds for slot 2 |
| `movieFileFormat` + `movieFileFormatList` | 0xD241 | File format + supported-format enumeration |
| `recSetting` + `recSettingList` | 0xD242 | Rec mode + per-format enumeration |
| `recMedia` | 0xD160 | Active recording slot |
| `recFrameRate` + `recFrameRateList` | 0xD286 | Frame rate + supported-rate enumeration |
| `focalDistanceMin/Max/Step/Enabled` | 0xD004 | Focus range metadata |

- `parseSonyPollEntries` — refactored into `detectSonyPollRecordCount` + `parseSonyPollEntriesFromOffset`; handles Sony's variable poll-blob layout more robustly.

#### WS types
- `ws.ts` expanded with all new raw state fields so the UI receives them over the existing WS channel without schema breakage.

#### Documentation infrastructure (full overhaul)
- `CLAUDE.md` — rewritten from scratch as a concise operating manual (≈80 lines vs 877).
- `PROJECT_MAP.md`, `RUNBOOK.md`, `WORKFLOW.md`, `AI_TASK_PROTOCOL.md` — new canonical reference docs.
- `docs/domains/sony.md`, `atem.md`, `bridge.md`, `ui.md`, `api.md` — per-domain knowledge files.
- `AI_PROMPT_TEMPLATES.md`, `TASK_ROUTER_SPEC.md`, `LOCAL_RESEARCH_LAYER.md`, `ROUTER_STATE.md`, `RESEARCH_PACKET_SPEC.md` — AI workflow tooling specs.
- `scripts/task-router.js`, `research-packet.js`, `local-llm-router.js`, `check-changed-files.js`, `execution-packet.js`, `router-normalizer.js`, `research-open-notebooklm.js` — local AI-assist scripts.
- `router.config.json` — task-router configuration.
- `knowledge/protocol/sony/README.md`, `knowledge/protocol/atem/README.md` — protocol knowledge stubs.

### Changed
- `frontend/src/components/Header.tsx` — action buttons collapse into an overflow dropdown menu on narrow viewports (hamburger `⋯` button, outside-click to dismiss).
- `src/atem/models/index.ts` — expanded ATEM model lookup table.

### Migration notes
- No API shape changes; new `PATCH` endpoints are additive.
- WS `raw` object gains new fields (all default to `0` / `[]` / `false` until camera reports them).
- `config.json` shape unchanged.

---

## v0.17.0 — 2026-04-19 (ATEM mDNS discovery)

### Added
- `src/atem/discovery.ts` — Bonjour/mDNS browser for `_blackmagic._tcp` services on the LAN. Bounded scan (default 3s), dedupes by IPv4, returns `{ ip, name, hostname, port, model? }` for each device. Resolves cleanly to an empty list on socket-bind failures (sandboxed environments) so the UI can display a "no devices found" state.
- `src/api/routes/atem.ts` — `GET /api/atem/discover?timeout=<ms>` exposes the discovery scan to the UI. Timeout clamped to `[500, 10000]` ms.
- `frontend/src/panels/atem/AtemBar.tsx` — magnifier-glass scan button glued to the IP input. Opens an absolutely-positioned dropdown of discovered switchers with rescan; clicking a row pre-fills the IP field. Closes on outside click or Escape.
- New dependency: `bonjour-service@^1.3.0` (pure-JS mDNS, no native build — keeps the runtime cross-platform per the deferred `src/platform/` plan).

### Changed
- `frontend/src/panels/atem/AtemBar.module.css` — IP input is now part of an `ipWrap` group with the scan button visually fused (radius split). New dropdown styles (`.dropdown`, `.dropdownItem`, `.ddIp`, `.ddName`, etc.) match the existing dark-glass aesthetic.

### Migration notes
- `config.json` shape unchanged.
- WS state message shape unchanged.
- All existing API endpoints unchanged in shape; one new `GET` added.

---

## v0.16.0 — 2026-04-19 (UI redesign — Header + AtemBar + Logs modal)

### Added
- `frontend/src/panels/atem/AtemBar.tsx` — new fixed bottom bar dedicated to ATEM. Three sections: connection row (IP + Connect/Disconnect + Auto-reconnect + detected model), per-input camera buttons with tally colors, and a per-button label showing the linked Sony camera name (or "not linked").
- `src/api/routes/atem.ts` — `PATCH /api/atem/settings` toggles `atemAutoReconnect` and persists to `config.json`.
- `src/api/routes/cameras.ts` — `POST /api/cameras/delete-all` disconnects and removes every camera in one shot (UI confirms).
- `src/config.ts` — `atemAutoReconnect: boolean` field (default true) controls whether the bridge auto-connects to `atemIp` on startup.
- `src/api/ws/broadcaster.ts` — `atemAutoReconnect` flag included in every WS state message so the UI checkbox stays in sync.

### Changed
- `frontend/src/components/Header.tsx` — full rewrite. Brand block is now `[SAB]` logo plate + "— Sony ATEM Bridge" + dynamic version badge. ATEM connect/disconnect controls moved out (to AtemBar). New right-side action group: REC ALL / Stop All / Delete All / Logs / Recall Settings (placeholder) / Camera Links (placeholder). `+ Add Camera` is in its own border-left group, easy to relocate later.
- `frontend/src/panels/logs/LogPanel.tsx` — converted from always-visible bottom drawer into a modal opened from the new `Logs` button (Esc to close, click backdrop to close).
- `frontend/src/App.tsx` — removed inline `<AtemPanel />` and bottom `<TallyBar />`. New layout: `Header` → `main` (camera grid) → fixed `AtemBar` + modal-rendered `LogPanel` / `DebugModal` / `AddCameraWizard`.
- `src/atem/listener.ts` — `atemModel` getter now prefers `state.info.productIdentifier` (full name like "ATEM Mini Pro"), falls back to `deviceName`.
- `src/index.ts` — startup ATEM auto-connect is gated by `atemAutoReconnect` flag. Renamed log labels from "CineLink Bridge" to "SAB".
- `frontend/src/styles/tokens.css` — replaced `--tally-h` / `--log-toolbar-h` / `--log-body-h` with single `--atem-bar-h: 180px`.
- `frontend/index.html` — title `CineLink Bridge` → `SAB — Sony ATEM Bridge`.
- `frontend/package.json` — name `cinelink-bridge-ui` → `sab-ui`.

### Removed
- `frontend/src/panels/TallyBar.tsx` + `.module.css` — replaced by AtemBar's per-input row.
- `frontend/src/panels/atem/AtemPanel.tsx` + `.module.css` — replaced by AtemBar.
- `frontend/src/panels/atem/TallyStrip.tsx` + `.module.css` — replaced by AtemBar.

### Migration notes
- No backwards-incompatible API changes; new fields and routes are additive.
- WS `state` message gains `atemAutoReconnect: boolean` (always present).
- `config.json` may have a new `atemAutoReconnect` key after first run; missing key defaults to `true` (preserves prior behavior).
- Old launcher / `npm run dev` users: backend serves the built UI from `public/`. Run `npm run build:ui` once after pulling, or use `npm run dev:ui` (Vite dev server on port 5173 with `/api` proxy → 7777) for hot reload.

---

## v0.15.2 — 2026-04-19 (Repository cleanup)

### Removed
- `Camera Control PTP 2 Reference.pdf`, `Camera Control PTP 3 Reference.pdf` — Sony reference PDFs (knowledge already extracted into `docs/research/ref-sony.md` and `docs/research/ref-cameras.md`).
- `scripts/launcher.swift`, `scripts/make-icon.swift`, `scripts/pack.sh` — beta-3 macOS launcher artifacts (deferred per Section 13; will return under `src/platform/macos/` when packaging phase resumes).
- `package.json` scripts `bundle:app`, `release:zip` — referenced removed `.app` paths.
- Obsolete `.gitignore` lines for `CineLink Bridge*.app/`, `CineLink-Bridge-*.zip`.

### Changed
- `package.json` `name` `cinelink-bridge` → `sab`; `version` `1.0.0-beta.3` → `0.15.2` (matches `VERSION` file); added `start` script (`node dist/bridge.cjs`).
- `.gitignore` rewritten — concise; ignores `public/index.html` (vite-generated) and `.claude/launch.json` (per-machine).
- `public/index.html` removed from git tracking — it is the vite build artifact.
- `frontend/src/assets/icons/*.png` — added to git (previously untracked, blocked production build).
- `CLAUDE.md` — Section 2 dated 2026-04-19, version snapshot v0.15.2; Section 7 branch table simplified to single trunk (`main`); Section 13 deferred-files list replaced with cleanup note.

### Migration notes
- After pulling: `npm install && npm run install:ui && npm run build:ui`. No source/runtime behavior changes — purely repo hygiene.

---

## v0.15.2 — 2026-04-18 (Focus control — backend + frontend)

### Added
- `src/sony/constants.ts` — `FOCUS_AREA` (0xD22C), `FOCUS_STEP_NEAR` (0xD2D7), `FOCUS_STEP_FAR` (0xD2D8) added to `PROP_CODES`; `FOCAL_DISTANCE_METER`, `FOCAL_DISTANCE_FEET`, `FOCUS_BRACKET_SHOT_NUM`, `AF_AREA_POSITION`, `FOCUS_POSITION_SETTING` (0xE042), `FOCUS_POSITION_CURRENT` (0xE043) added to `PROP_CODES_EXT`; value-constant maps `FOCUS_MODE_VALUES`, `FOCUS_AREA_VALUES`, `AF_STATUS_VALUES`.
- `src/sony/state/raw.ts` — `focusMode`, `afStatus`, `focalDistanceM` fields.
- `src/sony/state/derived.ts` — `focusModeDisplay`, `afStatusDisplay`, `focalDistanceDisplay` fields + pure decoders.
- `src/sony/state/runtime.ts` — `toSonyRawState()` passes through new focus fields.
- `src/sony/ptp-client.ts` — focus props extracted in `parseSonyProps()` (0x500A, 0xD213, 0xD004); new methods: `setFocusMode()`, `setFocusArea()`, `setFocusPositionAbsolute()`, `stepFocusNear()`, `stepFocusFar()`.
- `src/api/routes/cameras.ts` — three new endpoints: `POST /api/cameras/:id/focus-position`, `/focus-mode`, `/focus-step`.
- `src/sony/actions/index.ts` — focus action entries: `setFocusMode`, `setFocusArea`, `setFocusPosition`, `stepFocusNear`, `stepFocusFar`.
- `frontend/src/types/ws.ts` — `focusMode`, `afStatus`, `focalDistanceM` in `SonyRawState`; `focusModeDisplay`, `afStatusDisplay`, `focalDistanceDisplay` in `SonyDerivedState`.
- `frontend/src/panels/cameras/CameraCard.tsx` — focus mode toggle wired to `/focus-mode`; step near/far buttons on icon clicks; AF status badge; focal distance display; slider posts to now-working `/focus-position`.
- `frontend/src/panels/cameras/CameraCard.module.css` — `focusLabelRow`, `afStatus` badges (focused/tracking/searching), `focusStepBtn`, `focusBottom`, `focalDist`.

### Migration notes
- No API response shape changes. WS `state` message gains `focusMode`, `afStatus`, `focalDistanceM` in `raw` and three display strings in `derived` — additive only.

---

## v0.15.1 — 2026-04-17 (UI — CameraCard redesign)

### Changed
- `frontend/src/panels/cameras/CameraCard.tsx` — full redesign: Mode toggles (Manual/Auto) per param, SHUTTER manual text input + SET, FOCUS slider + PUSH AF, ATEM CONTROL and REC in 2-col bottom row.
- `frontend/src/panels/cameras/CameraCard.module.css` — matching styles for new card layout.
- `frontend/src/panels/cameras/OfflineOverlay.tsx` — label updated to "Camera not connected"; frosted-glass scrim retained.

---

## v0.15.0 — 2026-04-17 (Frontend UI — F0–F6 complete + cutover)

### Added
- `frontend/` — Vite + React + TypeScript frontend scaffold (F0).
- `frontend/src/types/ws.ts` — TypeScript types for all WS message shapes.
- `frontend/src/stores/ws.ts`, `cameras.ts`, `atem.ts`, `logs.ts` — Zustand stores wired to WS broadcast (F1).
- `frontend/src/components/Header.tsx`, `Dot.tsx` — logo, WS indicator, version badge, ATEM status (F2).
- `frontend/src/panels/logs/LogPanel.tsx` — fixed bottom log drawer (F2).
- `frontend/src/panels/TallyBar.tsx` — fixed bottom tally strip (F2).
- `frontend/src/panels/cameras/CameraGrid.tsx`, `CameraCard.tsx`, `OfflineOverlay.tsx`, `RuntimeBadges.tsx` — live camera panel grid (F3).
- `frontend/src/panels/cameras/DebugModal.tsx` — prop table, runtime model, stats overlay (F4).
- `frontend/src/panels/cameras/AddCameraWizard.tsx` — multi-step add camera wizard (F5).
- `frontend/src/panels/atem/AtemPanel.tsx`, `TallyStrip.tsx` — ATEM connection panel + per-input tally strip (F6).

### Changed
- `public/index.html` — replaced legacy hand-written UI with Vite build output (cutover). Legacy UI no longer served.

### Migration notes
- Backend API and WS shapes unchanged.
- Build: `npm run build:ui` — outputs to `public/`, served by Express on port 7777.
- `public/assets/` is gitignored; build must be run locally before starting the backend.

---

## v0.14.0 — 2026-04-17 (Phase 8 — RuntimeCapabilities gating wired)

### Changed
- `src/sony/actions/index.ts` — migrated `requiredCapability` from `keyof SonyCapabilities` (static model spec) to `keyof RuntimeCapabilities` (protocol-discovered). Updated all keys: `'iso'` → `'hasISO'`, `'shutterSpeed'` → `'hasShutter'`, `'fNumber'` → `'hasFNumber'`, `'colorTemp'` → `'hasColorTemp'`, `'focusMode'` → `'hasFocusMode'`, `'movieRecButton'` → `'hasMovieRecButton'`.
- `src/bridge/executors/sony-command-executor.ts` — added `hasCapability()` gate before each intent case. Each command now checks the corresponding `RuntimeCapabilities` flag before execution. If the runtime model is not yet built (first poll cycle), commands pass through to avoid blocking cold-start. Unknown cameras are fully supported — capability surface is discovered, not assumed.

### Behavior
- For cameras whose runtime model confirms a capability: no change.
- For cameras that do not expose the required prop code: the command is silently skipped and logged.
- Commands issued before the first successful poll cycle are unaffected.

### Migration notes
- No API shape changes. No WS message shape changes.
- `SonyDerivedState` and `SonyAlertState` were already in the WS broadcast via `uiState()` (Phase 5, v0.12.0). Phase 8 confirms this is complete.

---

## v0.13.0 — 2026-04-17 (Phase 7 — Two-tier Sony polling)

### Added
- `src/sony/polling/high-priority.ts` — `HIGH_PRIORITY_INTERVAL_MS` (200ms) and `HIGH_PRIORITY_PROP_CODES` (ISO, shutter, aperture, battery, rec state, remaining time).
- `src/sony/polling/low-priority.ts` — `LOW_PRIORITY_INTERVAL_MS` (1000ms) and `LOW_PRIORITY_PROP_CODES` (WB mode, focus mode, metering mode, exposure mode, drive mode).

### Changed
- `src/sony/ptp-client.ts` — replaced single `pollLoop()` with two separate cycles:
  - `highPriorityPollLoop()`: fetches `0x9209` blob and parses high-priority state at 200ms.
  - `lowPriorityPollLoop()`: reads cached `lastPollBlob` (no extra PTP call) at 1000ms. State field extraction wired in Phase 8.
- `startPolling()` now accepts `(highMs, lowMs)` and starts both loops.
- `stopPolling()` stops both loops.

### Migration notes
- High-priority polling behavior is unchanged (same props, same 200ms interval).
- Low-priority props do not yet update state fields — that is Phase 8.
- `startPolling()` signature changed: `startPolling(intervalMs?)` → `startPolling(highMs?, lowMs?)`. All existing callers pass no arguments and are unaffected.

---

## v0.12.2 — 2026-04-15 (Fix CloseSession on camera remove + race guard in connectWithRetry)

### Fixed
- `src/sony/ptp-client.ts` — `CloseSession` command now sent cleanly when a camera is removed, preventing PTP session leaks on the device side.
- `src/sony/manager.ts` — Added race guard in `connectWithRetry` to prevent duplicate connection attempts when a camera is removed mid-retry loop.

### Migration notes
- No API shape changes. No behavior changes for cameras that remain connected.

---

## v0.12.1 — 2026-04-14 (Fix AC charging detection on ZV-E10M2)

### Fixed
- `src/sony/ptp-client.ts` — Charging (AC power) now detected correctly on ZV-E10M2 and other Sony PTP3 cameras.
  - Primary indicator changed from `0xD150` (USB Power Supply — static on ZV-E10M2, not a dynamic state prop) to `0xD205` bit 3 (`batteryIcon & 0x08`): set when AC is connected (`0x0F`), clear on battery only (`0x07`).
  - Fallback heuristic `battery > 100 || battery === 255` retained for older models.
- `src/sony/ptp-client.ts` — Fixed Sony SDIO ALLEXTDEVICEINFO prop layout in `scanAllProps` sequential scanner.
  - Real format: `[propCode:2][dtype:2][getset:1][reserved:1][defaultVal:size][currentVal:size][formFlag:1]` (6-byte header, not 4-byte as previously assumed).
  - All single-byte props (`0xD205`, `0xD20E`, `0xD218`, etc.) now read correct current values from runtimeModel.
  - `isPlausibleAt` validation updated to match corrected offsets.
  - runtimeModel now discovers more known props (187 vs 178 previously).

### Changed
- `src/sony/ptp-client.ts` — Removed two-stage charging detection (heuristic first + runtimeModel sync block after updateRuntimeModel). Charging state is now resolved in a single pass from hunter-extracted `0xD205`.

---

## v0.12.0 — 2026-04-14 (State layers fully wired — UI uses derived/alerts)

### Added
- `src/sony/state/derived.ts` — `colorTempDisplay: string` field in `SonyDerivedState`; `decodeColorTemp()` helper
- `src/bridge/executors/sony-command-executor.ts` — `clearPrevFocus(cameraId)` exported; clears stale focus delta on camera reconnect

### Changed
- `src/api/viewmodels/camera.ts` — `uiState()` now overrides `fnumber` (→ `derived.fnumberDisplay`, e.g. "2.8") and `colorTemp` (→ `derived.colorTempDisplay`, e.g. "5500K") at top level, matching existing `iso`/`shutter` overrides
- `src/bridge/runtime.ts` — calls `clearPrevFocus(cfg.id)` on every `cameraAdded` event (covers reconnect)
- `public/index.html` — UI now reads `cam.derived.isoDisplay`, `cam.derived.shutterDisplay`, `cam.derived.fnumberDisplay`, `cam.derived.colorTempDisplay` from the derived state layer instead of raw top-level fields
- `public/index.html` — Battery display: removed yellow/mid state; bar is green ≥ 20%, red < 20%; severity driven by `cam.alerts.batterySeverity`; ⚡ icon tied to `'charging'` severity (AC power connected, not charging)
- `public/index.html` — Removed `🔴` emoji from battery percentage text
- `src/sony/state/raw.ts`, `derived.ts`, `alerts.ts` — removed stale "skeleton only" Phase 5 comments

### Fixed
- UI ISO check `cam.iso !== 0` was type-unsafe (string vs number) — removed
- UI shutter check `cam.shutter !== '0'` was dead code — removed
- Battery 'mid' CSS class removed; coloring is now binary (green / red) driven by alerts layer

### Migration notes
- `cam.fnumber` in WS state is now a display string (e.g. "2.8") instead of raw UINT16×100 (e.g. 280). UI prepends "f/" for display. Any custom consumer reading `cam.fnumber` as a number must switch to `cam.raw.fnumber`.
- `cam.colorTemp` in WS state is now a display string (e.g. "5500K") instead of raw Kelvin integer. Raw value remains accessible via `cam.raw.colorTemp`.

---

## v0.11.0 — 2026-04-13 (Runtime camera model — live integration)

### Added
- `src/sony/protocol/prop-knowledge.ts` — Central protocol knowledge table: 150+ PTP3 props with semantic ID, category, enum decoding, safety level, poll priority, UI widget, confidence level, alert relevance
- `src/sony/runtime/types.ts` — `RuntimePropDescriptor`, `UnknownPropDescriptor`, `RuntimeCapabilities` (34 flags), `RuntimeCameraModel` types
- `src/sony/runtime/builder.ts` — `buildRuntimeCameraModel()`, `updateRuntimeModel()`, `serializeRuntimeModel()` — builds and updates live runtime model from PTP poll data
- `src/sony/polling/strategy.ts` — `getPollPriority()`, `getPollSummary()`, `filterSafeToRead()`, `getRecommendedPollIntervals()` — capability-aware poll tier logic
- `GET /api/cameras/:id/runtime-model` — endpoint exposing the full live runtime model with knownProps, unknownProps, capabilities, and pollSummary

### Changed
- `src/sony/ptp-client.ts` — Builds `RuntimeCameraModel` on first poll; updates it on every subsequent cycle; resets on disconnect; filters vendor markers (0x8000, 0x9000) from `scanAllProps()`
- `src/sony/constants.ts` — Added `PROP_CODES_EXT` with 100+ extended PTP3 property codes
- `src/api/ws/broadcaster.ts` — WS state now includes `runtimeInfo` (ptpVersion, sessionMode, knownPropCount, unknownPropCount) and `capabilities` (34 boolean flags) per camera
- `public/index.html` — Camera cards now show PTP version badge and per-capability badges (Silent, ND, IS, AF-S, Stream, Tally, unknown count); badges update live via WS

### Migration notes
- No breaking API shape changes — `runtimeInfo` and `capabilities` are additive optional fields
- Runtime model is null until first poll completes; UI badges appear after first successful camera poll

---

## v0.10.0 — 2026-04-11 (Phase 6 Step 4 — Bridge registry skeletons)

### Added
- `src/bridge/actions/index.ts` — `BridgeActionId`, `BridgeActionDefinition`, `BRIDGE_ACTIONS` (2 actions: dispatchIntent, syncToAtem)
- `src/bridge/variables/index.ts` — `BridgeVariableId`, `BridgeVariableDefinition`, `BRIDGE_VARIABLES` (2 variables: throttleWindowMs, syncCooldownMs)
- `src/bridge/feedbacks/index.ts` — `BridgeFeedbackId`, `BridgeFeedbackDefinition`, `BRIDGE_FEEDBACKS` (4 feedbacks: bridgeReady, cameraControlEnabled, inSyncCooldown, commandThrottled)

### Changed
- Nothing — skeleton only; no runtime wiring

### Migration notes
- No runtime behavior change; registry files are not imported by any running module

---

## v0.9.0 — 2026-04-11 (Phase 6 Step 3 — ATEM model spec skeletons)

### Added
- `src/atem/models/types.ts` — `ATEMCapabilities` (5 flags: cameraControl, reverseCameraControlSync, tallyBySource, modelDiscovery, inputTopology), `ATEMModelSpec` (name, modelNamePatterns, status, capabilities, notes)
- `src/atem/models/index.ts` — `GENERIC_ATEM_SPEC` (conservative fallback with all confirmed flags true), `getATEMModelSpec(modelName)` (substring match → fallback to generic), `getAllATEMModelSpecs()` (named specs only, currently empty)

### Changed
- Nothing — skeleton only; no runtime wiring

### Migration notes
- No runtime behavior change; model spec files are not imported by any running module

---

## v0.8.0 — 2026-04-11 (Phase 6 Step 2 — ATEM state and registry skeletons)

### Added
- `src/atem/state/raw.ts` — `AtemTallyEntry`, `ATEMRawState` (connected, model, knownInputIds, tallyBySource, readyAfterMs)
- `src/atem/state/derived.ts` — `ATEMDerivedState` + `deriveATEMState()` (topology, tally[], activeTallyInputs, programInputs, previewInputs)
- `src/atem/actions/index.ts` — `AtemActionId`, `AtemActionDefinition`, `ATEM_ACTIONS` (2 actions: connect, disconnect)
- `src/atem/variables/index.ts` — `AtemVariableId`, `AtemVariableDefinition`, `ATEM_VARIABLES` (4 variables: connected, model, inputCount, activeTallyCount)
- `src/atem/feedbacks/index.ts` — `AtemFeedbackId`, `AtemFeedbackDefinition`, `ATEM_FEEDBACKS` (3 feedbacks: connected, inputOnProgram, inputOnPreview)

### Changed
- Nothing — skeleton only; no runtime wiring

### Migration notes
- No runtime behavior change; ATEM state and registry files are not imported by any running module

---

## v0.7.0 — 2026-04-11 (Phase 6 Step 1 — Sony registry skeletons)

### Added
- `src/sony/actions/index.ts` — `SonyActionId`, `SonyActionDefinition`, `SONY_ACTIONS` (6 actions: iso, shutter, fnumber, colorTemp, af, record)
- `src/sony/variables/index.ts` — `SonyVariableId`, `SonyVariableDefinition`, `SONY_VARIABLES` (10 variables grounded in SonyRawState + SonyDerivedState)
- `src/sony/feedbacks/index.ts` — `SonyFeedbackId`, `SonyFeedbackDefinition`, `SONY_FEEDBACKS` (7 feedbacks: connected, recording, notRecording, lowBattery, criticalBattery, tallyProgram, tallyPreview)
- `src/sony/presets/index.ts` — `SonyPresetProperty`, `SonyPresetEntry`, `SonyPresetDefinition`, `SONY_PRESETS` (empty; structure only)

### Changed
- Nothing — skeleton only; no runtime wiring

### Migration notes
- No runtime behavior change; registry files are not imported by any running module

---

## v0.6.0 — 2026-04-11 (Phase 5 — Sony state layer skeletons)

### Added
- `src/sony/state/raw.ts` — `SonyRawState` interface; mirrors all fields polled by PTP transport today
- `src/sony/state/derived.ts` — `SonyDerivedState` interface + `deriveSonyState(raw)` helper (ISO/shutter/fnumber display strings, EV float)
- `src/sony/state/alerts.ts` — `SonyAlertState` interface + `deriveSonyAlerts(raw, derived)` helper; `BatterySeverity`, `RecRemainingSeverity` enums

### Changed
- Nothing — skeleton only; no runtime wiring

### Migration notes
- No runtime behavior change; state files are not imported by any running module

---

## v0.5.0 — 2026-04-11 (Phase 4, Step 1 — Sony model spec skeletons)

### Added
- `src/sony/models/types.ts` — `SonyModelSpec`, `SonyCapabilities`, `SonyPtpVersion` interfaces
- `src/sony/models/fx30.ts` — FX30 confirmed spec (PTP3 v1.0+)
- `src/sony/models/zve10m2.ts` — ZV-E10 II confirmed spec (PTP3 v1.2)
- `src/sony/models/fx6.ts` — FX6 stub spec (PTP3 v1.0, unverified)
- `src/sony/models/z200.ts` — PXW-Z200 stub spec (PTP3 v1.3, unverified)
- `src/sony/models/index.ts` — `getSonyModelSpec()` and `getAllSonyModelSpecs()` registry

### Changed
- Nothing — skeleton only; no runtime wiring

### Migration notes
- No runtime behavior change; model specs are not imported by any running module

---

## v0.4.0 — 2026-04-11 (Phase 1 complete)

### Phase 1 — Bridge extraction (no version bump — 2026-04-11)
All bridge domain logic extracted from `src/index.ts` and `src/atem/listener.ts`.
No behavior change. Build and typecheck pass clean.

**New modules:**
- `src/bridge/policies/throttle.ts` — `canSend()`, 200ms per-camera/property throttle
- `src/bridge/policies/anti-loop.ts` — `enterCooldown()` / `isInCooldown()`, 500ms sync echo guard
- `src/bridge/intents/types.ts` — `BridgeProperty`, `ControlIntent` types
- `src/bridge/intents/decoder.ts` — `decodeControlIntent()`, ATEM command → ControlIntent
- `src/bridge/executors/sony-command-executor.ts` — `executeSonyIntent()`, intent → Sony PTP

**Updated:**
- `src/index.ts` — bridge dispatch replaced by `decodeControlIntent` + `executeSonyIntent` calls; now lean bootstrap only
- `src/atem/listener.ts` — `syncCooldowns` replaced by `enterCooldown` / `isInCooldown` imports
- `docs/architecture/current-system.md` — source tree and violation table updated
- `docs/architecture/ARCH_HISTORY.md` — Phase 1 decision recorded

---

## v0.4.0 — 2026-04-11

### Build baseline (no version bump — 2026-04-11)
Establishes reproducible terminal runtime build. No runtime behavior changed.

- `package.json` — added `build`, `typecheck`, `dev` scripts
- `package.json` — declared missing runtime deps: `express ^5.2.1`, `ws ^8.20.0`
- `package.json` — declared missing devDependencies: `esbuild ^0.25.0`, `tsx ^4.21.0`, `typescript ^6.0.2`, `@types/express ^5.0.6`, `@types/node ^25.5.2`, `@types/ws ^8.18.1`
- `package-lock.json` — synced root entry to match new declarations (no new packages installed)
- `npm run build` — exits 0, produces `dist/bridge.cjs` (2.0MB) and `dist/atemSocketChild.js` (11KB)
- `npm run typecheck` — exits 0, no type errors


### Added
- `CLAUDE.md` — complete SAB operating manual (supersedes all previous versions)
- `ARCHITECTURE_RULES.md` — core architecture principles and source-of-truth layers
- `docs/architecture/current-system.md` — documented source tree, violations, and protected files
- `docs/architecture/target-architecture.md` — full target module structure, intent flow, polling tiers
- `docs/architecture/edit-rules.md` — binding edit rules, domain boundary table, commit format
- `docs/architecture/bridge-policies.md` — throttle, anti-loop, intent flow, conversion rules
- `docs/architecture/state-model.md` — SonyRawState, SonyDerivedState, SonyAlertState, AtemRawState, AtemDerivedState, BridgeState
- `docs/architecture/ARCH_HISTORY.md` — architecture decision history baseline
- `.claude/agents/architecture-agent.md`
- `.claude/agents/sony-research-agent.md`
- `.claude/agents/atem-research-agent.md`
- `.claude/agents/bridge-policy-agent.md`
- `.claude/agents/ui-agent.md`
- `.claude/agents/reviewer-agent.md`
- `.claude/agents/refactor-agent.md`
- `knowledge/model-specs/sony/README.md`
- `knowledge/model-specs/atem/README.md`
- `knowledge/capabilities/sony/README.md`
- `knowledge/capabilities/atem/README.md`
- `knowledge/presets/sony/README.md`
- `knowledge/presets/bridge/README.md`
- `knowledge/known-good/README.md`
- `knowledge/known-issues/README.md`
- `VERSION` — single-line version file, starts at 0.4.0
- `CHANGELOG.md` — this file

### Changed
- Nothing in src/ — Phase 0 is documentation and scaffolding only

### Fixed
- Nothing in src/ — Phase 0 is documentation and scaffolding only

### Migration notes
- No source files modified
- No API changes
- No behavior changes
- This baseline marks the start of the modular migration

### Cross-platform strategy (no version bump — 2026-04-11)
Architecture rule addition. No source files modified.

- `CLAUDE.md` §3 — `src/platform/` added to target tree as deferred domain
- `CLAUDE.md` §13 — new Cross-Platform Strategy section: 10 binding rules, deferred scope, frozen files
- `docs/architecture/target-architecture.md` — platform layer added to target tree; cross-platform section added
- `docs/architecture/edit-rules.md` — cross-platform rules section added (portability requirements, frozen artifacts, import direction rule)
- `docs/architecture/ARCH_HISTORY.md` — decision recorded

Key decisions:
- Authoritative execution model during Phases 1–8: `node dist/bridge.cjs` from terminal
- `scripts/launcher.swift`, `scripts/make-icon.swift`, `scripts/pack.sh` frozen and out of scope
- `src/platform/` is a post-Phase-8 deferred domain; platform must never be imported by runtime

### Repository cleanup (no version bump — 2026-04-11)
Pure structural/doc changes. No functionality affected. No version increment.

- `README.md` — replaced `# SAB` placeholder with full project description
- `docs/research/` — created; moved all research reference docs from `docs/` root
  - `docs/ref-atem.md` → `docs/research/ref-atem.md`
  - `docs/ref-cameras.md` → `docs/research/ref-cameras.md`
  - `docs/ref-sony.md` → `docs/research/ref-sony.md`
  - `docs/ref-patterns.md` → `docs/research/ref-patterns.md`
  - `docs/ref-map.md` → `docs/research/ref-map.md`
  - `docs/mapping-table.md` → `docs/research/mapping-table.md`
  - `docs/sony-ptp.md` → `docs/research/sony-ptp.md`
- `docs/research/README.md` — added; explains folder purpose and critical protocol notes
- `CineLink Bridge 2.app/` — 6 tracked-but-deleted files removed from git
- `TASKS_FOR_CLAUDE.md` — removed (Phase 0 task brief, fully executed)
- `src/api/server.ts`, `src/sony/ptp-client.ts` — doc path comments updated to `docs/research/`
- `package.json` description — updated to reflect SAB identity (name unchanged: `cinelink-bridge`)

---

## Pre-0.4.0 — Historical (CineLink Bridge era)

Previous changelog maintained in `.claude/CHANGELOG.md` (Russian-language session log).
That file documents Sony PTP/IP protocol fixes, DataPhase rollback, BUTTON command format,
verbose logging, build system, and the beta.1–beta.6 release history.

Key historical fixes:
- DataPhase: confirmed Sony uses 0/1/2, not 1/2/3 per PTP/IP spec (Session 4 rollback)
- BUTTON command: confirmed working format is `data=UINT32(value), params=[propCode, 1]`
- Logger double-timestamp: fixed by stripping embedded timestamps before logBus emit
