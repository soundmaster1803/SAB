import { create } from 'zustand'

/**
 * Selection store — which cameras are checked for bulk operations.
 * Holds a Set of camera ids. The BulkBar acts on this set; CameraCard
 * renders a checkbox bound to it.
 */
interface SelectionStore {
  selected: Set<string>
  toggle: (id: string) => void
  set: (id: string, on: boolean) => void
  selectAll: (ids: string[]) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selected: new Set<string>(),

  toggle: (id) => set((s) => {
    const next = new Set(s.selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    return { selected: next }
  }),

  set: (id, on) => set((s) => {
    const next = new Set(s.selected)
    if (on) next.add(id); else next.delete(id)
    return { selected: next }
  }),

  selectAll: (ids) => set({ selected: new Set(ids) }),

  clear: () => set({ selected: new Set<string>() }),
}))
