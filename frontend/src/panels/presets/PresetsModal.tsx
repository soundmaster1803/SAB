/**
 * PresetsModal — save the current camera setup as a named preset and load it back
 * onto every camera in one tap. A preset is a bundle of bulk actions (same op
 * vocabulary as /bulk); applying replays them across all cameras with an honest
 * per-camera report. Scenario: cameras came back mis-configured from a shoot →
 * load "Broadcast Live" → Apply to all → every camera set for air.
 */
import { useEffect, useState } from 'react'
import { useCamerasStore, selectCameraList } from '../../stores/cameras'
import { bulk, type BulkResult } from '../../lib/api'
import { Icon } from '../../components/Icon'
import styles from './PresetsModal.module.css'

interface PresetAction { op: string; params: Record<string, unknown>; label: string }
interface Preset { name: string; description?: string; actions: PresetAction[]; savedAt: number }

interface Props { open: boolean; onClose: () => void }

export function PresetsModal({ open, onClose }: Props) {
  const cameras = useCamerasStore(selectCameraList)
  const [presets, setPresets] = useState<Preset[]>([])
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!open) return
    fetch('/api/presets').then((r) => r.json()).then((d: { presets: Preset[] }) => setPresets(d.presets ?? [])).catch(() => {})
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  // Build a preset from the first connected camera's current setup.
  function captureActions(): PresetAction[] {
    const ref = cameras.find((c) => c.connected) ?? cameras[0]
    if (!ref) return []
    const actions: PresetAction[] = []
    const rec: Record<string, number> = {}
    if (ref.movieFileFormat) rec.movieFileFormat = ref.movieFileFormat
    if (ref.recFrameRate) rec.recFrameRate = ref.recFrameRate
    if (ref.recSetting) rec.recSetting = ref.recSetting
    if (ref.recMedia) rec.recMedia = ref.recMedia
    if (Object.keys(rec).length) actions.push({ op: 'rec-settings', params: rec, label: 'Recording' })
    actions.push({ op: 'mode', params: { param: 'wb', mode: ref.derived?.wbIsAuto ? 'auto' : 'manual' }, label: 'WB mode' })
    return actions
  }

  async function saveCurrent() {
    const n = name.trim()
    if (!n) return
    const actions = captureActions()
    await fetch(`/api/presets/${encodeURIComponent(n)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions, description: `${actions.length} setting group(s)` }),
    }).catch(() => {})
    setName('')
    const d = await (await fetch('/api/presets')).json()
    setPresets(d.presets ?? [])
    setStatus(`Saved “${n}”`)
  }

  async function applyToAll(p: Preset) {
    setStatus(`Applying “${p.name}”…`)
    const merged = new Map<string, { ok: boolean; error?: string }>()
    for (const a of p.actions) {
      const res = await bulk(a.op, a.params, 'all')
      if (!res) continue
      for (const r of res.results as BulkResult[]) {
        const prev = merged.get(r.id)
        if (!prev || (prev.ok && !r.ok)) merged.set(r.id, { ok: r.ok, error: r.ok ? undefined : `${a.label}: ${r.error}` })
      }
    }
    const rows = Array.from(merged.values())
    const ok = rows.filter((r) => r.ok).length
    setStatus(`“${p.name}” applied to ${ok} of ${rows.length} camera(s)`)
  }

  async function remove(p: Preset) {
    await fetch(`/api/presets/${encodeURIComponent(p.name)}`, { method: 'DELETE' }).catch(() => {})
    setPresets((list) => list.filter((x) => x.name !== p.name))
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div className={styles.title}>Presets</div>
          <button type="button" className={styles.close} onClick={onClose} title="Close"><Icon name="x" /></button>
        </div>

        <div className={styles.body}>
          {presets.length === 0 && <div className={styles.empty}>No presets yet. Save the current setup below.</div>}
          {presets.map((p) => (
            <div key={p.name} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.pn}>{p.name}</div>
                <div className={styles.pd}>{p.description ?? `${p.actions.length} action(s)`}</div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.prim}`} onClick={() => applyToAll(p)}>
                  <Icon name="applyAll" size={13} />Apply to all
                </button>
                <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => remove(p)} title="Delete preset">
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          ))}

          <div className={styles.sec}>Save current setup</div>
          <div className={styles.saveRow}>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="New preset name…" onKeyDown={(e) => e.key === 'Enter' && saveCurrent()} />
            <button type="button" className={`${styles.btn} ${styles.prim}`} onClick={saveCurrent} disabled={!name.trim()}>
              <Icon name="save" size={13} />Save
            </button>
          </div>
          <div className={styles.note}>A preset captures recording format and white-balance mode from a connected camera; Apply to all pushes it to every camera and reports any that can’t take it.</div>
          {status && <div className={styles.status}>{status}</div>}
        </div>
      </div>
    </div>
  )
}
