# knowledge/capabilities/sony/

## Purpose
Evidence files for individual Sony camera capabilities, independent of any specific model.

## What belongs here
One file per capability type. Each file documents:
- What the capability is (feature, behavior, or property)
- Which camera families support it (confirmed)
- Which camera families do NOT support it (confirmed)
- The PTP property code or opcode that controls it
- Value ranges and semantics
- Any firmware version dependencies
- Sources (hardware log, Sony docs, live test)

## Why separate from model specs
A capability file describes one feature across all models.
A model spec file lists all features for one model.
Both are needed. The capability file is the evidence base; the model spec is the compiled view.

## File naming
`<capability-slug>.md` — examples:
- `nd-filter.md`
- `s-log3.md`
- `timecode.md`
- `4k-recording.md`
- `ptp-autofocus.md`
- `mf-position.md`

## Current files
(none — to be populated during Phase 4)
