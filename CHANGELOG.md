# SAB — Changelog

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
