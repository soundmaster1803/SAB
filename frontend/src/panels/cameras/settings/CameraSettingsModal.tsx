/**
 * CameraSettingsModal — the comprehensive per-camera settings modal.
 *
 * Layout is a flex column: header / presetline / tabs / scrollable body / footer,
 * with the body `flex:1; min-height:0; overflow-y:auto` so the tab row never gets
 * squeezed. Every control routes through `dispatch(action)` which the footer's
 * apply-target decides: This camera (single endpoint), All or Selected (bulk with
 * a per-camera report).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CameraUIState } from '../../../types/ws'
import { useCamerasStore, selectCameraList } from '../../../stores/cameras'
import { post, patch, del, bulk, type BulkResult } from '../../../lib/api'
import { Icon } from '../../../components/Icon'
import type { ApplyAction, ApplyTarget, TabApi } from './types'
import { ExposureTab } from './ExposureTab'
import { RecordingTab } from './RecordingTab'
import { LookTab } from './LookTab'
import { AudioTab } from './AudioTab'
import { DeviceTab } from './DeviceTab'
import { AllPropsTab } from './AllPropsTab'
import styles from './CameraSettingsModal.module.css'

type TabId = 'exp' | 'rec' | 'look' | 'audio' | 'device' | 'all'
const TABS: { id: TabId; label: string; apply: string }[] = [
  { id: 'exp', label: 'Exposure', apply: 'exposure' },
  { id: 'rec', label: 'Recording', apply: 'recording' },
  { id: 'look', label: 'Look & Color', apply: 'look' },
  { id: 'audio', label: 'Audio', apply: 'audio' },
  { id: 'device', label: 'Device', apply: 'device' },
  { id: 'all', label: 'All properties', apply: 'properties' },
]

interface Props {
  cam: CameraUIState | null
  onClose: () => void
}

interface ReportRow { id: string; name: string; ok: boolean; error?: string }

export function CameraSettingsModal({ cam, onClose }: Props) {
  const cameras = useCamerasStore(selectCameraList)
  const [tab, setTab] = useState<TabId>('exp')
  const [target, setTarget] = useState<ApplyTarget>('one')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [report, setReport] = useState<ReportRow[] | null>(null)

  const tabApiRef = useRef<TabApi | null>(null)
  const targetRef = useRef<ApplyTarget>('one')
  const overrideRef = useRef<ApplyTarget | null>(null)
  const checkedRef = useRef<Set<string>>(checked)
  const pendingRef = useRef<Array<Promise<{ label: string; results: BulkResult[] } | null>> | null>(null)
  targetRef.current = target
  checkedRef.current = checked

  // Reset when the camera changes / modal reopens.
  useEffect(() => {
    if (cam) { setTab('exp'); setReport(null); setTarget('one'); setChecked(new Set(cameras.map((c) => c.id))) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam?.id])

  // Esc closes.
  useEffect(() => {
    if (!cam) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [cam, onClose])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of cameras) m.set(c.id, c.name)
    return m
  }, [cameras])

  if (!cam) return null

  // ── Single per-camera call for an action ─────────────────────────────────────
  function runSingle(action: ApplyAction): Promise<null> {
    const { path, method = 'POST', body } = action.single
    const p = method === 'PATCH' ? patch(path, body ?? {})
      : method === 'DELETE' ? del(path)
      : post(path, body)
    return p.then(() => null).catch((e) => { console.error('[settings] single failed', path, e); return null })
  }

  // ── Route one action by the effective target ─────────────────────────────────
  function dispatch(action: ApplyAction): void {
    const eff = overrideRef.current ?? targetRef.current
    if (eff === 'one' || !action.bulk) {
      const p = runSingle(action)
      pendingRef.current?.push(p.then(() => null))
      return
    }
    const ids = eff === 'all' ? 'all' : Array.from(checkedRef.current)
    const { op, params, label } = action.bulk
    const p = bulk(op, params, ids as string[] | 'all').then((res) => (res ? { label, results: res.results } : null))
    if (pendingRef.current) pendingRef.current.push(p)
    else void p // live control click (not an Apply burst) — fire and forget
  }

  function register(api: TabApi | null): void { tabApiRef.current = api }

  // ── Footer Apply / Apply-to-all: capture the burst → aggregate report ────────
  async function commit(forceTarget?: ApplyTarget): Promise<void> {
    if (!tabApiRef.current) return
    const eff = forceTarget ?? target
    overrideRef.current = eff
    pendingRef.current = []
    tabApiRef.current.apply(eff)
    const settled = await Promise.all(pendingRef.current)
    pendingRef.current = null
    overrideRef.current = null

    if (eff === 'one') { setReport([{ id: cam!.id, name: cam!.name, ok: true }]); return }
    // Merge bulk results by camera.
    const merged = new Map<string, ReportRow>()
    for (const batch of settled) {
      if (!batch) continue
      for (const r of batch.results) {
        const prev = merged.get(r.id)
        if (!prev) merged.set(r.id, { id: r.id, name: nameById.get(r.id) ?? r.id, ok: r.ok, error: r.ok ? undefined : `${batch.label}: ${r.error}` })
        else if (prev.ok && !r.ok) merged.set(r.id, { ...prev, ok: false, error: `${batch.label}: ${r.error}` })
      }
    }
    setReport(Array.from(merged.values()))
  }

  const toggleChip = (id: string) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const activeTab = TABS.find((t) => t.id === tab)!
  const tabProps = { cam, dispatch, register }
  const okCount = report?.filter((r) => r.ok).length ?? 0

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        {/* Header */}
        <div className={styles.mhead}>
          <div>
            <div className={styles.mt}>{cam.name} — Settings</div>
            <div className={styles.ms}>{[cam.model, cam.ip].filter(Boolean).join(' · ')}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close"><Icon name="x" /></button>
        </div>

        {/* Preset line (stubs — presets are a later wiring) */}
        <div className={styles.presetline}>
          <span className={styles.pl}>Preset</span>
          <span className={styles.cur}>—</span>
          <span className={styles.presetSp}>
            <button type="button" className={styles.afbtn} disabled><Icon name="applyAll" size={12} />Load</button>
            <button type="button" className={styles.afbtn} disabled><Icon name="save" size={12} />Save as preset</button>
          </span>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${tab === t.id ? styles.sel : ''}`} onClick={() => { setTab(t.id); setReport(null) }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.mbody}>
          {tab === 'exp' && <ExposureTab {...tabProps} />}
          {tab === 'rec' && <RecordingTab {...tabProps} />}
          {tab === 'look' && <LookTab {...tabProps} />}
          {tab === 'audio' && <AudioTab {...tabProps} />}
          {tab === 'device' && <DeviceTab {...tabProps} onClose={onClose} />}
          {tab === 'all' && <AllPropsTab {...tabProps} />}
        </div>

        {/* Footer */}
        <div className={styles.mfoot}>
          <div className={styles.targets}>
            <span className={styles.tglbl}>Apply to</span>
            <span className={styles.seg}>
              {(['one', 'all', 'sel'] as ApplyTarget[]).map((t) => (
                <button key={t} type="button" className={target === t ? styles.sel : ''} onClick={() => { setTarget(t); setReport(null) }}>
                  {t === 'one' ? 'This camera' : t === 'all' ? 'All' : 'Selected'}
                </button>
              ))}
            </span>
            {target === 'sel' && (
              <span className={styles.picklist}>
                {cameras.map((c) => (
                  <span key={c.id} className={`${styles.chip} ${checked.has(c.id) ? styles.on : ''}`} onClick={() => toggleChip(c.id)}>
                    <span className={styles.chipBox}>{checked.has(c.id) && <Icon name="check" size={11} />}</span>
                    {c.name}
                  </span>
                ))}
              </span>
            )}
          </div>

          {report && (
            <div className={styles.report}>
              <div className={styles.reportHead}>
                <span className={styles.reportHeadOk}><Icon name="check" size={12} /></span>
                Applied to {okCount} of {report.length}{target !== 'one' ? (target === 'all' ? ' cameras' : ' selected') : ''}
              </div>
              <ul className={styles.reportList}>
                {report.map((r) => (
                  <li key={r.id} className={styles.reportItem}>
                    <span className={styles.nm}>{r.name}</span>
                    {r.ok ? <span className={styles.yes}><Icon name="check" size={12} /></span> : <span className={styles.why}>{r.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.factions}>
            <button type="button" className={styles.afbtn} onClick={onClose}>Cancel</button>
            <button type="button" className={`${styles.afbtn} ${styles.prim}`} onClick={() => commit()} style={{ marginLeft: 'auto' }}>
              Apply {activeTab.apply}
            </button>
            <button type="button" className={styles.afbtn} onClick={() => commit('all')}>
              <Icon name="applyAll" size={13} />Apply to all
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
