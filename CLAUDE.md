# SAB — Claude Operating Manual

Version: 0.5.0
Last updated: 2026-04-17

This document is the single authoritative operating manual for Claude working on the SAB project.
It supersedes all previous CLAUDE.md versions and informal instruction fragments.
Every rule here is binding. Contradictions with older docs resolve in favour of this file.

---

## 1. Project Mission

SAB (Sony ATEM Bridge) is a modular camera control platform connecting:

- Sony cameras via PTP/IP
- Blackmagic ATEM switchers via `atem-connection`
- An operator web UI console

SAB is **not** a one-off bridge script. It is a production platform with four permanent domains:

| Domain | Responsibility |
|--------|---------------|
| Sony | PTP/IP transport, camera state, actions, presets |
| ATEM | Switcher connectivity, tally, camera-control relay |
| Bridge | Intent normalization, conversion, policy, sync |
| UI | Operator console, view models, notifications |

The working runtime must remain operational at all times.
Architecture must evolve incrementally — never in a single large rewrite.

---

## 2. Current Architecture

As of 2026-04-17 (v0.12.2), the actual source tree is:

```
src/
  index.ts              — bootstrap: config, manager/listener init, wireBridgeRuntime  [clean]
  config.ts             — config file I/O
  logger.ts             — logger + WS event bus
  version.ts            — reads VERSION file at startup
  api/
    server.ts           — HTTP bootstrap + route/WS wiring                             [clean]
    routes/
      cameras.ts        — camera management endpoints
      atem.ts           — ATEM connect/disconnect
      status.ts         — GET /api/status, /api/interfaces
    ws/
      broadcaster.ts    — WS state broadcast (500ms) + log flush (150ms)
    viewmodels/
      camera.ts         — uiState() — assembles raw + derived + alerts for UI
      atem.ts           — uiAtemState() — ATEM raw + derived
    services/
      cameras.ts        — camera service helpers
      network.ts        — listLanInterfaces()
      sony-debug.ts     — debug endpoint payload builder
  atem/
    listener.ts         — ATEM transport + tally + camera-control dispatch              [mixed, minor]
    state/
      raw.ts            — ATEMRawState
      derived.ts        — ATEMDerivedState + deriveATEMState()
    actions/index.ts    — skeleton
    variables/index.ts  — skeleton
    feedbacks/index.ts  — skeleton
    models/             — skeleton
  bridge/
    runtime.ts          — wireBridgeRuntime() — orchestration core
    mapper.ts           — pure ATEM→Sony converters                                    [clean]
    atem-decoder.ts     — ATEM command decoder                                         [clean]
    policies/
      throttle.ts       — canSend() — 200ms per camera/property
      anti-loop.ts      — enterCooldown() / isInCooldown() — 500ms sync guard
    intents/
      types.ts          — BridgeProperty, ControlIntent
      decoder.ts        — decodeControlIntent()
    executors/
      sony-command-executor.ts — executeSonyIntent() + clearPrevFocus()
    sync/
      atem-sync.ts      — syncCameraStateToAtem() — reverse sync push
    actions/index.ts    — skeleton
    variables/index.ts  — skeleton
    feedbacks/index.ts  — skeleton
  sony/
    ptp-client.ts       — PTP/IP transport, handshake, polling, control                [932 lines, core]
    manager.ts          — CameraManager — camera lifecycle
    constants.ts        — prop codes, opcodes, button values, extended codes
    packet-builder.ts   — PTP packet construction
    protocol/
      prop-knowledge.ts — 150+ PTP3 props: semantics, safety, poll priority, UI widget [1625 lines]
    runtime/
      types.ts          — RuntimeCameraModel, RuntimeCapabilities (34 flags)
      builder.ts        — buildRuntimeCameraModel() + updateRuntimeModel()             [wired v0.11.0]
    polling/
      strategy.ts       — getPollPriority(), filterSafeToRead()                        [wired in ptp-client]
    models/
      types.ts          — SonyModelSpec, SonyCapabilities (display metadata types only)
      fx30.ts, zve10m2.ts, fx6.ts, z200.ts — optional display metadata + PTP version hints
      index.ts          — getSonyModelSpec() — used only by debug endpoint
    state/
      raw.ts            — SonyRawState
      derived.ts        — SonyDerivedState + deriveSonyState()
      alerts.ts         — SonyAlertState + deriveSonyAlerts()
      runtime.ts        — getSonyRuntimeState() — assembles all three layers           [wired v0.12.0]
    actions/index.ts    — skeleton
    variables/index.ts  — skeleton
    feedbacks/index.ts  — skeleton
    presets/index.ts    — skeleton (empty preset list)
```

Current violations: none critical. `src/atem/listener.ts` has minor mix (`readyAfterMs` is bridge policy surfaced via getRawState) — low priority.

---

## 3. Target Architecture

```
src/
  core/
    types/
    events/
    alerts/
    logging/
    config/
    state/

  sony/
    transport/
    protocol/
    packet-builder/
    constants/
    models/
    capabilities/
    polling/
      high-priority.ts
      low-priority.ts
    state/
      raw.ts
      derived.ts
      alerts.ts
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
    transport/
    listener/
    models/
    capabilities/
    state/
      raw.ts
      derived.ts
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
    bindings/
    conversion/
    policies/
    sync/
    executors/
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
    ws/
    viewmodels/

  platform/                   — LATER PHASE — OS-specific wrappers only
    macos/                    — macOS launcher, tray, .app integration
    windows/                  — Windows launcher, system tray
    linux/                    — Linux launcher, systemd, desktop
    index.ts                  — platform detection and loader

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

`src/platform/` is a deferred domain. It does not exist during Phases 1–8.
The runtime must be fully functional from terminal before platform wrappers are added.

---

## 4. Domain Boundaries

### Sony domain

Owns:
- PTP/IP transport
- Camera handshake
- Polling (high and low priority)
- Property parsing
- Camera model specs
- Capability derivation
- Camera state (raw, derived, alert layers)
- Sony actions, variables, feedbacks, presets, executors

Must not own:
- ATEM routing logic
- UI formatting logic
- Bridge policy decisions

### ATEM domain

Owns:
- Switcher connectivity
- Tally capture
- ATEM camera-control state
- ATEM model specs and capabilities
- ATEM actions, feedbacks, variables
- Reverse sync helpers

Must not own:
- Sony transport logic
- Sony-specific conversion rules
- Operator UI formatting

### Bridge domain

Owns:
- Normalized control intents
- Camera-to-input bindings
- Conversion rules (ATEM → Sony)
- Policy checks (capability, anti-loop, throttle)
- Sync cooldowns and anti-loop centralization
- Bridge state and feedbacks

Must not own:
- Raw Sony transport
- Raw ATEM transport
- Final UI rendering

### UI domain

Owns:
- Operator console panels
- View models and formatting
- Notifications and alerts display
- User workflows

Must not own:
- Transport protocol logic
- Raw conversion logic
- Device state directly (must consume view models)

---

## 5. Architecture Design Rules

### Runtime capability model

SAB is protocol-first. Capabilities derive from observed protocol behavior, not from a static camera database.

The authoritative source of truth is `RuntimeCameraModel` (`src/sony/runtime/`):
- Built from live `SDIO_GetAllExtDevicePropInfo` polling data
- `RuntimeCapabilities` (34 flags) are set when a prop code is observed in the device response
- Unknown cameras are fully supported — capability surface is discovered, not assumed

`src/sony/models/` (static entries) are optional metadata only:
- May provide display labels or PTP version hints for session initialization
- Must not be used as the gate for runtime actions, feedbacks, or presets
- A missing static entry must never block a camera from operating

Do not assume capabilities. Observe them.

### State layers

Device state must use three layers — never a single flat object:

| Layer | Contains |
|-------|---------|
| Raw | Values as parsed from device |
| Derived | Computed values (e.g. EV, exposure index) |
| Alert | Warning conditions (low battery, card full, etc.) |

### Polling tiers

Sony polling must be split into two tiers:

**High priority (200ms):**
- ISO, shutter, aperture
- Recording state
- Battery level
- Remaining record time
- Connection freshness

**Low priority (1000ms+):**
- Focus mode
- WB mode
- ND mode
- Overlays and assist tools
- Optional media metadata

### Bridge intent flow

All ATEM→Sony commands must flow through this chain — no shortcuts:

```
ATEM event
  → ControlIntent (normalized)
  → Capability check
  → Policy check (throttle, anti-loop)
  → Conversion (ATEM values → Sony values)
  → Executor (Sony PTP command)
  → State / feedback update
```

Never map ATEM directly to Sony commands inside entrypoint files.

### Action rules

All actions must be grouped by domain and concern.
Examples: `sony/actions/exposure.ts`, `atem/actions/camera-control.ts`, `bridge/actions/binding.ts`
Do not create large mixed action files.

### Anti-loop rules

Throttle (`canSend`) and anti-loop cooldown (`syncCooldowns`) must both live in `src/bridge/policies/`.
Do not scatter loop guards across unrelated files.

### Preset rules

A preset must:
- Validate runtime capabilities (from `RuntimeCameraModel`) before applying — not static model name
- Apply steps in a safe order
- Support graceful partial failure or explicit refusal
- Update state, variables, and feedbacks after apply

Presets are not dumb macro lists.

---

## 6. Hard Bans

These are absolute. No exceptions without an explicit architecture decision recorded in `docs/architecture/ARCH_HISTORY.md`.

- Do not edit `dist/` as a source of truth
- Do not add new domain logic to `src/index.ts`
- Do not add new domain logic to `src/api/server.ts`
- Do not duplicate Sony constants outside `src/sony/constants.ts`
- Do not make hidden architectural changes without updating docs
- Do not map ATEM → Sony directly inside entrypoint files
- Do not assume camera capabilities not confirmed by reference docs or hardware logs
- Do not break API response shape without a migration plan
- Do not break Sony PTP transport under any circumstances
- Never perform large multi-file refactors in one commit — maximum 15 files per commit

---

## 7. Git Workflow

### Branch structure

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `stable` | Tested release candidates |
| `dev` | Active development |

New features must never be committed directly to `main`.

### Branch naming

```
feature/<feature-name>    feature/sony-modelspec
fix/<bug-name>            fix/shutter-conversion
refactor/<area>           refactor/api-layer
research/<topic>          research/sony-capabilities
```

### Commit format

```
type(scope): short description
```

Allowed types: `feat` `fix` `refactor` `docs` `test` `perf` `chore`

Examples:
```
feat(sony): add ModelSpec system
fix(bridge): correct shutter conversion
refactor(api): extract camera routes
docs(architecture): add target architecture
chore(snapshot): save working SAB before bridge extraction
```

### Commit rules

Each commit must:
- Change one concept only
- Be independently reversible
- Have a descriptive message

Forbidden messages: `"update"`, `"fix stuff"`, `"misc"`, `"changes"`

### Simulated PR descriptions

Each large change must include a description block in the commit body:

```
### Summary
<what changed and why>

### Files changed
<list of affected files or directories>

### Reason
<motivation — architectural goal, bug fix, etc.>

### Risks
<what could break and why it won't>
```

### Before a large refactor

Always commit the current working state first:

```
chore(snapshot): save working SAB before <area> refactor
git tag backup-pre-<area>-refactor
```

### Release tags

Stable releases must be tagged: `v0.4.0`, `v0.5.0`, etc.

### Git safety rules

- Never rewrite history on `main`
- Never force push to `stable`
- Never delete tags
- Before starting work: read `git log`, check tags, check open issues

---

## 8. Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`

| Increment | When |
|-----------|------|
| `PATCH` | Bug fix, no new functionality |
| `MINOR` | New functionality, backwards compatible |
| `MAJOR` | Breaking architecture change |

Claude must maintain two files:

**`VERSION`** — single line, current version string:
```
0.4.0
```

**`CHANGELOG.md`** — per-version entries:
```markdown
## v0.4.0 — 2026-04-11

### Added
- Sony ModelSpec system
- Capability registry skeleton

### Changed
- Bridge conversion pipeline extracted from index.ts

### Fixed
- (none)

### Migration notes
- No breaking API changes
```

Every commit that affects functionality must update `VERSION` and `CHANGELOG.md`.

---

## 9. Subagent System

Subagents live in `.claude/agents/`. Claude must use them for parallel research, refactor planning, and domain-specific implementation.

| Agent | Role |
|-------|------|
| `architecture-agent` | Plans module structure, reviews domain boundaries |
| `sony-research-agent` | Researches Sony PTP protocol, model capabilities |
| `atem-research-agent` | Researches ATEM protocol, model specs |
| `bridge-policy-agent` | Designs intent flow, conversion rules, anti-loop policies |
| `ui-agent` | Designs view models, panels, notifications |
| `reviewer-agent` | Reviews changes for correctness, safety, and scope |
| `refactor-agent` | Executes safe extractions with no behavior change |

Subagents must be used when:
- A task requires research across multiple files or domains
- A refactor affects more than 3 files
- A new feature requires design input from multiple domains
- A change needs independent safety review before commit

---

## 10. Frontend Phases

Backend architecture (Phases 0–8) is complete as of v0.14.0.
Current work focuses on the operator UI frontend.

### Stack
| Component | Choice |
|-----------|--------|
| Build tool | Vite |
| Framework | React + TypeScript |
| State | Zustand |
| CSS | CSS custom properties (design tokens) |

### F0 — Scaffold ✅ complete (v0.15.0)
- `frontend/` directory with Vite + React + TypeScript
- `frontend/src/styles/tokens.css` — design tokens extracted from legacy UI
- `frontend/src/styles/globals.css` — reset + base typography
- `frontend/src/main.tsx`, `frontend/src/App.tsx` — entry point shell
- Root `package.json` — `build:ui`, `install:ui` scripts
- Build output: `frontend/` → `../public/` (backend serves as static on port 7777)
- **Legacy `public/index.html` still served until cutover**

### F1 — WS store + types
- `frontend/src/types/ws.ts` — TypeScript types for all WS message shapes
- `frontend/src/stores/ws.ts` — WS connection, reconnect, message dispatch
- `frontend/src/stores/cameras.ts` — camera state map from WS
- `frontend/src/stores/atem.ts` — ATEM state from WS
- `frontend/src/stores/logs.ts` — log entry buffer (capped)

### F2 — Shell + layout
- `frontend/src/App.tsx` — root layout (header + main + panels)
- `frontend/src/components/Header.tsx` — logo, WS dot, version badge, ATEM panel
- `frontend/src/components/Dot.tsx` — connection indicator dot
- `frontend/src/panels/logs/LogPanel.tsx` — fixed bottom log drawer
- `frontend/src/panels/TallyBar.tsx` — fixed bottom tally strip

### F3 — Camera panels
- `frontend/src/panels/cameras/CameraGrid.tsx` — responsive grid container
- `frontend/src/panels/cameras/CameraCard.tsx` — live camera card
- `frontend/src/panels/cameras/OfflineOverlay.tsx` — disconnected state overlay
- `frontend/src/panels/cameras/RuntimeBadges.tsx` — capability/PTP version badges

### F4 — Debug modal
- `frontend/src/panels/cameras/DebugModal.tsx` — prop table, runtime model, stats

### F5 — Add Camera wizard
- `frontend/src/panels/cameras/AddCameraWizard.tsx` — multi-step: IP → connect → name → confirm

### F6 — ATEM panel
- `frontend/src/panels/atem/AtemPanel.tsx` — connection, model, topology
- `frontend/src/panels/atem/TallyStrip.tsx` — per-input tally indicators

### Cutover
- `npm run build:ui` replaces `public/index.html` with Vite output
- Legacy UI no longer served
- Run after F1–F6 are complete and verified

---

### Frontend rules

- All WS state must flow through Zustand stores — never read directly from WS in components
- Components must not import from `src/` (backend) — use `frontend/src/types/` for shared shapes
- CSS: use design tokens from `tokens.css` — no hardcoded colors in component files
- Each panel lives in its own file — no panel logic in `App.tsx`
- `App.tsx` is layout only — no data fetching, no business logic

---

## 11. Safety Rules

### What must never break

- Sony PTP transport handshake and polling
- ATEM connection and command reception
- All `/api/*` endpoint response shapes
- Config file format (`config.json`)
- WS `state` message shape (UI depends on it)

### Phase completion gate

A phase is complete only when all of the following are true:
1. `src/index.ts` and `src/api/server.ts` still boot without errors
2. All API endpoints respond correctly
3. Sony cameras connect and poll
4. ATEM commands dispatch to Sony correctly
5. WS state broadcast reaches the UI correctly

### Scope discipline

- Do not refactor unrelated domains while working on a task
- Do not add features during extraction phases
- Do not change behavior during structural phases
- First explain affected files and reason before writing any code

### Backend files that must not be modified during frontend phases

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

---

## 13. Cross-Platform Strategy

### Principle: Runtime first, packaging later

SAB is a cross-platform target. During the current architecture migration (Phases 1–8),
all OS-specific launcher, app bundle, and installer work is explicitly out of scope.

The authoritative execution model during migration is:

```
node dist/bridge.cjs
```

Terminal launch. No launcher dependency. No bundle assumption. No OS-specific path.

---

### Cross-platform rules (binding)

1. **Cross-platform is a target architecture requirement.** The runtime must eventually run on macOS, Windows, and Linux without modification.
2. **Current migration must avoid platform-specific launcher work.** Phases 1–8 are runtime-only phases.
3. **macOS-only launcher logic must not influence runtime architecture.** The runtime must not assume it is running inside a `.app` bundle.
4. **`.app`, Swift launcher, packaging scripts, installers, and release wrappers are deferred.** They are not touched during Phases 1–8.
5. **Runtime must be executable from terminal first.** `node dist/bridge.cjs` must be the primary execution model.
6. **All new architecture decisions must prefer platform-neutral paths and abstractions.** Use `process.cwd()`, relative paths, and Node.js built-ins — not macOS-specific APIs.
7. **Any OS-specific behavior must be isolated behind a future `src/platform/` layer.** Never spread OS detection into domain modules.
8. **Do not optimize anything for macOS packaging during Phases 1–3.** Config loading, path resolution, and file I/O must be portable.
9. **Do not rewrite launcher or installer scripts during architecture extraction.** `scripts/launcher.swift`, `scripts/make-icon.swift`, and `scripts/pack.sh` are frozen as deferred artifacts.
10. **Packaging becomes a dedicated phase after the modular runtime is stable.** Not before.

---

### Out of scope during Phases 1–8

- macOS `.app` bundle creation or modification
- `scripts/launcher.swift` redesign or refactor
- `scripts/make-icon.swift` updates
- `scripts/pack.sh` repair or replacement
- Installer generation (dmg, pkg, exe, deb, rpm)
- Package signing and notarization
- Windows installer work
- Linux packaging work
- System tray and native shell integration
- Any `CineLink Bridge.app` or successor app bundle work

---

### In scope now (Phases 1–8)

- Terminal-based startup and runtime
- Modular runtime architecture (all eight phases)
- Clean config loading (platform-neutral `config.json` path resolution)
- Portable path handling (no hardcoded macOS paths)
- Platform-neutral module boundaries
- Runtime that can later be wrapped by platform launchers without modification

---

### Future platform layer

When the modular runtime is stable, a dedicated packaging phase will create `src/platform/`:

```
src/
  platform/
    macos/     — .app integration, tray, bundle path resolution
    windows/   — Windows launcher, system tray
    linux/     — systemd, desktop integration
    index.ts   — platform detection and loader
```

Platform modules wrap the runtime. They do not modify it.
Runtime modules must never import from `src/platform/`.

---

### Deferred files (do not modify during Phases 1–8)

| File | Status | Reason |
|------|--------|--------|
| `scripts/launcher.swift` | Frozen | macOS-specific; deferred to platform phase |
| `scripts/make-icon.swift` | Frozen | macOS-specific; deferred to platform phase |
| `scripts/pack.sh` | Frozen | Broken + out of scope; deferred to platform phase |
| `package.json` `bundle:app` | Frozen | References non-existent CineLink Bridge.app |
| `package.json` `release:zip` | Frozen | References outdated app path |

---

## 12. Task Execution Protocol

When Claude receives a task, it must follow this sequence:

### Step 1 — Read before writing
Read all files relevant to the task before writing any code.
Do not propose changes to files that have not been read in this session.

### Step 2 — State the plan
Before writing code, state:
- Which files will be affected
- What will change in each file
- What will not change
- What the risk is

### Step 3 — Get confirmation for large changes
For any change touching more than 3 files, state the plan and wait for confirmation before proceeding.

### Step 4 — Execute in small commits
Maximum 15 files per commit.
One concept per commit.
Commit after each logical unit of work — do not batch unrelated changes.

### Step 5 — Update version and changelog
After any commit affecting functionality:
- Update `VERSION`
- Add entry to `CHANGELOG.md`

### Step 6 — Update architecture docs if structure changed
If a new file was created, a module was extracted, or a domain boundary changed:
- Update `docs/architecture/current-system.md`
- Add entry to `docs/architecture/ARCH_HISTORY.md`

### Step 7 — Commit and push
Follow the commit format from Section 7.
Push to the correct branch (never directly to `main`).
