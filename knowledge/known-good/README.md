# knowledge/known-good/

## Purpose
Confirmed-working protocol patterns, command formats, and configuration values.
These are the source of truth for implementation decisions when documentation is ambiguous or incorrect.

## What belongs here
One file per confirmed pattern. Each file documents:
- The pattern name and what it does
- The exact format (bytes, fields, values)
- Which camera model(s) this was confirmed on
- Firmware version at time of confirmation
- How it was confirmed (hardware log, live test, SDK)
- The date of confirmation
- Any contradictions with official documentation (and which is correct)

## Critical existing patterns (must be documented here)

### Sony DataPhase encoding
Sony PTP/IP uses DataPhase 0/1/2 (no-data/write/read).
The PTP/IP spec says 1/2/3. Sony ignores the spec.
Confirmed: 0/1/2 is the working value on all tested Sony cameras.
Changing to 1/2/3 breaks all camera connections (confirmed in Session 4 emergency rollback).

### Sony BUTTON command format
`data = UINT32(value)`, `params = [propCode, 1]`
Confirmed working for REC, AF trigger.
Alternative format `[ctrlType:1][UINT16:2]` caused 0x2005 errors — do not use until re-verified with correct DataPhase.

## File naming
`<pattern-slug>.md` — examples:
- `sony-dataphase-encoding.md`
- `sony-button-command-format.md`
- `sony-session-handshake.md`
- `atem-iris-range.md`

## Current files
(none yet — document the two critical patterns above first)
