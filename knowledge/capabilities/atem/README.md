# knowledge/capabilities/atem/

## Purpose
Evidence files for individual ATEM switcher capabilities, independent of any specific model.

## What belongs here
One file per ATEM capability. Each file documents:
- What the capability is (feature, command, or control property)
- Which ATEM models support it (confirmed)
- Which ATEM models do NOT support it (confirmed)
- The `atem-connection` event or command name
- Value ranges and semantics
- Firmware version dependencies
- Sources (Blackmagic docs, library source, live test)

## File naming
`<capability-slug>.md` — examples:
- `camera-control-iris.md`
- `camera-control-focus.md`
- `camera-control-iso.md`
- `camera-control-shutter.md`
- `camera-control-wb.md`
- `tally-preview.md`
- `multiview.md`

## Current files
(none — to be populated during Phase 4)
