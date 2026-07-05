# Session log — 2026-07-04/05 (release v1.1.0-beta)

Full record of what was done this session and where to find it. Chronological.

## 1. Competitor analysis — MiddleControl.app
Studied `MiddleControl.app` (Middle Things, native macOS/Swift, v3.2.0). It's a
multi-brand camera control hub (Sony SDK, Canon REST, Blackmagic REST, VISCA/PTZ, USB)
with live preview, an embedded web media server, VISCA-server output, presets, joysticks,
Bitfocus Companion. Their hardware (APC-R controllers) is the real product.
→ Takeaways for SAB: multi-camera bulk control, generic property control, presets,
Companion later. NOT taking: live preview / FFmpeg / OpenCV.

## 2. Full code review + staged roadmap
`CODE_REVIEW_AND_ROADMAP.md` (repo root) — the running plan + work log for the whole session.
Found + fixed P1 bugs, laid out stages 0–7.

## 3. Backend work — SHIPPED (all committed to main)
- **Stage 0** (`6cd312a`): fixed dead UI routes — `POST /api/cameras/:id/shutter-set`
  (direct shutter), `/focus-area`, `/mode` (WB + ISO auto). Added `ptp-client.setPropNearest`.
  Removed dead code. → `src/api/routes/cameras.ts`, `src/sony/ptp-client.ts`.
- **Stage 2 — bulk** (`fc1b774`): `POST /api/cameras/bulk` applies one op to a group
  ("all"|ids[]) with **per-camera results** (partial-failure). Frontend: `stores/selection.ts`,
  `lib/api.ts`, `panels/cameras/BulkBar.tsx`, selection checkbox on cards.
- **SDK/PTP3 wire-value fixes** (`0dfd058`): integrated Sony CrSDK v2.02 + Camera Control
  PTP 3 Reference. **Key lesson: CrSDK enum values ≠ raw PTP wire values** (proven via
  FocusMode). Fixed WB Color-Temp (0x8006→0x8012), focus-area XS/XL/lock-on, added AF-D.
  Implemented cinema Auto/Manual (iris 0xD001 / shutter 0xD013 / gain 0xD01C) via
  `ptp-client.setCineMode` + `hasProp`.
- **Full-control foundation** (`5e30d33`): `knowledge/sony/ptp3-catalog.json` — full catalog
  parsed from the PTP3 Reference (**776 props, 585 with enum values**). Loader
  `src/sony/protocol/ptp3-catalog.ts`. `ptp-client.setPropTyped` (datatype-exact packing).
  Generic endpoints `src/api/routes/sony-props.ts`: `GET /api/sony/catalog`,
  `GET/POST /api/cameras/:id/prop` (safeToWrite-gated). Reconciled prop-knowledge vs catalog
  (fixed WB/exposure-mode UINT16→UINT32/focus-area UINT8→UINT16).
- **Live toggles** (`4e20a20`): parse WB mode (0x5005) + shutter mode (0xD013) into state;
  expose `wbIsAuto`/`shutterIsAuto`; the previously-hardcoded WB/Shutter A/M toggles now
  reflect real state. Files: `ptp-client.ts`, `state/{raw,runtime,derived}.ts`,
  `frontend/src/types/ws.ts`, `CameraCard.tsx`.
- **Bulk rec-settings** (`ef5d3f5`): `rec-settings` bulk op validates format against each
  camera's live supported list → "applied to all except <cam> (format not supported)".

## 4. Sony reference docs (local, gitignored) + findings
- Vendor SDKs in repo root, gitignored: `CrSDK_v2/`, `CameraRemoteCommand-2.02.00/`.
- Findings written to `docs/research/sony-sdk/`: `FINDINGS.md` (SDK≠wire caveat + reconciliation),
  `ptp3-confirmed-values.md` (authoritative wire values), `README.md`.
- Battery/power diagnostic: `charging` field is a **misnomer** (means "external power",
  not "battery charging"); bit-0x08 heuristics on 0xD205/0xD20E don't match the PTP3 enum
  (levels 1–6). See memory `sab-battery-interpretation`.
- Audio: PTP3 fully supports input select (0xE051-E054), MIC/LINE (0xE0AA/AB), gain/level
  (0xE048-E050); live VU meter likely only via liveview stream, not a pollable prop.

## 5. UI redesign — design locked, NOT yet implemented in React
- Approved interactive mockup: `docs/design/camera-card-mockup.html`.
- Spec: `docs/design/camera-ui-redesign.md`.
- Structure: uniform compact cards (statuses + ATEM strip + quick controls + Record button
  + Settings) → settings **modal** with tabs (Exposure/Recording/Look/Audio/Device/All) →
  per-tab apply targets (This/All/Selected) with honest report → **presets** (save/load full
  config, apply to all). English, SVG icons only.

## 5b. UI redesign implementation — IN PROGRESS (2026-07-05)
- **Layer 1 SHIPPED** (`05e6892`): compact uniform card. New files:
  `frontend/src/components/Icon.tsx` (SVG icon set, no emoji), token additions in
  `styles/tokens.css`, `panels/cameras/CompactCameraCard.{tsx,module.css}`,
  `QuickControl.{tsx,module.css}`. `CameraGrid`/`App` render it; old `CameraCard.tsx`
  left in place (not rendered). Wired to adjust/color-temp/mode/record/connect.
- **Backend bulk `prop` op SHIPPED** (`77e6a3d`): apply any catalog property to a group
  (for upcoming Look/Audio/All tabs).
- **Layer 2 (settings modal) — PARKED, unfinished**: agent got cut off mid-build. WIP moved
  to `docs/design/wip-settings-modal/` (Exposure tab + shell CSS + helpers done; main modal
  component, Recording/Device/Look/Audio/All tabs, footer, and wiring NOT done). See that
  folder's README to resume. `lib/api.ts` gained `patch()`/`del()` helpers (kept, committed).
- **Launcher SHIPPED** (`2355124`): `scripts/sab.sh {start|stop|restart|status}` +
  double-clickable `SAB.command`. start builds UI + runs bridge on :7777 + opens browser;
  tested green.

## 6. Where to look next (implementation TODO)
0. **Finish the settings modal** — resume from `docs/design/wip-settings-modal/` (see its README).
1. Implement the redesign in React by layers: compact `CameraCard` → `CameraSettingsModal`
   (tabs) → `PresetsModal`. Verify build each layer.
2. New backend: bulk ops for audio/look/exposure props; preset storage + apply-config.
3. Verify the real ATEM bar renders (user reported it not visible — check on `npm run dev:ui`).
4. Deferred: cinema iris/shutter + focus-area values need confirmation on real FX6/FX30
   via `GET /api/cameras/:id/debug`.
5. Clean up 43 prop-knowledge dataType doc-mismatches (non-breaking; catalog is authoritative).

## Key files map
- Backend control: `src/api/routes/cameras.ts` (per-camera + bulk), `src/api/routes/sony-props.ts` (generic).
- Sony transport: `src/sony/ptp-client.ts`; state: `src/sony/state/*`; knowledge:
  `src/sony/protocol/prop-knowledge.ts` + `ptp3-catalog.ts`; catalog data: `knowledge/sony/ptp3-catalog.json`.
- Frontend: `frontend/src/panels/cameras/*`, `stores/*`, `lib/api.ts`, `types/ws.ts`.
- Plan/log: `CODE_REVIEW_AND_ROADMAP.md`; design: `docs/design/`; research: `docs/research/sony-sdk/`.
