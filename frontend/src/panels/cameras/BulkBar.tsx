/**
 * BulkBar — group control toolbar for applying one operation to many cameras.
 *
 * Reads the selection store (checked cameras) and the live camera list.
 * Every action POSTs to /api/cameras/bulk and shows a short result summary
 * (e.g. "3/4 ok"), surfacing the first error when a camera fails.
 *
 * Only exposure/focus/record ops that are confirmed on the backend are shown.
 * iris/shutter Auto-Manual are intentionally absent (backend returns 501 pending
 * hardware confirmation).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useCamerasStore, selectCameraList } from '../../stores/cameras'
import { useSelectionStore } from '../../stores/selection'
import { bulk, type BulkResponse } from '../../lib/api'
import styles from './BulkBar.module.css'

export function BulkBar() {
  const cameras = useCamerasStore(selectCameraList)
  const selected = useSelectionStore((s) => s.selected)
  const selectAll = useSelectionStore((s) => s.selectAll)
  const clear = useSelectionStore((s) => s.clear)

  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const allIds = useMemo(() => cameras.map((c) => c.id), [cameras])
  const ids = useMemo(() => allIds.filter((id) => selected.has(id)), [allIds, selected])
  const count = ids.length
  const noneSelected = count === 0
  const allSelected = count > 0 && count === allIds.length

  if (cameras.length === 0) return null

  function summarize(op: string, r: BulkResponse | null): string {
    if (!r) return `${op}: network error`
    const firstErr = r.results.find((x) => !x.ok)?.error
    const tail = r.okCount < r.total && firstErr ? ` — ${firstErr}` : ''
    return `${op}: ${r.okCount}/${r.total} ok${tail}`
  }

  async function run(label: string, op: string, params: object) {
    if (noneSelected || busy) return
    setBusy(true)
    setStatus(`${label}…`)
    const r = await bulk(op, params, ids)
    setStatus(summarize(label, r))
    setBusy(false)
  }

  return (
    <div className={styles.bar}>
      <div className={styles.selGroup}>
        <span className={styles.count}>{count} selected</span>
        <button
          className={styles.selBtn}
          onClick={() => (allSelected ? clear() : selectAll(allIds))}
        >
          {allSelected ? 'Clear' : 'Select all'}
        </button>
      </div>

      <div className={styles.ops} data-disabled={noneSelected || busy}>
        <Group label="ISO">
          <button className={styles.opBtn} onClick={() => run('ISO−', 'adjust', { param: 'iso', delta: -1 })}>−</button>
          <button className={styles.opBtn} onClick={() => run('ISO+', 'adjust', { param: 'iso', delta: 1 })}>+</button>
        </Group>
        <Group label="IRIS">
          <button className={styles.opBtn} onClick={() => run('IRIS−', 'adjust', { param: 'fnumber', delta: -1 })}>−</button>
          <button className={styles.opBtn} onClick={() => run('IRIS+', 'adjust', { param: 'fnumber', delta: 1 })}>+</button>
        </Group>
        <Group label="SHUT">
          <button className={styles.opBtn} onClick={() => run('SHUT−', 'adjust', { param: 'shutter', delta: -1 })}>−</button>
          <button className={styles.opBtn} onClick={() => run('SHUT+', 'adjust', { param: 'shutter', delta: 1 })}>+</button>
        </Group>
        <Group label="WB(K)">
          <button className={styles.opBtn} onClick={() => run('WB−', 'color-temp', { direction: -1 })}>−</button>
          <button className={styles.opBtn} onClick={() => run('WB+', 'color-temp', { direction: 1 })}>+</button>
        </Group>
        <Group label="WB">
          <button className={styles.opBtn} onClick={() => run('WB Auto', 'mode', { param: 'wb', mode: 'auto' })}>Auto</button>
          <button className={styles.opBtn} onClick={() => run('WB Man', 'mode', { param: 'wb', mode: 'manual' })}>Man</button>
        </Group>
        <Group label="FOCUS">
          <button className={styles.opBtn} onClick={() => run('AF-C', 'focus-mode', { mode: 'AF-C' })}>AF-C</button>
          <button className={styles.opBtn} onClick={() => run('MF', 'focus-mode', { mode: 'MF' })}>MF</button>
          <button className={styles.opBtn} onClick={() => run('Push AF', 'af', {})}>AF</button>
        </Group>
        <Group label="REC">
          <button className={`${styles.opBtn} ${styles.rec}`} onClick={() => run('REC start', 'record', { action: 'start' })}>●</button>
          <button className={styles.opBtn} onClick={() => run('REC stop', 'record', { action: 'stop' })}>■</button>
        </Group>
      </div>

      <div className={styles.status}>{status}</div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      <div className={styles.groupBtns}>{children}</div>
    </div>
  )
}
