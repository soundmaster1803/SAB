import { useRef, useEffect, useState } from 'react'
import { useLogsStore } from '../../stores/logs'
import type { LogEntry } from '../../types/ws'
import styles from './LogPanel.module.css'

const FILTERS = ['ALL', 'ATEM', 'SONY', 'BRIDGE', 'UI'] as const
type Filter = typeof FILTERS[number]

function catClass(category: string): string {
  const map: Record<string, string> = {
    ATEM:    styles.catATEM!,
    SONY:    styles.catSONY!,
    BRIDGE:  styles.catBRIDGE!,
    UI:      styles.catUI!,
    Manager: styles.catManager!,
    SYSTEM:  styles.catSYSTEM!,
  }
  return map[category] ?? styles.catSYSTEM!
}

function matchesFilter(entry: LogEntry, filter: Filter): boolean {
  if (filter === 'ALL') return true
  return entry.category.toUpperCase().includes(filter)
}

interface LogPanelProps {
  open: boolean
  onClose: () => void
}

export function LogPanel({ open, onClose }: LogPanelProps) {
  const entries = useLogsStore((s) => s.entries)
  const clear   = useLogsStore((s) => s.clear)

  const [filter, setFilter] = useState<Filter>('ALL')
  const scrollRef = useRef<HTMLDivElement>(null)

  const visible = entries.filter((e) => matchesFilter(e, filter))

  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.toolbar}>
          <span className={styles.title}>System Log</span>
          <span className={styles.count}>{visible.length}</span>

          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <button className={styles.clearBtn} onClick={clear}>Clear</button>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        <div className={styles.scroll} ref={scrollRef}>
          {visible.length === 0 ? (
            <div className={styles.empty}>No log entries</div>
          ) : visible.map((entry, i) => (
            <div key={i} className={styles.entry}>
              <span className={styles.ts}>{entry.timestamp}</span>
              <span className={`${styles.cat} ${catClass(entry.category)}`}>
                {entry.category}
              </span>
              <span className={styles.text}>{entry.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
