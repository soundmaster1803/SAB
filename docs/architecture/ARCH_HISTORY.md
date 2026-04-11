# SAB Architecture History

A chronological record of significant architectural decisions and transitions.

---

## 2026-04-11 — Modular architecture introduced

**Decision:** SAB transitions from a monolithic bridge utility to a modular camera control platform.

**Domains introduced:**
- Sony domain — PTP/IP transport, models, capabilities, state, executors, actions
- ATEM domain — switcher connectivity, tally, camera-control state, actions
- Bridge domain — intents, conversion, policies, sync, executors
- UI domain — operator console panels, view models, notifications

**Inspired by:** Bitfocus Companion module architecture
- Model specification system (per-device static spec)
- Capability filtering (actions/feedbacks gated by model support)
- Action / feedback / variable / preset registries
- Layered state model (raw → derived → alerts)

**Trigger:** `src/index.ts` and `src/api/server.ts` had grown too large and mixed concerns from multiple domains. Bridge logic, throttle, tally sync, UI formatting, and HTTP routing were all co-located with bootstrap code.

**Migration strategy:** Incremental extraction — logic moves into domain modules without behavior change. Working runtime preserved at every step.

**Starting codebase snapshot:**
- 12 source files, ~1,800 lines
- All bridge logic in `src/index.ts` (`handleCameraControl`, throttle, tally sync)
- All API routing and UI formatting in `src/api/server.ts`
- `syncCameraStateToAtem()` in ATEM transport layer (wrong domain)
- Single polling tier at 200ms for all properties
- No model spec, capability, action, variable, feedback, or preset system

**Target codebase:**
See `docs/architecture/target-architecture.md`

---

## 2026-04-11 — Repository cleanup and normalization

**Decision:** Pre-development cleanup pass to normalize the repository structure before Phase 1 begins.

**Changes:**
- Research reference documents moved from `docs/` root to `docs/research/` subfolder
  - Files: `ref-atem.md`, `ref-cameras.md`, `ref-sony.md`, `ref-patterns.md`, `ref-map.md`, `mapping-table.md`, `sony-ptp.md`
- `docs/research/README.md` created — explains folder purpose and critical protocol notes
- `CineLink Bridge 2.app/` tracked files removed from git (already deleted from disk)
- `TASKS_FOR_CLAUDE.md` removed (Phase 0 task brief, fully executed)
- `README.md` updated with full project description
- `package.json` description updated (name kept as `cinelink-bridge` — rename out of scope)
- Backup tag `backup-pre-cleanup` created before cleanup

**No source files modified.**
**No behavior changes.**

**Correction (same day):** `package.json` name change `cinelink-bridge` → `sab` was reverted.
Rename was out of scope for a cleanup pass and cannot be proven zero-risk for all tooling
(pkg scripts, bundle scripts, any tooling that reads the name field) without investigation.
`VERSION` bumped to 0.4.1 during cleanup was also reverted — pure doc/structural cleanup
does not qualify as a functionality change under the versioning rules (CLAUDE.md §8).

**Flagged for future resolution:**
- `package.json` has no `build` script — TypeScript compilation method unknown; must add before Phase 1
- `scripts/pack.sh` references non-existent `release/CineLink Bridge.command` — script is broken; deferred to platform phase
- `scripts/launcher.swift` and `scripts/make-icon.swift` — macOS launcher source; deferred to platform phase

---

## 2026-04-11 — Cross-platform strategy established

**Decision:** SAB adopts an explicit "runtime first, packaging later" strategy.
Cross-platform support is a target architecture requirement, but all OS-specific
launcher, bundle, and installer work is deferred until after the modular runtime
is stable (after Phase 8).

**Rules added:**
1. Authoritative execution model during Phases 1–8 is `node dist/bridge.cjs` from terminal.
2. Runtime must not assume it runs inside a `.app` bundle or `pkg` binary.
3. All new architecture decisions must prefer platform-neutral abstractions.
4. Any OS-specific behavior must be isolated behind `src/platform/` — a deferred domain.
5. `scripts/launcher.swift`, `scripts/make-icon.swift`, and `scripts/pack.sh` are frozen.
6. `src/platform/` is added to the target architecture tree as a deferred, post-Phase-8 domain.

**Future `src/platform/` structure:**
```
src/platform/
  macos/     — .app integration, tray, bundle paths
  windows/   — Windows tray, launcher
  linux/     — systemd, desktop integration
  index.ts   — platform detection and loader
```

Platform modules wrap the runtime. Runtime modules must never import from `src/platform/`.

**Docs updated:**
- `CLAUDE.md` §3 — `src/platform/` added to target tree
- `CLAUDE.md` §13 — Cross-Platform Strategy section added
- `docs/architecture/target-architecture.md` — platform layer + cross-platform section added
- `docs/architecture/edit-rules.md` — cross-platform rules section added

**No source files modified.**
