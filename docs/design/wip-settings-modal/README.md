# WIP — Camera Settings Modal (layer 2, unfinished)

Parked here so it stays out of the frontend build (`frontend/src/` only) while
incomplete. Move back to `frontend/src/panels/cameras/settings/` to resume.

## What's done
- `settings/ExposureTab.tsx` — Exposure tab (ISO/gain, shutter, iris, WB, focus with mode switches).
- `settings/parts.tsx`, `settings/types.ts` — shared modal building blocks / types.
- `settings/CameraSettingsModal.module.css` — modal styles (shell, tabs, footer).
- `recordingOptions.ts` — recording label tables / helpers extracted from the old CameraCard.

## What's missing (next session)
1. `CameraSettingsModal.tsx` main component: shell (header / presetline / tabs / scrollable body / footer).
   IMPORTANT layout: body `flex:1; min-height:0; overflow-y:auto` so the tab row never gets squeezed.
2. Recording tab (cascade from live lists 0xD241/0xD286/0xD242 + format-card dialog) and Device tab
   (name/IP PATCH, ATEM input/control, remove DELETE).
3. Look & Color / Audio / All-properties tabs (use bulk op `prop` — already in backend, commit 77e6a3d).
4. Shared apply-target footer: This camera / All / Selected + per-camera report via `bulk(op,params,ids)`.
5. Wire into `CameraGrid`/`App`: repoint `onSettings` from the debug modal to this modal.

Full spec: `docs/design/camera-ui-redesign.md`. Mockup: `docs/design/camera-card-mockup.html`.
Fixed one build error already present (unused CameraUIState import in ExposureTab) — check before reuse.
