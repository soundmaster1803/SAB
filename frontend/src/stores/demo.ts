import { create } from 'zustand'

/**
 * Demo mode — lets the operator console be explored with no cameras/backend.
 * When enabled, a driver seeds fabricated cameras into the cameras store and the
 * WS dispatch stops overwriting them. Control actions still POST but their 404s
 * are harmless (no camera exists); the UI updates optimistically enough to feel live.
 */
interface DemoStore {
  enabled: boolean
  toggle: () => void
}

export const useDemoStore = create<DemoStore>((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
}))
