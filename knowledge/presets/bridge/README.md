# knowledge/presets/bridge/

## Purpose
Bridge-level preset definitions that coordinate settings across both Sony cameras and the ATEM switcher simultaneously.

## What belongs here
One file per bridge preset. Each file documents:
- Preset name and purpose
- ATEM state changes required (routing, multiview, macros)
- Sony camera state changes required (exposure, color, recording mode)
- Execution order (ATEM steps vs. Sony steps, sequencing rationale)
- Required capabilities on both sides (ATEM model, Sony model)
- Rollback behavior if one side fails
- Dependencies on other presets

## Why bridge presets are distinct from Sony presets
A Sony preset only affects Sony cameras.
A bridge preset affects the system as a whole — ATEM routing, Sony exposure, tally state.
Bridge presets require both ATEM and Sony capabilities to be checked before application.

## File naming
`<preset-slug>.md` — examples:
- `switch-to-camera-2-interview.md`
- `live-production-start.md`
- `live-production-end.md`

## Current files
(none — to be populated during Phase 8)
