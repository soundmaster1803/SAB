# SAB — Claude Operating Manual

Version: 0.7.0
Last updated: 2026-04-19

This file is the short operating manual for AI work in SAB.
Detailed architecture and domain knowledge must live in dedicated docs, not here.

## 1. Project mission
SAB (Sony ATEM Bridge) is a modular platform connecting:
- Sony cameras via PTP/IP
- Blackmagic ATEM switchers
- an operator web UI

Permanent domains:
- Sony
- ATEM
- Bridge
- UI

The runtime must stay operational. Changes should be incremental, not giant rewrites.

## 2. Read order before coding
For any normal task:
1. `PROJECT_MAP.md`
2. `AI_TASK_PROTOCOL.md`
3. the relevant domain doc in `docs/domains/`
4. only then the specific source files for the task

Do not read the whole project by default.

## 3. Source of truth
Main editable sources:
- `src/`
- `frontend/src/`
- `docs/`
- `knowledge/`
- `config.json`

Generated / build outputs:
- `dist/`
- `public/`

Never treat `dist/` or `public/` as the main place for edits.

Critical UI rule:
- UI source lives in `frontend/src/`
- Express serves built UI from `public/`
- if frontend source changed but `public/` was not rebuilt, old UI may appear

## 4. Domain boundaries
### Sony
Owns PTP/IP transport, polling, camera state, runtime capabilities, Sony actions.
Must not own ATEM routing or UI formatting.

### ATEM
Owns switcher connectivity, tally, discovery, ATEM state.
Must not own Sony transport or UI formatting.

### Bridge
Owns intent decoding, conversion, policies, anti-loop, throttle, sync.
Must not own raw Sony/ATEM transport or UI rendering.

### UI
Owns panels, stores, presentation, operator workflows.
Must not own transport logic or raw device protocol logic.

## 5. Hard rules
- Do not edit `dist/` as source
- Do not edit `public/` as source
- Do not add domain logic to `src/index.ts`
- Do not add domain logic to `src/api/server.ts`
- Do not duplicate Sony constants outside `src/sony/constants.ts`
- Do not make hidden architectural changes without updating docs
- Do not perform broad refactors without explicit need
- Do not use the whole repo as default context

## 6. Sensitive files
Treat these as high-risk:
- `src/sony/ptp-client.ts`
- `src/sony/manager.ts`
- `src/sony/packet-builder.ts`
- `src/sony/constants.ts`
- `src/bridge/mapper.ts`
- `src/bridge/atem-decoder.ts`
- `src/config.ts`
- `src/logger.ts`

## 7. Execution protocol
Follow `AI_TASK_PROTOCOL.md`.
Short form:
1. classify task
2. locate domain
3. search related files
4. read only needed sources
5. make minimal change set
6. validate (`typecheck`, `build`, `build:ui` when relevant)
7. inspect `git diff`
8. then commit

## 8. Validation commands
- `npm run typecheck`
- `npm run build`
- `npm run build:ui`
- `npm run dev`
- `npm run dev:ui`

## 9. Supporting docs
- `PROJECT_MAP.md`
- `RUNBOOK.md`
- `WORKFLOW.md`
- `AI_TASK_PROTOCOL.md`
- `docs/domains/ui.md`
- `docs/domains/api.md`
- `docs/domains/bridge.md`
- `docs/domains/sony.md`
- `docs/domains/atem.md`
- `docs/architecture/current-system.md`

## 10. Git discipline
- Small thematic commits
- No accidental generated files
- Check `git diff` before commit
- Keep changes understandable and reversible
