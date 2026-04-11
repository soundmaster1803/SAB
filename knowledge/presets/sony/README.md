# knowledge/presets/sony/

## Purpose
Preset definition files for Sony camera presets managed by SAB.

## What belongs here
One file per preset or preset category. Each file documents:
- Preset name and purpose
- Required capabilities (which models can use this preset)
- Steps in application order
- For each step: property, value, conversion method, success condition
- Safe application order rationale
- Partial failure behavior (which steps can be skipped vs. which cause abort)
- Post-apply state verification checklist

## Preset rules (from CLAUDE.md)
A preset must:
1. Validate camera model and capabilities before applying any step
2. Apply steps in safe order (safest first, irreversible last)
3. Support graceful partial failure or explicit refusal
4. Update state, variables, and feedbacks after apply

Presets are not dumb macro lists. They are validated multi-step workflows.

## File naming
`<preset-slug>.md` — examples:
- `interview-setup.md`
- `sports-mode.md`
- `log-base.md`
- `reset-to-defaults.md`

## Current files
(none — to be populated during Phase 8)
