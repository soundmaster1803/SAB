import { create } from 'zustand'
import type { CameraUIState } from '../types/ws'

interface CamerasStore {
  /** All cameras keyed by camera ID. */
  cameras: Map<string, CameraUIState>
  /** Sorted camera list (by name) — stable reference between state updates. */
  cameraList: CameraUIState[]
  /** Replace the full camera map on each state broadcast. */
  setCameras: (list: CameraUIState[]) => void
}

export const useCamerasStore = create<CamerasStore>((set) => ({
  cameras: new Map(),
  cameraList: [],

  setCameras(list) {
    const map = new Map<string, CameraUIState>()
    for (const cam of list) map.set(cam.id, cam)
    const sorted = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    set({ cameras: map, cameraList: sorted })
  },
}))

/**
 * Selector: sorted camera list (by name).
 * Returns state.cameraList — a stable array reference computed in setCameras.
 * Using a computed selector (e.g. [...values()].sort()) would create a new
 * array on every getSnapshot call, causing React's useSyncExternalStore to
 * detect spurious changes and throw "Maximum update depth exceeded" (error #185).
 */
export function selectCameraList(state: CamerasStore): CameraUIState[] {
  return state.cameraList
}
