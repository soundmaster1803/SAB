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

---

## 2026-04-11 — Phase 1 complete: bridge logic extracted from runtime entrypoint

**Decision:** All bridge domain logic extracted from `src/index.ts` and
`src/atem/listener.ts` into dedicated bridge modules. `src/index.ts` is now lean.

**Modules created:**

| Module | Extracted from | What it does |
|--------|---------------|--------------|
| `src/bridge/policies/throttle.ts` | `src/index.ts` | `canSend()` — 200ms per-camera/property throttle |
| `src/bridge/policies/anti-loop.ts` | `src/atem/listener.ts` | `enterCooldown()` / `isInCooldown()` — 500ms sync echo suppression |
| `src/bridge/intents/types.ts` | (new) | `BridgeProperty`, `ControlIntent` — normalized intent contract |
| `src/bridge/intents/decoder.ts` | `src/index.ts` | `decodeControlIntent()` — ATEM command → ControlIntent |
| `src/bridge/executors/sony-command-executor.ts` | `src/index.ts` | `executeSonyIntent()` — intent → Sony PTP command |

**`src/index.ts` handleCameraControl pipeline after Phase 1:**
```
ATEM event → findByAtemInput → guard checks
  → decodeControlIntent()
  → executeSonyIntent()
```

**No behavior change.** All Sony PTP commands, throttle decisions, and anti-loop
suppression are identical. Only code location changed.

**Phase 2 next:** Extract `syncCameraStateToAtem()` from `src/atem/listener.ts`
into `src/bridge/sync/atem-sync.ts`.

---

## 2026-04-11 — Phase 4 Step 1: Sony model spec skeleton introduced

**Decision:** Introduce a static model specification layer for Sony cameras.
This is a skeleton phase — no runtime wiring. Model specs are referenced by nothing at runtime.

**Modules created:**

| Module | Status | What it does |
|--------|--------|--------------|
| `src/sony/models/types.ts` | Confirmed | `SonyModelSpec`, `SonyCapabilities`, `SonyPtpVersion` types |
| `src/sony/models/fx30.ts` | Confirmed | FX30 / ILME-FX30B spec — PTP3 v1.0+, confirmed capabilities |
| `src/sony/models/zve10m2.ts` | Confirmed | ZV-E10 II / ILCE-ZV-E10M2 spec — PTP3 v1.2, confirmed capabilities |
| `src/sony/models/fx6.ts` | Stub | FX6 / ILME-FX6 spec — PTP3 v1.0, all capabilities unverified |
| `src/sony/models/z200.ts` | Stub | PXW-Z200 spec — PTP3 v1.3, all capabilities unverified |
| `src/sony/models/index.ts` | Skeleton | `getSonyModelSpec()` / `getAllSonyModelSpecs()` registry |

**Design decisions:**

- `SonyCapabilities` uses flat boolean flags per capability, not a version check. This
  allows individual capabilities on the same camera to be confirmed/unconfirmed independently.
- `status: 'confirmed' | 'stub'` field guards against stub specs being used for gating.
  Runtime capability-gate code (Phase 8) must refuse to act on stub specs.
- FX30 `tallyLamps: true` is marked with a note: tally requires firmware ≥ 3.0. The flag
  may be overridden at runtime by prop-presence check after SDIOGetExtDeviceInfo.
- ZV-E10 II `hdmiTimecodeRecControl: false` — conservative default; not confirmed by live test.
- FX6 and Z200 are all-false stubs; they exist to register the model ID so the lookup
  does not return null for these cameras.

**Evidence standard applied:** Capabilities set to true only if confirmed by Sony SDK source
(PTPDef.h, DevicePropItemList.h) or explicitly noted in ref-cameras.md research docs.

**No behavior change.** No existing source file imports from `src/sony/models/`.

**Phase 4 continuation:** Populate `knowledge/model-specs/sony/` knowledge files as the
authoritative source of truth for these specs.
