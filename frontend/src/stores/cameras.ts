import { create } from 'zustand'
import type { CameraUIState } from '../types/ws'

interface CamerasStore {
  /** All cameras keyed by camera ID. */
  cameras: Map<string, CameraUIState>
  /** Replace the full camera map on each state broadcast. */
  setCameras: (list: CameraUIState[]) => void
}

export const useCamerasStore = create<CamerasStore>((set) => ({
  cameras: new Map(),

  setCameras(list) {
    const map = new Map<string, CameraUIState>()
    for (const cam of list) map.set(cam.id, cam)
    set({ cameras: map })
  },
}))

/** Selector: sorted camera list (by name). */
export function selectCameraList(state: CamerasStore): CameraUIState[] {
  return [...state.cameras.values()].sort((a, b) => a.name.localeCompare(b.name))
}
