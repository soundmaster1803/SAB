/**
 * api/viewmodels/camera.ts
 *
 * Camera view-model helpers for the operator UI.
 *
 * Responsibilities:
 *   - Assemble the per-camera state object the UI and WS broadcast consume
 *   - Preserve the legacy UI payload shape while attaching richer state layers
 *
 * Does not own:
 *   - HTTP route handlers
 *   - WebSocket setup or broadcast
 *   - Camera config mutations
 */

import type { CameraState } from '../../sony/ptp-client';
import { getSonyRuntimeState } from '../../sony/state/runtime';

/**
 * Transform a raw CameraState into the UI-ready format.
 * Keeps legacy top-level fields (`iso`, `shutter`, etc.) intact for the
 * current operator UI, while exposing `raw`, `derived`, and `alerts` for the
 * richer camera-data system.
 */
export function uiState(cam: CameraState) {
  const { raw, derived, alerts } = getSonyRuntimeState(cam);

  return {
    ...raw,
    iso: derived.isoDisplay,
    shutter: derived.shutterDisplay,
    raw,
    derived,
    alerts,
  };
}
