# knowledge/known-issues/

## Purpose
Documented failure modes, protocol bugs, and known-bad patterns with root cause analysis.
These prevent re-introducing bugs that have already been discovered and solved.

## What belongs here
One file per issue. Each file documents:
- Issue name and symptoms
- Root cause (confirmed or suspected)
- Affected cameras, firmware versions, or configurations
- How it was triggered
- What was tried that did NOT work (to prevent re-attempting failed fixes)
- The correct fix (if known)
- Status: open / fixed / workaround / wont-fix
- Date discovered

## Critical existing issues (must be documented here)

### DataPhase 1/2/3 breaks Sony cameras
- Symptom: `0xA101 (Invalid TransactionID)` and `0x2005 (Operation Not Supported)`
- Cause: Sony PTP/IP uses DataPhase 0/1/2, not 1/2/3 per spec
- Triggered: Session 1 change to spec-compliant values broke all connections
- Fix: Revert to 0/1/2. Never change DataPhase values again without hardware verification.
- Status: Fixed (Session 4 rollback)

### 0x2005 on BUTTON commands (unresolved)
- Symptom: REC and AF trigger commands return `0x2005 (Operation Not Supported)`
- Present since before Session 1 (pre-dates DataPhase change)
- Suspected causes: incorrect params format, incorrect data payload
- Status: Open — needs `[V]` log capture with DataPhase=0/1/2 to isolate

### TCP EHOSTDOWN on camera retry
- Symptom: After first TCP timeout (5s), subsequent retries immediately fail with `EHOSTDOWN`
- Cause: OS caches host unreachability; not a code bug
- Trigger: Camera powered off or PTP/IP disabled in camera menu
- Fix: None needed — retry cycle is correct, user must enable PTP/IP on camera
- Status: Known behavior, not a bug

## File naming
`<issue-slug>.md` — examples:
- `dataphase-spec-mismatch.md`
- `button-0x2005.md`
- `ehostdown-retry.md`

## Current files
(none yet — document the three issues above first)
