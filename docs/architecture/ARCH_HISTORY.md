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
