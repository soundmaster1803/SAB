# knowledge/model-specs/atem/

## Purpose
Static model specification files for each supported Blackmagic ATEM switcher family.

## What belongs here
One file per ATEM switcher family.

Each file must document:
- Switcher family name and covered models
- Maximum number of camera control inputs
- Supported camera-control properties (iris, focus, ISO, shutter, WB, zoom)
- Tally capability (PGM only, or PGM+PVW)
- Multiview capability
- Macro support
- Recording capability (if any)
- `atem-connection` library version compatibility notes

## Evidence standard
Document values confirmed from:
1. Blackmagic Design developer documentation
2. `atem-connection` library source or event payload captures
3. Live switcher testing

## File naming
`<family-slug>.md` — example: `mini-pro.md`, `mini-extreme.md`, `television-studio.md`

## Relationship to code
These files are the source of truth for `src/atem/models/<model>.ts`.
TypeScript ATEM model spec files are derived from these documents.

## Current files
(none — to be populated during Phase 4)
