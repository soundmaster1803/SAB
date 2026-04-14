# SAB — Changelog

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
