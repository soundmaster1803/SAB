# Camera UI redesign — spec (approved 2026-07-04)

Interactive mockup: `docs/design/camera-card-mockup.html` (open in a browser).
This is the approved target for the operator console redesign. Build it in React
(`frontend/src/panels/cameras/`) against the existing backend endpoints.

## Product framing
SAB is a **live-broadcast control-room** tool for Sony cameras on the network. The
operator configures any camera from the control room without walking to it (important
when volunteers hold the cameras): set one, push to all, format cards, set record mode,
start recording. Everything must be glanceable and fast; UI is **English**, **no emoji**
(SVG icons only — see [[no-emoji-rule]]).

## Two-tier structure
**Card = compact & uniform.** Every card has the same layout; only values differ.
1. **Statuses (top):** record time (blinks while recording), card time left, battery
   (**always** % + remaining time; on mains add "On adapter" label — never hide), audio
   mini VU meters, tally (On Air / Preview / Idle), reconnect icon.
2. **ATEM link strip:** `ATEM · IN n · Control + tally` (or "Tally only" when control off).
3. **Quick controls (realtime only):** ISO, Shutter, Iris, WB — compact ▲▼ with a small
   M/A toggle where it applies. Mode switches are NOT here.
4. **Footer:** per-camera **Record/Stop** button + **Camera settings** button.

**Everything deep = modal** (opened by Camera settings). Tabs:
- **Exposure** — the full base params WITH every mode switch: ISO/gain (+unit dB/ISO, base
  ISO), Shutter (Speed/Angle/ECS/Auto mode + A/M), Iris (A/M), White Balance (mode select
  AWB/Daylight/Cloudy/Color Temp/Custom + temp + tint), Focus (7 modes + area + Push AF + pull).
- **Recording** — file/codec → resolution → frame-rate cascade, media slot, format card.
- **Look & Color** — base look, Monitor LUT, creative look, picture-profile (gamma/black/sat).
- **Audio** — per-channel input select, MIC/LINE type, level mode, gain, wind filter, meters.
- **Device** — name / IP / model, ATEM input + control link, remove camera.
- **All properties** — searchable view over the full PTP3 catalog (776 props).

## Per-knob controls (from PTP3 catalog — not universal A/M)
- ISO/Gain: A/M (0xD01C) + unit dB/ISO (0xD01D) + base ISO (0xD020).
- Shutter: mode Speed/Angle/ECS (0xD010) + A/M (0xD013).
- Iris: A/M (0xD001).
- WB: **mode select** (0x5005: AWB 0x0002 / Color Temp 0x8012 / …) + temp (0xD20F) + tint (0xD00D/0xD210/0xD21C).
- Focus: **mode select** (0x500A: MF/AF-S/AF-C 0x8004/AF-A/DMF/AF-D 0x8008/PF) + area (0xD22C) + AF.

## Apply targets + presets
- Every tab footer: **Apply to** = This camera / All / **Selected** (camera checkboxes) +
  Cancel / Apply / Apply to all. After apply → honest per-camera report
  ("Applied to 4 of 5 — Cam 5 (ZV-E10 II): format not supported"). Backend already does
  this via `POST /api/cameras/bulk` (per-camera results) and the `rec-settings` op which
  validates format against each camera's live list.
- **Presets:** Presets button (roombar) + Preset line in the modal (Load / Save as preset).
  A preset captures the **full camera config**. Scenario: cameras came back mis-configured
  from a shoot → load "Broadcast Live" → Apply to all → every camera set for air.
  (Needs new backend: preset storage + apply-config-to-cameras.)

## Backend it maps onto (already built this session)
- `POST /api/cameras/bulk` — group apply, per-camera results (partial-failure). Ops:
  adjust, color-temp, shutter-set, mode, focus-mode, focus-area, af, record, rec-settings.
- `GET /api/sony/catalog`, `GET/POST /api/cameras/:id/prop` — generic any-property control.
- Confirmed wire values + `ptp3-catalog.json` (776 props) for enum labels.
- **Still to add for the redesign:** bulk ops for audio / look / exposure props; preset
  save/load + apply-config endpoints.
