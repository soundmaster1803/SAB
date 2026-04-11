# SAB Architecture Rules

## Goal
Turn SAB from a working bridge utility into a modular camera control platform while preserving the current working build.

## Core principles
1. Preserve the working version.
2. Extract before rewriting.
3. Domain boundaries are mandatory.
4. Capabilities drive UI, actions, presets, and conversions.
5. All conversion logic must be explicit and inspectable.
6. Research must become files, not just context in an LLM session.

## Source of truth layers
### Persistent
- `config.json`
- model specs
- capability files
- preset definitions
- architecture docs

### Runtime
- Sony raw state
- Sony derived state
- ATEM raw state
- ATEM camera-control state
- Bridge state
- UI view state

## New required architectural objects
### SonyModelSpec
Static known model data.

### SonyCapabilities
Derived live-supported features for a connected camera.

### SonyRawState
Raw parsed protocol values.

### SonyDerivedState
Human-usable values and normalized semantics.

### SonyAlertState
Low battery, missing media, stale poll, etc.

### AtemModelSpec
Static/live ATEM capability description.

### AtemDerivedState
Normalized switcher state for logic and UI.

### ControlIntent
Normalized requested camera control operation.

### BridgePolicyDecision
Can/should an intent be executed and how.

## Entry point rules
`src/index.ts` must only:
- initialize logging
- load config
- create core modules
- wire modules together
- start services

It must not contain complex domain logic.

## API rules
`src/api/server.ts` must be reduced into wiring only.
Route logic must move into route modules and service modules.
UI formatting must move into viewmodel files.

## Knowledge rules
All research must be converted into structured files under:
- `docs/research/`
- `knowledge/model-specs/`
- `knowledge/capabilities/`
- `knowledge/known-good/`
- `knowledge/known-issues/`

## Parallel work rules
Subagents may work in parallel only when their scopes are disjoint.
All merges must pass through the architecture/reviewer agent.

## Migration safety rules
For every refactor task:
- identify source files
- identify destination files
- preserve behavior first
- only then improve behavior
- update docs after move
