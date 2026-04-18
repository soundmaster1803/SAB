/**
 * CameraCard — per-camera state card.
 * Layout matches SAB Figma design (node 21:231).
 */
import { useEffect, useState } from 'react'
import type { CameraUIState } from '../../types/ws'
import { useAtemStore } from '../../stores/atem'
import { OfflineOverlay } from './OfflineOverlay'
import styles from './CameraCard.module.css'

import iconDebug     from '../../assets/icons/icon-debug.png'
import iconEdit      from '../../assets/icons/icon-edit.png'
import iconReconnect from '../../assets/icons/icon-reconnect.png'
import iconTrash     from '../../assets/icons/icon-trash.png'
import iconBattery   from '../../assets/icons/icon-battery.png'
import focusCloseup  from '../../assets/icons/focus-closeup.png'
import focusMountain from '../../assets/icons/focus-mountain.png'

interface Props {
  cam: CameraUIState
  onDebug?: (id: string) => void
  usedAtemIds?: number[]
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

// ── ModeToggle — single-button sliding pill ───────────────────────────────────

interface ModeToggleProps {
  isAuto: boolean
  onManual: () => void
  onAuto: () => void
  disabled?: boolean
}

function ModeToggle({ isAuto, onManual, onAuto, disabled }: ModeToggleProps) {
  return (
    <button
      className={`${styles.modeToggle} ${isAuto ? styles.modeToggleAuto : ''}`}
      onClick={() => (isAuto ? onManual() : onAuto())}
      disabled={disabled}
      title={isAuto ? 'Auto — tap for Manual' : 'Manual — tap for Auto'}
    >
      <div className={styles.modePill} />
      <span className={styles.modeLabel}>M</span>
      <span className={styles.modeLabel}>A</span>
    </button>
  )
}

// ── ParamControls — UP / value / DOWN column ──────────────────────────────────

interface ParamControlsProps {
  value: string
  onUp: () => void
  onDown: () => void
  disabled?: boolean
}

function ParamControls({ value, onUp, onDown, disabled }: ParamControlsProps) {
  return (
    <div className={styles.paramControls}>
      <button className={styles.arrowBtn} onClick={onUp} disabled={disabled}>▲</button>
      <span className={styles.paramValue}>{value}</span>
      <button className={styles.arrowBtn} onClick={onDown} disabled={disabled}>▼</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CameraCard({ cam, onDebug, usedAtemIds = [] }: Props) {
  const { id, connected, tally, battery, alerts, recState } = cam
  const atemTopology = useAtemStore((s) => s.topology)
  const atemConnected = useAtemStore((s) => s.connected)
  const off = !connected

  // ── Edit form ─────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(cam.name)
  const [editIp,   setEditIp]   = useState(cam.ip)

  useEffect(() => {
    if (!editOpen) { setEditName(cam.name); setEditIp(cam.ip) }
  }, [cam.name, cam.ip, editOpen])

  // ── Shutter manual entry ──────────────────────────────────────────────────
  const [shutterEdit, setShutterEdit] = useState(false)
  const [shutterInput, setShutterInput] = useState('')

  // ── Focus ─────────────────────────────────────────────────────────────────
  // Local optimistic state — updates immediately on toggle, syncs from camera when polled.
  const [localFocusMode, setLocalFocusMode] = useState(cam.raw?.focusMode ?? 0)
  const [focusPos, setFocusPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  // Sync focus mode from camera when a real value arrives (non-zero = camera reported it).
  useEffect(() => {
    const camMode = cam.raw?.focusMode ?? 0
    if (camMode !== 0) setLocalFocusMode(camMode)
  }, [cam.raw?.focusMode])

  // Sync slider position from camera's actual lens position (0xE043, PTP3).
  // Only sync when user is not actively dragging — don't fight the user's input.
  useEffect(() => {
    if (isDragging) return
    const rawPos = cam.raw?.focusPosition ?? 0
    if (rawPos > 0) {
      setFocusPos(Math.round((rawPos / 0xFFFF) * 100))
    }
  }, [cam.raw?.focusPosition, isDragging])

  // MF (0x0001) and DMF (0x8006) are the manual modes where position control is valid.
  const focusIsManual = localFocusMode === 0x0001 || localFocusMode === 0x8006

  // ── ATEM input ────────────────────────────────────────────────────────────
  const [atemInputVal, setAtemInputVal] = useState(String(cam.atemInput ?? 0))
  useEffect(() => { setAtemInputVal(String(cam.atemInput ?? 0)) }, [cam.atemInput])

  // ── Derived ───────────────────────────────────────────────────────────────
  const isoIsAuto  = cam.iso === 'AUTO'
  const irisIsAuto = !cam.fnumber || cam.fnumber === '—'
  const bat        = battery ?? 0
  const lowBat     = alerts?.lowBattery || alerts?.criticalBattery
  const psLabel    = cam.powerSource === 1 ? 'DC' : cam.powerSource === 3 ? 'PoE' : null
  const batMins    = cam.batteryMinutes > 0 ? cam.batteryMinutes : null
  const atemNone   = atemInputVal === '0'

  // ── Handlers ─────────────────────────────────────────────────────────────
  function adjust(param: string, delta: 1 | -1) {
    post(`/api/cameras/${id}/adjust`, { param, delta })
  }
  function stepColorTemp(dir: 1 | -1) {
    post(`/api/cameras/${id}/color-temp`, { direction: dir })
  }
  function setMode(param: string, mode: 'auto' | 'manual') {
    post(`/api/cameras/${id}/mode`, { param, mode })
  }
  function commitShutter() {
    const v = shutterInput.trim()
    if (!v) return
    post(`/api/cameras/${id}/shutter-set`, { value: v })
    setShutterInput('')
    setShutterEdit(false)
  }
  function commitFocus(pos: number) {
    post(`/api/cameras/${id}/focus-position`, { position: pos })
  }
  function toggleFocusMode() {
    if (focusIsManual) {
      // Manual → Auto (AF-C)
      setLocalFocusMode(0x8004)
      post(`/api/cameras/${id}/focus-mode`, { mode: 'AF-C' })
    } else {
      // Auto → Manual (MF)
      setLocalFocusMode(0x0001)
      post(`/api/cameras/${id}/focus-mode`, { mode: 'MF' })
    }
  }
  function triggerAF()   { post(`/api/cameras/${id}/af`) }
  function toggleRec()   { post(`/api/cameras/${id}/record`) }
  function reconnect()   { post(`/api/cameras/${id}/connect`) }

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
  function patchAtemToggle(v: boolean) {
    patch(`/api/cameras/${id}`, { atemControlEnabled: v })
  }
  function handleAtemSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setAtemInputVal(val)
    const n = parseInt(val, 10)
    if (n === 0) {
      patch(`/api/cameras/${id}`, { atemInput: 0, atemControlEnabled: false })
    } else {
      patch(`/api/cameras/${id}`, { atemInput: n })
    }
  }

  const cardCls = [
    styles.card,
    tally === 1 ? styles.tallyPgm : '',
    tally === 2 ? styles.tallyPvw : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardCls}>
      {off && <OfflineOverlay />}

      {/* ── Head ── */}
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.name}>{cam.name}</div>
          {cam.model && <div className={styles.model}>{cam.model}</div>}
          <div className={styles.ipRow}>
            <span className={styles.ip}>{cam.ip}</span>
            <div className={`${styles.connDot} ${connected ? styles.connDotOn : ''}`} />
          </div>
          <div className={styles.batRow}>
            <img src={iconBattery} className={styles.batIcon} alt="" />
            <span className={`${styles.batPct} ${lowBat ? styles.batPctLow : ''}`}>{bat}%</span>
            {cam.charging && <span className={styles.batCharging}>⚡︎</span>}
            {psLabel && <span className={styles.batSource}>{psLabel}</span>}
            {!cam.charging && batMins !== null && (
              <span className={styles.batMins}>{batMins}m</span>
            )}
          </div>
        </div>

        <div className={styles.headRight}>
          <button className={styles.btnIcon} onClick={() => onDebug?.(id)} title="Debug">
            <img src={iconDebug} className={styles.btnIconImg} alt="debug" />
          </button>
          <button
            className={styles.btnIcon}
            onClick={() => { setEditOpen((v) => !v); setEditName(cam.name); setEditIp(cam.ip) }}
            title="Edit"
          >
            <img src={iconEdit} className={styles.btnIconImg} alt="edit" />
          </button>
          <button className={styles.btnIcon} onClick={reconnect} disabled={connected} title="Reconnect">
            <img src={iconReconnect} className={styles.btnIconImg} alt="reconnect" />
          </button>
          <button className={styles.btnIcon} onClick={deleteCamera} title="Remove">
            <img src={iconTrash} className={styles.btnIconImg} alt="remove" />
          </button>
        </div>
      </div>

      {/* ── Edit form ── */}
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
            <button className={styles.btnEditSave} onClick={saveEdit}>Save</button>
          </div>
        </div>
      )}

      {/* ── Row 1: ISO | SHUTTER | IRIS ── */}
      <div className={styles.paramGrid}>

        {/* ISO */}
        <div className={styles.paramModule}>
          <span className={styles.paramLabel}>ISO</span>
          <div className={styles.paramBox}>
            <ModeToggle
              isAuto={isoIsAuto}
              onManual={() => setMode('iso', 'manual')}
              onAuto={() => setMode('iso', 'auto')}
              disabled={off}
            />
            <ParamControls
              value={cam.derived?.isoDisplay || cam.iso || '—'}
              onUp={() => adjust('iso', 1)}
              onDown={() => adjust('iso', -1)}
              disabled={off || isoIsAuto}
            />
          </div>
        </div>

        {/* SHUTTER */}
        <div className={styles.paramModule}>
          <span className={styles.paramLabel}>SHUTTER</span>
          <div className={styles.paramBox}>
            <div className={styles.shutterLeft}>
              <ModeToggle
                isAuto={false}
                onManual={() => setMode('shutter', 'manual')}
                onAuto={() => setMode('shutter', 'auto')}
                disabled={off}
              />
              <button
                className={styles.setBtn}
                onClick={() => setShutterEdit((v) => !v)}
                disabled={off}
              >SET</button>
            </div>
            <ParamControls
              value={cam.derived?.shutterDisplay || cam.shutter || '—'}
              onUp={() => adjust('shutter', 1)}
              onDown={() => adjust('shutter', -1)}
              disabled={off}
            />
          </div>
        </div>

        {/* IRIS */}
        <div className={styles.paramModule}>
          <span className={styles.paramLabel}>IRIS</span>
          <div className={styles.paramBox}>
            <ModeToggle
              isAuto={irisIsAuto}
              onManual={() => setMode('iris', 'manual')}
              onAuto={() => setMode('iris', 'auto')}
              disabled={off}
            />
            <ParamControls
              value={cam.fnumber ? `f ${cam.fnumber}` : '—'}
              onUp={() => adjust('fnumber', 1)}
              onDown={() => adjust('fnumber', -1)}
              disabled={off || irisIsAuto}
            />
          </div>
        </div>
      </div>

      {/* ── Shutter manual input (expands below row1 when SET clicked) ── */}
      {shutterEdit && (
        <div className={styles.shutterEditPanel}>
          <span className={styles.shutterEditLabel}>SHUTTER</span>
          <input
            className={styles.shutterEditInput}
            value={shutterInput}
            onChange={(e) => setShutterInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitShutter()}
            placeholder={cam.derived?.shutterDisplay || cam.shutter || '1/100'}
            autoFocus
            disabled={off}
          />
          <button
            className={styles.shutterEditCommit}
            onClick={commitShutter}
            disabled={off || !shutterInput.trim()}
          >SET</button>
          <button className={styles.shutterEditClose} onClick={() => setShutterEdit(false)}>✕</button>
        </div>
      )}

      {/* ── Row 2: WB | FOCUS ── */}
      <div className={`${styles.paramGrid} ${styles.paramGridLast}`}>

        {/* WB */}
        <div className={styles.paramModule}>
          <span className={styles.paramLabel}>WB</span>
          <div className={styles.paramBox}>
            <ModeToggle
              isAuto={false}
              onManual={() => setMode('wb', 'manual')}
              onAuto={() => setMode('wb', 'auto')}
              disabled={off}
            />
            <ParamControls
              value={cam.derived?.colorTempDisplay || '—'}
              onUp={() => stepColorTemp(1)}
              onDown={() => stepColorTemp(-1)}
              disabled={off}
            />
          </div>
        </div>

        {/* FOCUS — spans 2 columns */}
        <div className={`${styles.paramModule} ${styles.focusModule}`}>
          <div className={styles.focusLabelRow}>
            <span className={styles.paramLabel}>FOCUS</span>
            {cam.derived?.afStatusDisplay && cam.derived.afStatusDisplay !== '—' && (
              <span className={`${styles.afStatus} ${styles[`afStatus_${cam.derived.afStatusDisplay.toLowerCase()}`] ?? ''}`}>
                {cam.derived.afStatusDisplay}
              </span>
            )}
          </div>
          <div className={`${styles.paramBox} ${styles.focusBox}`}>
            <ModeToggle
              isAuto={!focusIsManual}
              onManual={toggleFocusMode}
              onAuto={toggleFocusMode}
              disabled={off}
            />
            <div className={styles.focusTrack}>
              <img src={focusCloseup} className={styles.focusEndIcon} alt="near" />
              <input
                type="range"
                min={0}
                max={100}
                value={focusPos}
                className={styles.focusSlider}
                style={{ '--fp': `${focusPos}%` } as React.CSSProperties}
                onChange={(e) => setFocusPos(+e.target.value)}
                onMouseDown={() => setIsDragging(true)}
                onTouchStart={() => setIsDragging(true)}
                onMouseUp={() => { setIsDragging(false); commitFocus(focusPos) }}
                onTouchEnd={() => { setIsDragging(false); commitFocus(focusPos) }}
                disabled={off || !focusIsManual}
              />
              <img src={focusMountain} className={styles.focusEndIcon} alt="far" />
            </div>
            <div className={styles.focusBottom}>
              {cam.derived?.focalDistanceDisplay && cam.derived.focalDistanceDisplay !== '—' && (
                <span className={styles.focalDist}>{cam.derived.focalDistanceDisplay}</span>
              )}
              <button className={styles.afBtn} onClick={triggerAF} disabled={off}>
                AF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: ATEM CONTROL | REC ── */}
      <div className={styles.bottomGrid}>

        {/* ATEM CONTROL */}
        <div className={styles.bottomModule}>
          <span className={styles.bottomLabel}>ATEM</span>
          <div className={styles.bottomBox}>
            <div className={styles.atemRow}>
              <span className={styles.atemRowLabel}>Link</span>
              <label className={`${styles.toggleWrap} ${atemNone ? styles.toggleWrapDisabled : ''}`}>
                <input
                  type="checkbox"
                  checked={cam.atemControlEnabled && !atemNone}
                  onChange={(e) => patchAtemToggle(e.target.checked)}
                  disabled={off || atemNone}
                />
                <span className={styles.toggleTrack} />
              </label>
            </div>
            <div className={styles.atemRow}>
              <span className={styles.atemRowLabel}>Camera</span>
              <div className={styles.atemIdWrap}>
                <select
                  className={styles.atemIdSelect}
                  value={atemInputVal}
                  onChange={handleAtemSelect}
                  disabled={off}
                >
                  <option value="0">None</option>
                  {atemConnected && atemTopology.length > 0
                    ? atemTopology.map((n) => {
                        const taken = usedAtemIds.includes(n)
                        return (
                          <option key={n} value={String(n)} disabled={taken}>
                            {n}{taken ? ' — taken' : ''}
                          </option>
                        )
                      })
                    : null
                  }
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* REC */}
        <div className={styles.bottomModule}>
          <span className={styles.bottomLabel}>REC</span>
          <div className={styles.bottomBox}>
            <div className={styles.recBtns}>
              <button
                className={`${styles.recBtn} ${styles.recBtnRecord}`}
                onClick={toggleRec}
                disabled={off || recState === 1}
              >
                <span className={styles.recDot} />
                REC
              </button>
              <button
                className={`${styles.recBtn} ${styles.recBtnStop}`}
                onClick={toggleRec}
                disabled={off || recState === 0}
              >
                <span className={styles.recSquare} />
                STOP
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
