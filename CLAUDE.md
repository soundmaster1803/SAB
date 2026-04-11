# SAB — Claude Operating Manual

Version: 0.4.0
Last updated: 2026-04-11

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

As of 2026-04-11, the actual source tree is:

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

Known violations in the current state:
- `src/index.ts` contains `handleCameraControl()`, throttle (`canSend`), `prevFocus` state — all bridge domain logic
- `src/api/server.ts` contains `PROP_MAP`, `decodeShutter()`, `decodeISO()`, `uiState()` — all viewmodel/Sony domain logic
- `src/atem/listener.ts` contains `syncCameraStateToAtem()` — bridge sync logic in transport layer
- No model spec, capability, action, variable, feedback, or preset system exists
- Single polling tier at 200ms for all camera properties
- No intent layer — ATEM events map directly to Sony commands inside `index.ts`
- Throttle and anti-loop logic are scattered (`lastCmdTime` in `index.ts`, `syncCooldowns` in `listener.ts`)

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

### Model spec system

Every supported camera family must have:
- A static model spec file (`src/sony/models/<model>.ts`)
- A capability derivation function
- Filtered actions (only actions the model supports)
- Filtered presets
- Filtered feedbacks and variables

Do not assume capabilities. Only write what is confirmed by reference docs or hardware logs.

### Capability filtering

Actions must only exist if the camera model supports them.
Example: ND filter actions exist only on cameras with ND hardware.

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
- Validate camera model and capabilities before applying
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

## 10. Migration Phases

Migration proceeds in eight ordered phases. Each phase must leave the runtime fully operational before the next begins.

### Phase 0 — Documentation and scaffolding
- Update CLAUDE.md (this file)
- Create `docs/architecture/` (5 files)
- Create `.claude/agents/` (7 files)
- Create `knowledge/` scaffolding
- **No source files modified**

### Phase 1 — Extract bridge logic from `src/index.ts`
- `src/bridge/policies/throttle.ts` — extract `canSend()`
- `src/bridge/policies/anti-loop.ts` — extract `syncCooldowns`
- `src/bridge/intents/types.ts` — `ControlIntent` interface
- `src/bridge/intents/decoder.ts` — ATEM command → intent
- `src/bridge/executors/sony-command-executor.ts` — extract `handleCameraControl()`
- Update `src/index.ts` to import from bridge modules
- **No behavior change**

### Phase 2 — Extract sync logic from `src/atem/listener.ts`
- `src/bridge/sync/atem-sync.ts` — extract `syncCameraStateToAtem()`
- Update `src/atem/listener.ts` to import from bridge/sync
- **No behavior change**

### Phase 3 — Split `src/api/server.ts`
- `src/api/viewmodels/camera.ts` — extract `uiState()`, `decodeShutter()`, `decodeISO()`, `PROP_MAP`
- `src/api/ws/broadcaster.ts` — extract WS setup and broadcast logic
- `src/api/routes/cameras.ts` — extract camera routes
- `src/api/routes/atem.ts` — extract ATEM routes
- `src/api/routes/status.ts` — extract status/interfaces routes
- Update `src/api/server.ts` to import from modules
- **No API response shape change**

### Phase 4 — Sony model specs
- `src/sony/models/types.ts` — `SonyModelSpec`, `SonyCapabilities` interfaces
- `src/sony/models/fx30.ts` — FX30 spec (confirmed capabilities only)
- `src/sony/models/index.ts` — `getModelSpec(modelName)`
- **Skeleton only — not wired to runtime yet**

### Phase 5 — Sony state layers
- `src/sony/state/raw.ts` — `SonyRawState`
- `src/sony/state/derived.ts` — `SonyDerivedState`, `deriveSonyState()`
- `src/sony/state/alerts.ts` — `SonyAlertState`, `deriveSonyAlerts()`
- **Types only — not wired to runtime yet**

### Phase 6 — Registry skeletons
- `src/sony/actions/index.ts`
- `src/sony/variables/index.ts`
- `src/sony/feedbacks/index.ts`
- `src/sony/presets/index.ts`
- `src/atem/actions/index.ts`
- `src/atem/variables/index.ts`
- `src/atem/feedbacks/index.ts`
- `src/bridge/actions/index.ts`
- `src/bridge/variables/index.ts`
- `src/bridge/feedbacks/index.ts`
- **Skeleton exports only**

### Phase 7 — Split Sony polling
- `src/sony/polling/high-priority.ts`
- `src/sony/polling/low-priority.ts`
- Update `src/sony/ptp-client.ts` to use two-tier polling
- **Behavior change: low-priority props poll at 1000ms instead of 200ms**

### Phase 8 — Wire model specs and capabilities to runtime
- Gate actions, feedbacks, and presets by `SonyCapabilities`
- Connect `SonyDerivedState` and `SonyAlertState` to WS broadcast
- **First phase that adds new runtime behavior**

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

### Files that must not be modified in Phases 1–3

| File | Reason |
|------|--------|
| `src/sony/ptp-client.ts` | Working PTP transport — extraction only |
| `src/sony/manager.ts` | Working camera lifecycle |
| `src/sony/packet-builder.ts` | Working packet construction |
| `src/sony/constants.ts` | Single source of Sony constants |
| `src/bridge/mapper.ts` | Clean — do not disturb |
| `src/bridge/atem-decoder.ts` | Clean — do not disturb |
| `src/config.ts` | Config I/O — do not disturb |
| `src/logger.ts` | Logger — do not disturb |

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
