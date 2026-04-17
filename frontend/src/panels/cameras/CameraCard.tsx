/**
 * CameraCard — per-camera state card.
 *
 * Sections:
 *  - Card head: name / model / IP / connection dot / action buttons
 *  - Inline edit form (name, IP)
 *  - Battery row + rec timer
 *  - Params grid: ISO / Shutter / Iris (with ± step)
 *  - Focus row: Color Temp (with ± step) + PUSH AF button
 *  - ATEM section: control toggle + input number
 *  - Card bottom: REC toggle + delete button
 *  - Offline overlay (shown when disconnected)
 */
import { useEffect, useRef, useState } from 'react'
import type { CameraUIState } from '../../types/ws'
import { OfflineOverlay } from './OfflineOverlay'
import { RuntimeBadges } from './RuntimeBadges'
import styles from './CameraCard.module.css'

interface Props {
  cam: CameraUIState
  /** Called when the gear/debug button is clicked. F4 wires up the actual modal. */
  onDebug?: (id: string) => void
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function api(path: string, opts?: RequestInit): Promise<void> {
  try {
    const res = await fetch(path, opts)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error(`[CameraCard] ${opts?.method ?? 'GET'} ${path} → ${res.status}`, body)
    }
  } catch (e) {
    console.error(`[CameraCard] fetch error ${path}`, e)
  }
}

function post(path: string, body?: object): Promise<void> {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function patch(path: string, body: object): Promise<void> {
  return api(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function del(path: string): Promise<void> {
  return api(path, { method: 'DELETE' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CameraCard({ cam, onDebug }: Props) {
  const { id, connected, recState, tally, battery, charging, alerts } = cam
  const rec = recState === 1

  // ── Edit form state ──────────────────────────────────────────────────────
  const [editOpen,  setEditOpen]  = useState(false)
  const [editName,  setEditName]  = useState(cam.name)
  const [editIp,    setEditIp]    = useState(cam.ip)

  // Keep edit fields in sync with incoming WS data when not open
  useEffect(() => {
    if (!editOpen) {
      setEditName(cam.name)
      setEditIp(cam.ip)
    }
  }, [cam.name, cam.ip, editOpen])

  // ── ATEM input local state (allows typing without immediate PATCH) ────────
  const [atemInputVal, setAtemInputVal] = useState(String(cam.atemInput ?? 1))
  useEffect(() => {
    setAtemInputVal(String(cam.atemInput ?? 1))
  }, [cam.atemInput])

  // ── Recording elapsed timer ───────────────────────────────────────────────
  const recStartRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState('0:00')

  useEffect(() => {
    if (rec) {
      if (recStartRef.current === null) recStartRef.current = Date.now()
      const intervalId = setInterval(() => {
        const secs = Math.floor((Date.now() - recStartRef.current!) / 1000)
        const m = Math.floor(secs / 60)
        const s = String(secs % 60).padStart(2, '0')
        setElapsed(`${m}:${s}`)
      }, 1000)
      return () => clearInterval(intervalId)
    } else {
      recStartRef.current = null
      setElapsed('0:00')
    }
  }, [rec])

  // ── Action handlers ───────────────────────────────────────────────────────

  function adjust(param: string, delta: 1 | -1) {
    post(`/api/cameras/${id}/adjust`, { param, delta })
  }

  function stepColorTemp(direction: 1 | -1) {
    post(`/api/cameras/${id}/color-temp`, { direction })
  }

  function triggerAF() {
    post(`/api/cameras/${id}/af`)
  }

  function toggleRec() {
    post(`/api/cameras/${id}/record`)
  }

  function reconnect() {
    post(`/api/cameras/${id}/connect`)
  }

  function saveEdit() {
    const name = editName.trim()
    const ip   = editIp.trim()
    if (!name || !ip) return
    patch(`/api/cameras/${id}`, { name, ip })
    setEditOpen(false)
  }

  function deleteCamera() {
    if (!confirm(`Remove camera "${cam.name}"?`)) return
    del(`/api/cameras/${id}`)
  }

  function patchToggle(atemControlEnabled: boolean) {
    patch(`/api/cameras/${id}`, { atemControlEnabled })
  }

  function commitAtemInput() {
    const n = parseInt(atemInputVal, 10)
    if (!isNaN(n) && n >= 1 && n <= 20) {
      patch(`/api/cameras/${id}`, { atemInput: n })
    } else {
      setAtemInputVal(String(cam.atemInput ?? 1))
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const bat    = battery ?? 0
  const lowBat = (alerts?.lowBattery || alerts?.criticalBattery) ?? bat < 20

  const remainSec = cam.recRemainSec ?? 0
  const remainMin = Math.floor(remainSec / 60)
  const remainS   = String(remainSec % 60).padStart(2, '0')
  const remainStr = remainSec > 0 ? `${remainMin}:${remainS} left` : ''

  // ── CSS class composition ──────────────────────────────────────────────────
  const cardClass = [
    styles.card,
    rec                  ? styles.recording : '',
    !connected           ? styles.offline   : '',
    tally === 1          ? styles.tallyPgm  : '',
    tally === 2          ? styles.tallyPvw  : '',
  ].filter(Boolean).join(' ')

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cardClass}>
      {/* Offline overlay — sits below z-index:11 of card head */}
      {!connected && <OfflineOverlay />}

      {/* ── Head ── */}
      <div className={styles.head}>
        <div className={styles.meta}>
          <div className={styles.name}>{cam.name}</div>
          {cam.model && <div className={styles.model}>{cam.model}</div>}
          <RuntimeBadges runtimeInfo={cam.runtimeInfo} capabilities={cam.capabilities} />
          <div className={styles.ip}>{cam.ip}</div>
        </div>

        <div className={styles.headActions}>
          <div className={`${styles.connDot} ${connected ? styles.connDotOn : ''}`} title={connected ? 'Connected' : 'Disconnected'} />
          <button
            className={styles.btnIcon}
            onClick={() => onDebug?.(id)}
            title="Debug info"
          >⚙</button>
          <button
            className={styles.btnIcon}
            onClick={() => { setEditOpen((v) => !v); setEditName(cam.name); setEditIp(cam.ip) }}
            title="Edit"
          >✎</button>
          <button
            className={styles.btnIcon}
            onClick={reconnect}
            title="Reconnect"
            disabled={connected}
          >↻</button>
        </div>
      </div>

      {/* ── Inline edit form ── */}
      {editOpen && (
        <div className={styles.editForm}>
          <div className={styles.editField}>
            <span className={styles.editLabel}>Name</span>
            <input
              className={styles.editInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className={styles.editField}>
            <span className={styles.editLabel}>IP Address</span>
            <input
              className={styles.editInput}
              value={editIp}
              onChange={(e) => setEditIp(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className={styles.editActions}>
            <button className={styles.btnEditCancel} onClick={() => setEditOpen(false)}>Cancel</button>
            <button className={styles.btnEditSave}   onClick={saveEdit}>Save</button>
          </div>
        </div>
      )}

      {/* ── Battery + rec timer ── */}
      <div className={styles.batRow}>
        <div className={styles.batBody} title={`Battery ${bat}%`}>
          <div
            className={`${styles.batLevel} ${lowBat ? styles.batLow : ''}`}
            style={{ width: `${Math.min(100, bat)}%` }}
          />
        </div>
        <span className={styles.batPct}>{bat}%</span>
        {charging && (
          <span className={styles.batPower} title="AC power">⚡</span>
        )}

        {rec && (
          <div className={styles.recTimer}>
            <span className={styles.recElapsed}>⏺ {elapsed}</span>
            {remainStr && <span className={styles.recRemain}>{remainStr}</span>}
          </div>
        )}
      </div>

      {/* ── Params grid: ISO / Shutter / Iris ── */}
      <div className={styles.params}>
        <ParamPill
          label="ISO"
          value={cam.derived?.isoDisplay || cam.iso || '—'}
          onMinus={() => adjust('iso', -1)}
          onPlus={() => adjust('iso', 1)}
        />
        <ParamPill
          label="Shutter"
          value={cam.derived?.shutterDisplay || cam.shutter || '—'}
          onMinus={() => adjust('shutter', -1)}
          onPlus={() => adjust('shutter', 1)}
        />
        <ParamPill
          label="Iris"
          value={cam.fnumber ? `f/${cam.fnumber}` : '—'}
          onMinus={() => adjust('fnumber', -1)}
          onPlus={() => adjust('fnumber', 1)}
        />
      </div>

      {/* ── Focus row: Color Temp + AF button ── */}
      <div className={styles.focusRow}>
        <ParamPill
          label="Color Temp"
          value={cam.derived?.colorTempDisplay || '—'}
          onMinus={() => stepColorTemp(-1)}
          onPlus={() => stepColorTemp(1)}
          flex
        />
        <button className={styles.afBtn} onClick={triggerAF}>PUSH AF</button>
      </div>

      {/* ── ATEM section ── */}
      <div className={styles.atemSection}>
        <div className={styles.atemRow}>
          <span className={styles.atemRowLabel}>ATEM Control</span>
          <label className={styles.toggleWrap}>
            <input
              type="checkbox"
              checked={cam.atemControlEnabled}
              onChange={(e) => patchToggle(e.target.checked)}
            />
            <span className={styles.toggleTrack} />
          </label>
        </div>
        <div className={styles.atemRow}>
          <span className={styles.atemRowLabel}>ATEM Input</span>
          <input
            type="number"
            className={styles.atemIdInput}
            min={1}
            max={20}
            value={atemInputVal}
            onChange={(e) => setAtemInputVal(e.target.value)}
            onBlur={commitAtemInput}
          />
        </div>
      </div>

      {/* ── Card bottom: REC + delete ── */}
      <div className={styles.cardBottom}>
        <button
          className={`${styles.btnRec} ${rec ? styles.btnRecActive : ''}`}
          onClick={toggleRec}
        >
          {rec ? '⏹ STOP' : '● REC'}
        </button>
        <button className={styles.btnDel} onClick={deleteCamera} title="Remove camera">✕</button>
      </div>
    </div>
  )
}

// ── ParamPill sub-component ───────────────────────────────────────────────────

interface PillProps {
  label: string
  value: string | number
  onMinus: () => void
  onPlus: () => void
  flex?: boolean
}

function ParamPill({ label, value, onMinus, onPlus, flex }: PillProps) {
  return (
    <div className={`${styles.pill} ${flex ? styles.pillFlex : ''}`}>
      <span className={styles.pillLabel}>{label}</span>
      <div className={styles.pillControls}>
        <button className={styles.adjBtn} onClick={onMinus}>‹</button>
        <span className={styles.pillValue}>{value}</span>
        <button className={styles.adjBtn} onClick={onPlus}>›</button>
      </div>
    </div>
  )
}
