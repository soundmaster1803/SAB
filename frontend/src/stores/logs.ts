import { create } from 'zustand'
import type { LogEntry } from '../types/ws'

/** Maximum number of log entries kept in memory. */
const MAX_LOG_ENTRIES = 500

interface LogsStore {
  entries: LogEntry[]
  appendLogs: (incoming: LogEntry[]) => void
  clear: () => void
}

export const useLogsStore = create<LogsStore>((set) => ({
  entries: [],

  appendLogs(incoming) {
    set((state) => {
      const next = [...state.entries, ...incoming]
      // Keep only the most recent MAX_LOG_ENTRIES entries.
      return { entries: next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next }
    })
  },

  clear() {
    set({ entries: [] })
  },
}))
