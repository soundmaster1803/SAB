# docs/research/

Protocol reference documents for SAB.

Source material from which `src/sony/protocol/prop-knowledge.ts` and `knowledge/sony/`
were built. Kept as deep-reference for Phase 8 work and future research.

## Files

| File | Contents |
|------|---------|
| `ref-sony.md` | Sony PTP/IP compact reference — transport, packet structure, key prop codes |
| `sony-ptp.md` | Sony Camera Control PTP/IP deep reference (98-page SDK analysis) |
| `ref-cameras.md` | Sony camera models + real SDK data, confirmed capabilities per model |

## Relationship to active code

`src/sony/protocol/prop-knowledge.ts` — compiled, machine-usable form of this research (1625 lines, 150+ props).
`knowledge/sony/` — structured JSON knowledge files (capability-catalog, command-catalog, model specs).
`docs/research/` — human-readable source material for future deep dives.

## Critical protocol notes

**DataPhase:** Sony uses **0/1/2** (not 1/2/3 per PTP spec). 0 = no data, 1 = write, 2 = read. Never change.
**BUTTON format:** `[0x81][btnCode:1][down=0x02/up=0x03:1]` via SDIO_ControlDevice.
**Polling opcode:** `SDIO_GetAllExtDevicePropInfo` (0x9209) — main prop poll.
**SDIO prop layout:** 6-byte header `[propCode:2][dtype:2][getset:1][reserved:1]` then default+current values.
`ref-cameras.md` corrections take precedence over `ref-sony.md` when they conflict.
