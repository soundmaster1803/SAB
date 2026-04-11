# SAB — Changelog

---

## v0.4.1 — 2026-04-11

### Changed
- `README.md` — replaced placeholder with full project description
- `package.json` — renamed package from `cinelink-bridge` to `sab`
- `docs/research/` — created; moved all research reference docs from `docs/` root into `docs/research/`
  - `docs/ref-atem.md` → `docs/research/ref-atem.md`
  - `docs/ref-cameras.md` → `docs/research/ref-cameras.md`
  - `docs/ref-sony.md` → `docs/research/ref-sony.md`
  - `docs/ref-patterns.md` → `docs/research/ref-patterns.md`
  - `docs/ref-map.md` → `docs/research/ref-map.md`
  - `docs/mapping-table.md` → `docs/research/mapping-table.md`
  - `docs/sony-ptp.md` → `docs/research/sony-ptp.md`
- Added `docs/research/README.md` explaining research folder structure and critical protocol notes
- Removed `CineLink Bridge 2.app/` tracked files from git (already deleted from disk)
- Removed `TASKS_FOR_CLAUDE.md` (Phase 0 task brief, fully executed)
- Updated `src/` code comments to reference new `docs/research/` paths

### Fixed
- Nothing

### Migration notes
- No API changes
- No behavior changes
- Research docs are at new paths — update any local bookmarks

---

## v0.4.0 — 2026-04-11

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

---

## Pre-0.4.0 — Historical (CineLink Bridge era)

Previous changelog maintained in `.claude/CHANGELOG.md` (Russian-language session log).
That file documents Sony PTP/IP protocol fixes, DataPhase rollback, BUTTON command format,
verbose logging, build system, and the beta.1–beta.6 release history.

Key historical fixes:
- DataPhase: confirmed Sony uses 0/1/2, not 1/2/3 per PTP/IP spec (Session 4 rollback)
- BUTTON command: confirmed working format is `data=UINT32(value), params=[propCode, 1]`
- Logger double-timestamp: fixed by stripping embedded timestamps before logBus emit
