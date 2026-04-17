/**
 * DebugModal — full-screen live camera diagnostics overlay.
 *
 * Shows:
 *  - Stats grid: live prop count, knowledge match, SAB actions, poll blob size
 *  - Device/Knowledge panel: firmware, serial, spec match, capability flags
 *  - Runtime state layers: raw / derived / alerts snapshot
 *  - Props table: every live PTP property with control type, SAB wiring,
 *    knowledge flags, enum values / range, and notes
 *
 * Auto-refreshes every 1500ms while open. Scroll positions are preserved
 * between refreshes so the table stays readable while data updates.
 *
 * Opened from CameraCard gear button. App.tsx manages the open camId.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './DebugModal.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────
// These mirror buildSonyDebugPayload() output — not WS message types.

interface EnumOption { value: number; hex: string; label: string; current: boolean }
interface PropRange  { min: number; max: number; step: number }

interface PropEntry {
  code: string
  codeNumber: number
  name: string
  category: string
  dataType: string
  readable: boolean
  writable: boolean
  control: 'step' | 'set' | 'btn' | 'read'
  runtimeControl: string
  pollGroup: string | null
  pollReason: string | null
  current: number
  currentHex: string
  currentDecoded: string
  default: number
  defaultDecoded: string
  enumValues: EnumOption[]
  range: PropRange | null
  uiRelevant: boolean
  alertRelevant: boolean
  capabilityId: string | null
  notes: string[]
  sourceFlags: {
    staticCatalog: boolean
    capabilityCatalog: boolean
    controlSemantics: boolean
    controlCatalog: boolean
    propKnowledgeLayer: boolean
  }
}

interface DebugCoverage {
  livePropCount: number
  matchedKnowledgeProps: number
  actionableProps: number
  specMatched: boolean
  knowledgeModelMatched: boolean
}

interface DebugPayload {
  id: string
  name: string
  ip: string
  connected: boolean
  model: string | null
  manufacturer: string | null
  firmware: string | null
  serial: string | null
  hasPollBlob: boolean
  pollBlobBytes: number
  spec: {
    name: string
    status: string
    ptpVersion?: string
    capabilities?: Record<string, boolean>
  } | null
  modelKnowledge: { file: string } | null
  runtime: {
    raw: Record<string, unknown>
    derived: Record<string, unknown>
    alerts: Record<string, unknown>
  }
  coverage: DebugCoverage
  props: PropEntry[]
}

// ─── Control badge colours ────────────────────────────────────────────────────

const CTRL_BADGE: Record<string, [label: string, bg: string, color: string]> = {
  step: ['STEP', 'rgba(0,122,255,0.15)',   'var(--accent)'],
  set:  ['SET',  'rgba(52,199,89,0.12)',   'var(--green)'],
  btn:  ['BTN',  'rgba(255,149,0,0.12)',   'var(--orange)'],
  read: ['READ', 'rgba(255,255,255,0.05)', 'var(--t3)'],
}

const CAP_LABELS: Record<string, string> = {
  iso: 'ISO', shutterSpeed: 'Shutter', fNumber: 'f-number', exposureComp: 'EV Comp',
  recordingState: 'Recording', movieRecButton: 'Rec Btn', batteryRemain: 'Battery',
  focusMode: 'Focus Mode', mfNearFar: 'MF Near/Far', focusPosition: 'Focus Pos',
  whiteBalance: 'White Bal', colorTemp: 'Color Temp', wbTint: 'WB Tint',
  ndFilter: 'ND Filter', streaming: 'Streaming', tallyLamps: 'Tally',
  hdmiControl: 'HDMI Ctrl', lensInfo: 'Lens Info', panTiltZoom: 'PTZ',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  camId: string | null
  onClose: () => void
}

export function DebugModal({ camId, onClose }: Props) {
  const [data,    setData]    = useState<DebugPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Scroll-position preservation refs
  const bodyRef      = useRef<HTMLDivElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (silent = false) => {
    if (!camId) return
    if (!silent) setLoading(true)

    // Preserve scroll before re-render
    const bodyScroll  = bodyRef.current?.scrollTop ?? 0
    const tableScroll = {
      top:  tableWrapRef.current?.scrollTop  ?? 0,
      left: tableWrapRef.current?.scrollLeft ?? 0,
    }

    try {
      const res = await fetch(`/api/cameras/${encodeURIComponent(camId)}/debug`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload: DebugPayload = await res.json()
      setData(payload)
      setError(null)

      // Restore scroll on next frame
      if (silent) {
        requestAnimationFrame(() => {
          if (bodyRef.current)      bodyRef.current.scrollTop        = bodyScroll
          if (tableWrapRef.current) tableWrapRef.current.scrollTop   = tableScroll.top
          if (tableWrapRef.current) tableWrapRef.current.scrollLeft  = tableScroll.left
        })
      }
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load diagnostics')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [camId])

  // Initial load + auto-refresh
  useEffect(() => {
    if (!camId) { setData(null); setLoading(false); setError(null); return }
    load(false)
    const id = setInterval(() => load(true), 1500)
    return () => clearInterval(id)
  }, [camId, load])

  // Escape key closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!camId) return null

  const title    = data ? `${data.name} Debug` : 'Camera Debug'
  const subtitle = data
    ? `${data.model ?? 'Unknown model'} • ${data.ip} • ${data.connected ? 'online' : 'offline'}`
    : 'Live Sony poll and knowledge view'

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal}>
        {/* ── Head ── */}
        <div className={styles.head}>
          <div className={styles.titleWrap}>
            <div className={styles.title}>{title}</div>
            <div className={styles.subtitle}>{subtitle}</div>
          </div>
          <div className={styles.spacer} />
          <button className={styles.headBtn} onClick={() => load(false)}>Refresh</button>
          <button className={styles.headBtn} onClick={onClose}>Close</button>
        </div>

        {/* ── Body ── */}
        <div className={styles.body} ref={bodyRef}>
          {loading && <div className={styles.loading}>Loading live camera diagnostics…</div>}
          {error   && <div className={styles.loading}>{error}</div>}
          {data && <DebugBody data={data} tableWrapRef={tableWrapRef} />}
        </div>
      </div>
    </div>
  )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

interface BodyProps {
  data: DebugPayload
  tableWrapRef: React.RefObject<HTMLDivElement | null>
}

function DebugBody({ data, tableWrapRef }: BodyProps) {
  const { coverage, runtime } = data
  const raw     = (runtime?.raw     ?? {}) as Record<string, unknown>
  const derived  = (runtime?.derived ?? {}) as Record<string, unknown>
  const alerts  = (runtime?.alerts  ?? {}) as Record<string, unknown>

  return (
    <>
      {/* ── Stats grid ── */}
      <div className={styles.statsGrid}>
        <StatCard label="Live Props"      value={String(coverage.livePropCount)}         note="properties parsed from current Sony poll blob" />
        <StatCard label="Knowledge Match" value={String(coverage.matchedKnowledgeProps)} note="live properties mapped to our knowledge catalogs" />
        <StatCard label="SAB Actions"     value={String(coverage.actionableProps)}        note="live properties already actionable in SAB runtime" />
        <StatCard label="Poll Blob"       value={`${data.pollBlobBytes} B`}               note={data.hasPollBlob ? 'camera is returning live property blobs' : 'no poll blob received yet'} />
      </div>

      {/* ── Two panels ── */}
      <div className={styles.panels}>
        <div className={styles.panelCard}>
          <div className={styles.sectionTitle}>Device / Knowledge</div>
          <div className={styles.kv}>
            <div>Model</div>        <div>{data.model ?? '—'}</div>
            <div>Manufacturer</div> <div>{data.manufacturer ?? '—'}</div>
            <div>Firmware</div>     <div>{data.firmware ?? '—'}</div>
            <div>Serial</div>       <div>{data.serial ?? '—'}</div>
            <div>Spec</div>         <div>{data.spec ? `${data.spec.name} (${data.spec.status})` : <span className={styles.noSpec}>not matched</span>}</div>
            <div>PTP</div>          <div>{data.spec?.ptpVersion ?? '—'}</div>
            <div>Model DB</div>     <div>{data.modelKnowledge?.file ?? 'not matched'}</div>
            <div>Coverage</div>     <div>{coverage.specMatched ? 'spec matched' : 'spec missing'} / {coverage.knowledgeModelMatched ? 'model db matched' : 'model db missing'}</div>
          </div>

          {data.spec?.capabilities && (
            <>
              <div className={styles.sectionTitle} style={{ marginTop: 10 }}>Model Capabilities</div>
              <div className={styles.capsRow}>
                {Object.entries(CAP_LABELS)
                  .filter(([key]) => data.spec!.capabilities![key] !== undefined)
                  .map(([key, label]) => (
                    <span
                      key={key}
                      className={`${styles.capBadge} ${data.spec!.capabilities![key] ? styles.capOn : styles.capOff}`}
                    >
                      {label}
                    </span>
                  ))}
              </div>
            </>
          )}
        </div>

        <div className={styles.panelCard}>
          <div className={styles.sectionTitle}>Runtime State Layers</div>
          <div className={styles.runtimeGrid}>
            <RuntimeChip title="Raw">
              connected={String(raw.connected)}<br />
              iso={String(raw.iso ?? '—')}<br />
              shutter={String(raw.shutter ?? '—')}<br />
              colorTemp={String(raw.colorTemp ?? '—')}<br />
              recState={String(raw.recState ?? '—')}
            </RuntimeChip>
            <RuntimeChip title="Derived">
              iso={String((derived as {isoDisplay?: string}).isoDisplay ?? '—')}<br />
              shutter={String((derived as {shutterDisplay?: string}).shutterDisplay ?? '—')}<br />
              fnumber={String((derived as {fnumberDisplay?: string}).fnumberDisplay ?? '—')}<br />
              ev={String((derived as {expCompDisplay?: string}).expCompDisplay ?? '—')}
            </RuntimeChip>
            <RuntimeChip title="Alerts">
              battery={String((alerts as {batterySeverity?: string}).batterySeverity ?? 'none')}<br />
              record={String((alerts as {recRemaining?: string}).recRemaining ?? 'none')}<br />
              connectionLost={(alerts as {connectionLost?: boolean}).connectionLost ? 'yes' : 'no'}<br />
              criticalBattery={(alerts as {criticalBattery?: boolean}).criticalBattery ? 'yes' : 'no'}
            </RuntimeChip>
          </div>
        </div>
      </div>

      {/* ── Props table ── */}
      {data.props.length === 0 ? (
        <div className={styles.loading}>No live properties parsed yet. Wait for the first Sony poll cycle.</div>
      ) : (
        <>
          <div className={styles.sectionTitle}>Live Camera Properties</div>
          <div className={styles.tableWrap} ref={tableWrapRef}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Current</th>
                  <th>Raw</th>
                  <th>Control</th>
                  <th>SAB</th>
                  <th>Knowledge</th>
                  <th>Options / Range</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.props.map((p) => <PropRow key={p.code} prop={p} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statNote}>{note}</div>
    </div>
  )
}

function RuntimeChip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.runtimeChip}>
      <strong>{title}</strong>
      <span className={styles.mono}>{children}</span>
    </div>
  )
}

function PropRow({ prop: p }: { prop: PropEntry }) {
  const [badge, bg, color] = CTRL_BADGE[p.control] ?? CTRL_BADGE.read!

  const opts = p.enumValues.length > 0
    ? (
      <div className={styles.opts}>
        {p.enumValues.slice(0, 24).map((opt) => (
          <span key={opt.hex} className={`${styles.opt} ${opt.current ? styles.optCurrent : ''}`}>
            {opt.label} <code>{opt.hex}</code>
          </span>
        ))}
        {p.enumValues.length > 24 && (
          <span className={styles.opt}>+{p.enumValues.length - 24} more</span>
        )}
      </div>
    )
    : p.range
      ? <div className={styles.notes}><div>min {p.range.min} / max {p.range.max} / step {p.range.step}</div></div>
      : <span className={`${styles.badge} ${styles.badgeMuted}`}>—</span>

  const notes = [p.pollReason, ...p.notes].filter(Boolean).slice(0, 4)

  return (
    <tr>
      <td>
        <strong style={{ color: 'var(--t1)' }}>{p.name}</strong><br />
        <code>{p.code}</code>{' '}
        <span style={{ color: 'var(--t3)' }}>({p.category})</span><br />
        <span style={{ color: 'rgba(255,255,255,0.28)' }}>dtype {p.dataType}</span>
      </td>
      <td>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{p.currentDecoded}</span><br />
        <span style={{ color: 'var(--t3)' }}>default {p.defaultDecoded}</span>
      </td>
      <td>
        <code>{p.currentHex}</code><br />
        <span style={{ color: 'var(--t3)' }}>raw {p.current}</span>
      </td>
      <td>
        <div className={styles.badges}>
          <span className={styles.badge} style={{ background: bg, color, borderColor: 'transparent' }}>{badge}</span>
          <span className={`${styles.badge} ${p.writable ? styles.badgeWrite : styles.badgeMuted}`}>
            {p.writable ? 'writable' : 'read-only'}
          </span>
        </div>
      </td>
      <td>
        {p.runtimeControl && p.runtimeControl !== 'none'
          ? <span className={`${styles.badge} ${styles.badgeWrite}`}>{p.runtimeControl}</span>
          : <span className={`${styles.badge} ${styles.badgeMuted}`}>none</span>}
      </td>
      <td>
        <div className={styles.badges}>
          {p.sourceFlags.capabilityCatalog && <span className={`${styles.badge} ${styles.badgeLive}`}>capability</span>}
          {p.sourceFlags.controlSemantics  && <span className={`${styles.badge} ${styles.badgeLive}`}>semantics</span>}
          {p.sourceFlags.controlCatalog    && <span className={`${styles.badge} ${styles.badgeLive}`}>control</span>}
          {p.pollGroup && (
            <span className={`${styles.badge} ${p.pollGroup === 'ON_DEMAND' ? styles.badgeWarn : styles.badgeMuted}`}>
              {p.pollGroup}
            </span>
          )}
          {p.uiRelevant     && <span className={`${styles.badge} ${styles.badgeWrite}`}>ui</span>}
          {p.alertRelevant  && <span className={`${styles.badge} ${styles.badgeWarn}`}>alert</span>}
          {!p.sourceFlags.capabilityCatalog && !p.sourceFlags.controlSemantics && !p.sourceFlags.controlCatalog && (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>unmapped</span>
          )}
        </div>
        {p.capabilityId && (
          <div style={{ marginTop: 6, color: 'var(--t3)', fontSize: 10 }}>{p.capabilityId}</div>
        )}
      </td>
      <td>{opts}</td>
      <td>
        <div className={styles.notes}>
          {notes.length > 0 ? notes.map((note, i) => <div key={i}>{note}</div>) : <div>—</div>}
        </div>
      </td>
    </tr>
  )
}
