# docs/research/

Research reference documents for the SAB project.
These contain protocol specifications, SDK data, hardware logs, and conversion tables
that were gathered before and during the modular refactor.

## Files

| File | Contents |
|------|---------|
| `ref-sony.md` | Sony PTP/IP compact reference — transport, packet structure, property codes |
| `sony-ptp.md` | Sony Camera Control PTP/IP deep reference (98-page SDK analysis) |
| `ref-cameras.md` | Sony camera models + real SDK data, corrections to ref-sony.md |
| `ref-patterns.md` | PTP/IP code patterns for packet building and command sending |
| `ref-atem.md` | ATEM Camera Control compact reference — `atem-connection` library usage |
| `ref-map.md` | ATEM → Sony mapping table (clean version with conversion strategy) |
| `mapping-table.md` | ATEM → Sony mapping table (detailed version with code examples) |

## Relationship to knowledge/

`docs/research/` — raw reference material (original docs and analysis)
`knowledge/` — structured, evidence-tagged knowledge files (normalized for code use)

Research docs are the source. Knowledge files are the processed output.
When a research doc contradicts a knowledge file, investigate and update both.

## Critical notes from research

### Sony DataPhase encoding
Sony PTP/IP uses DataPhase **0/1/2** (no-data/write/read).
The PTP/IP spec says 1/2/3. Sony ignores the spec. **Never change this.**

### Sony BUTTON command format (confirmed working)
`data = UINT32(value)`, `params = [propCode, 1]`
See `knowledge/known-good/` for full record.

### ref-cameras.md corrections
`ref-cameras.md` contains critical corrections to `ref-sony.md` (SDIO_Connect sequence).
Always prefer `ref-cameras.md` when the two conflict.
