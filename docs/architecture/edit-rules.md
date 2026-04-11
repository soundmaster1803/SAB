# SAB — Edit Rules

Version: 0.4.0
Last updated: 2026-04-11

These rules govern every code change made to SAB. They are binding.
Violations require an explicit architecture decision in ARCH_HISTORY.md.

---

## General rules

### Read before writing
Never propose or write code for a file that has not been read in the current session.
Read all files relevant to a task before writing any code.

### One concept per commit
Each commit changes one logical concept only.
Do not batch unrelated changes into a single commit.
Maximum 15 files per commit.

### No silent behavior change during extraction
Extraction phases move code — they do not change behavior.
If behavior must change, it must be a separate commit with a clear reason.

### Scope discipline
Do not refactor unrelated domains while working on a task.
Do not add features during extraction phases.
Do not change behavior during structural phases.

---

## Domain boundary rules

| Domain | May import | Must not import |
|--------|-----------|----------------|
| Sony | core | atem, bridge, api |
| ATEM | core | sony, bridge, api |
| Bridge | core, sony, atem | api |
| API | core, bridge, sony, atem | (none forbidden) |

Crossing a domain boundary is a hard violation.
Example: `src/sony/ptp-client.ts` must never import from `src/bridge/`.

---

## Entrypoint rules

### src/index.ts must ONLY:
- initialize logging
- load config
- instantiate core modules
- wire modules together
- start services

Never add domain logic to index.ts.

### src/api/server.ts must ONLY:
- register routes from route modules
- register WS handler from ws/broadcaster
- start HTTP server

Never add route logic, UI formatting, or domain logic to server.ts.

---

## Hard-banned files (never edit as a source of truth)

| File / Dir | Rule |
|------------|------|
| `dist/` | Never edit generated output — rebuild instead |
| `src/index.ts` | Never add new domain logic |
| `src/api/server.ts` | Never add new domain logic |

---

## Files protected during Phases 1–3

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

## API contract rules

- Never break `/api/*` endpoint response shape without a migration plan
- Never break WS `state` message shape without a migration plan
- Never break `config.json` format without a migration plan

---

## Constants rules

- Do not duplicate Sony constants outside `src/sony/constants.ts`
- Do not duplicate ATEM constants — create `src/atem/constants.ts` if needed
- All constants that are used across domains must live in `src/core/`

---

## Architecture documentation rules

If any of the following occur, update the relevant architecture docs:
- A new file is created in a domain directory
- A module is extracted from an existing file
- A domain boundary changes
- A migration phase completes

Files to update:
- `docs/architecture/current-system.md` — source tree and violations
- `docs/architecture/ARCH_HISTORY.md` — append new entry

---

## Capability rules

- Do not assume camera capabilities
- Only declare capabilities confirmed by reference documents or hardware logs
- Actions, feedbacks, variables, and presets must be gated by capability
- ND filter actions: only on cameras with confirmed ND hardware
- ProRes/4K recording: only on cameras with confirmed codec support

---

## Preset rules

A preset must:
1. Validate camera model against preset requirements
2. Validate capabilities before applying any step
3. Apply steps in safe order (safest first)
4. Support graceful partial failure or explicit refusal
5. Update state, variables, and feedbacks after apply

Presets are not dumb macro lists. They are validated workflows.

---

## Commit message format

```
type(scope): short description

### Summary
<what changed and why>

### Files changed
<list of affected files>

### Reason
<architectural goal, bug fix, or requirement>

### Risks
<what could break and why it won't>
```

Allowed types: `feat` `fix` `refactor` `docs` `test` `perf` `chore`

Forbidden commit messages: `"update"`, `"fix stuff"`, `"misc"`, `"changes"`

---

## Cross-platform rules

### Execution model during Phases 1–8

The authoritative way to run SAB is:

```
node dist/bridge.cjs
```

Do not write code that assumes any other execution model during this phase.
Do not write code that assumes the process is running inside a `.app` bundle or a `pkg` binary.

### Portability requirements for new code

- Use `process.cwd()` for working-directory resolution, not bundle-relative paths
- Use `path.resolve()` and `path.join()` — never hardcoded OS-specific separators
- Do not call `process.platform` inside domain modules (`src/sony/`, `src/atem/`, `src/bridge/`, `src/api/`)
- Do not import `child_process`, `applescript`, or macOS-only APIs in domain modules
- Any OS-specific behavior must be documented and flagged for future `src/platform/` extraction

### Frozen packaging artifacts (do not modify during Phases 1–8)

| File | Frozen reason |
|------|--------------|
| `scripts/launcher.swift` | macOS-specific; deferred to platform phase |
| `scripts/make-icon.swift` | macOS-specific; deferred to platform phase |
| `scripts/pack.sh` | Broken reference to `release/`; out of scope |
| `package.json bundle:app` | Stale; references non-existent .app path |
| `package.json release:zip` | Stale; out of scope |

### Import direction rule for platform layer

When `src/platform/` is eventually created:
- Platform modules MAY import from runtime modules
- Runtime modules MUST NOT import from `src/platform/`
- This rule applies immediately — do not write platform imports into runtime code as "temporary" wiring

---

## Phase completion gate

A migration phase is complete only when ALL of the following are true:
1. `src/index.ts` and `src/api/server.ts` still boot without errors
2. All `/api/*` endpoints respond correctly
3. Sony cameras connect and poll
4. ATEM commands dispatch to Sony correctly
5. WS state broadcast reaches the UI correctly
