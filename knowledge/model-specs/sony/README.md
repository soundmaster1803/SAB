# knowledge/model-specs/sony/

## Purpose
Static model specification files for each supported Sony camera family.

## What belongs here
One file per camera family (not per specific model variant).

Each file must document:
- Camera family name and covered models (e.g. FX30, FX3, ZVE10 II)
- Confirmed capabilities (ND, timecode, 4K, ProRes, etc.)
- Supported PTP property codes (confirmed from hardware or Sony docs)
- Supported button/opcode values
- Known unsupported features
- Firmware version notes (if behavior changed between versions)

## Evidence standard
A capability may only be listed if supported by at least one of:
1. Official Sony SDK or protocol documentation
2. Captured hardware PTP log showing the property/opcode in active use
3. Explicit live-test confirmation from the project owner

Do not declare capabilities from documentation alone if live tests have contradicted them.

## File naming
`<family-slug>.md` — example: `fx30.md`, `fx3.md`, `zve10ii.md`

## Relationship to code
These files are the source of truth for `src/sony/models/<model>.ts`.
TypeScript model spec files are derived from these documents.
When a hardware log reveals a correction, update this file first, then the TypeScript spec.

## Current files
(none — to be populated during Phase 4)
