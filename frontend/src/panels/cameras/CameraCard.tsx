/**
 * CameraCard — per-camera state card.
 * Layout matches SAB Figma design (node 21:231).
 */
import { useEffect, useRef, useState } from 'react'
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

// ── Recording settings option tables ─────────────────────────────────────────

const FILE_FORMAT_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0x03, label: 'AVCHD' },
  { value: 0x04, label: 'MP4' },
  { value: 0x08, label: 'XAVC S 4K' },
  { value: 0x09, label: 'XAVC S HD' },
  { value: 0x0B, label: 'XAVC HS 4K' },
  { value: 0x0C, label: 'XAVC S-L 4K' },
  { value: 0x0D, label: 'XAVC S-L HD' },
  { value: 0x0E, label: 'XAVC S-I 4K' },
  { value: 0x0F, label: 'XAVC S-I HD' },
  { value: 0x13, label: 'XAVC HS HD' },
  { value: 0x14, label: 'XAVC S-I DCI 4K' },
  { value: 0x1B, label: 'XAVC HS-L 422' },
  { value: 0x1C, label: 'XAVC HS-L 420' },
  { value: 0x1D, label: 'XAVC S-L 422' },
  { value: 0x1E, label: 'XAVC S-L 420' },
  { value: 0x1F, label: 'XAVC S-I 422' },
]

const REC_SETTING_OPTIONS: readonly { value: number; label: string }[] = [
  // XAVC S HD / 720p
  { value: 0x0001, label: '60p 50M / XAVC S' },
  { value: 0x0002, label: '30p 50M / XAVC S' },
  { value: 0x0003, label: '24p 50M / XAVC S' },
  { value: 0x0004, label: '50p 50M / XAVC S' },
  { value: 0x0005, label: '25p 50M / XAVC S' },
  { value: 0x0010, label: '120p 50M 720p / XAVC S' },
  { value: 0x0011, label: '100p 50M 720p / XAVC S' },
  { value: 0x0018, label: '60p 25M / XAVC S HD' },
  { value: 0x0019, label: '50p 25M / XAVC S HD' },
  { value: 0x001A, label: '30p 16M / XAVC S HD' },
  { value: 0x001B, label: '25p 16M / XAVC S HD' },
  { value: 0x001C, label: '120p 100M 1080 / XAVC S HD' },
  { value: 0x001D, label: '100p 100M 1080 / XAVC S HD' },
  { value: 0x001E, label: '120p 60M 1080 / XAVC S HD' },
  { value: 0x001F, label: '100p 60M 1080 / XAVC S HD' },
  // XAVC S 4K
  { value: 0x0020, label: '30p 100M / XAVC S 4K' },
  { value: 0x0021, label: '25p 100M / XAVC S 4K' },
  { value: 0x0022, label: '24p 100M / XAVC S 4K' },
  { value: 0x0023, label: '30p 60M / XAVC S 4K' },
  { value: 0x0024, label: '25p 60M / XAVC S 4K' },
  { value: 0x0025, label: '24p 60M / XAVC S 4K' },
  // AVCHD
  { value: 0x0006, label: '60i 24M(FX) / AVCHD' },
  { value: 0x0007, label: '50i 24M(FX) / AVCHD' },
  { value: 0x0008, label: '60i 17M(FH) / AVCHD' },
  { value: 0x0009, label: '50i 17M(FH) / AVCHD' },
  { value: 0x000A, label: '60p 28M(PS) / AVCHD' },
  { value: 0x000B, label: '50p 28M(PS) / AVCHD' },
  { value: 0x000C, label: '24p 24M(FX) / AVCHD' },
  { value: 0x000D, label: '25p 24M(FX) / AVCHD' },
  { value: 0x000E, label: '24p 17M(FH) / AVCHD' },
  { value: 0x000F, label: '25p 17M(FH) / AVCHD' },
  // MP4
  { value: 0x0012, label: '1080 30p 16M / MP4' },
  { value: 0x0013, label: '1080 25p 16M / MP4' },
  { value: 0x0014, label: '720 30p 6M / MP4' },
  { value: 0x0015, label: '720 25p 6M / MP4' },
  { value: 0x0016, label: '1080 60p 28M / MP4' },
  { value: 0x0017, label: '1080 50p 28M / MP4' },
  // High-bitrate / XAVC HS / S-I
  { value: 0x0026, label: '600M 422 10bit' },
  { value: 0x0027, label: '500M 422 10bit' },
  { value: 0x0028, label: '400M 420 10bit' },
  { value: 0x0029, label: '300M 422 10bit' },
  { value: 0x002A, label: '280M 422 10bit' },
  { value: 0x002B, label: '250M 422 10bit' },
  { value: 0x002C, label: '240M 422 10bit' },
  { value: 0x002D, label: '222M 422 10bit' },
  { value: 0x002E, label: '200M 422 10bit' },
  { value: 0x002F, label: '200M 420 10bit' },
  { value: 0x0030, label: '200M 420 8bit' },
  { value: 0x0031, label: '185M 422 10bit' },
  { value: 0x0032, label: '150M 420 10bit' },
  { value: 0x0033, label: '150M 420 8bit' },
  { value: 0x0034, label: '140M 422 10bit' },
  { value: 0x0035, label: '111M 422 10bit' },
  { value: 0x0036, label: '100M 422 10bit' },
  { value: 0x0037, label: '100M 420 10bit' },
  { value: 0x0038, label: '100M 420 8bit' },
  { value: 0x0039, label: '93M 422 10bit' },
  { value: 0x003A, label: '89M 422 10bit' },
  { value: 0x003B, label: '75M 420 10bit' },
  { value: 0x003C, label: '60M 420 8bit' },
  { value: 0x003D, label: '50M 422 10bit' },
  { value: 0x003E, label: '50M 420 10bit' },
  { value: 0x003F, label: '50M 420 8bit' },
  { value: 0x0040, label: '45M 420 10bit' },
  { value: 0x0041, label: '30M 420 10bit' },
  { value: 0x0042, label: '25M 420 8bit' },
  { value: 0x0043, label: '16M 420 8bit' },
  { value: 0x0044, label: '520M 422 10bit' },
  { value: 0x0045, label: '260M 422 10bit' },
]



const FRAME_RATE_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 0x01, label: '23.98p' },
  { value: 0x02, label: '100p' },
  { value: 0x03, label: '59.94p' },
  { value: 0x04, label: '50p' },
  { value: 0x05, label: '24p' },
  { value: 0x06, label: '25p' },
  { value: 0x07, label: '30p' },
  { value: 0x08, label: '60p' },
  { value: 0x09, label: '120p' },
  { value: 0x0A, label: '119.88p' },
]

function labelForSetting(value: number): string {
  return REC_SETTING_OPTIONS.find(o => o.value === value)?.label
    ?? `0x${value.toString(16).toUpperCase().padStart(4, '0')}`
}

function labelForFormat(value: number): string {
  return FILE_FORMAT_OPTIONS.find(o => o.value === value)?.label
    ?? `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
}

function labelForFrameRate(value: number): string {
  return FRAME_RATE_OPTIONS.find(o => o.value === value)?.label
    ?? `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

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
  const [localFocusMode, setLocalFocusMode] = useState(cam.raw?.focusMode ?? 0)
  const [focusPos, setFocusPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const focusInitRef  = useRef(false)   // true after first position sync
  const lastDragRef   = useRef(0)       // ms timestamp of last drag end
  const lastSentRef   = useRef(0)       // ms timestamp of last focus-position send

  // Sync focus mode from camera (non-zero = real value).
  useEffect(() => {
    const camMode = cam.raw?.focusMode ?? 0
    if (camMode !== 0) setLocalFocusMode(camMode)
  }, [cam.raw?.focusMode])

  // Sync slider from camera: once on init, then only after 3s of no drag.
  useEffect(() => {
    if (isDragging) return
    const rawPos = cam.raw?.focusPosition ?? 0
    if (rawPos === 0) return
    if (focusInitRef.current && Date.now() - lastDragRef.current < 3000) return
    setFocusPos(Math.round((rawPos / 0xFFFF) * 100))
    focusInitRef.current = true
  }, [cam.raw?.focusPosition, isDragging])

  // MF (0x0001) and DMF (0x8006) are the manual modes where position control is valid.
  const focusIsManual      = localFocusMode === 0x0001 || localFocusMode === 0x8006
  const focusSliderEnabled = focusIsManual && (cam.capabilities?.hasFocusPosition ?? false)

  // ── ATEM input ────────────────────────────────────────────────────────────
  const [atemInputVal, setAtemInputVal] = useState(String(cam.atemInput ?? 0))
  useEffect(() => { setAtemInputVal(String(cam.atemInput ?? 0)) }, [cam.atemInput])

  // ── Rec settings panel ───────────────────────────────────────────────────
  const [recSettingsOpen, setRecSettingsOpen] = useState(false)
  const [movieFormatSel, setMovieFormatSel]   = useState(cam.raw?.movieFileFormat ?? 0)
  const [recFrameRateSel, setRecFrameRateSel] = useState(cam.raw?.recFrameRate ?? 0)
  const [recSettingSel, setRecSettingSel]     = useState(cam.raw?.recSetting ?? 0)

  useEffect(() => {
    if (!recSettingsOpen) {
      setMovieFormatSel(cam.raw?.movieFileFormat ?? 0)
      setRecFrameRateSel(cam.raw?.recFrameRate ?? 0)
      setRecSettingSel(cam.raw?.recSetting ?? 0)
    }
  }, [cam.raw?.movieFileFormat, cam.raw?.recFrameRate, cam.raw?.recSetting, recSettingsOpen])

  // When format selection changes in the panel, reset mode selection if it's not in the new list
  useEffect(() => {
    if (!recSettingsOpen) return
    const opts = getSettingOpts(movieFormatSel)
    if (recSettingSel !== 0 && !opts.find(o => o.value === recSettingSel)) {
      setRecSettingSel(opts[0]?.value ?? 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieFormatSel])

  // ── Slot selector local state (optimistic — updates immediately, syncs from camera) ─
  const [localRecMedia, setLocalRecMedia] = useState(cam.raw?.recMedia || 1)
  useEffect(() => {
    const v = cam.raw?.recMedia
    if (v && v !== localRecMedia) setLocalRecMedia(v)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.raw?.recMedia])

  // ── Format dialog ────────────────────────────────────────────────────────
  const [formatSlot, setFormatSlot]   = useState<1 | 2>(1)
  const [formatType, setFormatType]   = useState<'full' | 'quick'>('quick')
  const [formatConfirm, setFormatConfirm] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const isoIsAuto  = cam.iso === 'AUTO'
  const irisIsAuto = !cam.fnumber || cam.fnumber === '—'
  const bat        = battery ?? 0
  const lowBat     = alerts?.lowBattery || alerts?.criticalBattery
  const psLabel    = cam.powerSource === 1 ? 'DC' : cam.powerSource === 3 ? 'PoE' : null
  const batMins    = cam.batteryMinutes > 0 ? cam.batteryMinutes : null
  const atemNone   = atemInputVal === '0'

  const slotStatus    = cam.raw?.slotStatus  ?? 0
  const slotStatus2   = cam.raw?.slotStatus2 ?? 0
  const camRemainSec  = cam.recRemainSec ?? 0
  const recRemainSec2 = cam.raw?.recRemainSec2 ?? 0

  // Local elapsed timer — used when camera doesn't report 0xD120 (e.g. ZV-E10M2)
  const [localElapsed, setLocalElapsed] = useState(0)
  const recStartRef = useRef<number | null>(null)
  useEffect(() => {
    if (recState === 1) {
      if (recStartRef.current === null) recStartRef.current = Date.now()
      const t = setInterval(() => {
        setLocalElapsed(Math.floor((Date.now() - recStartRef.current!) / 1000))
      }, 1000)
      return () => clearInterval(t)
    } else {
      recStartRef.current = null
      setLocalElapsed(0)
    }
  }, [recState])

  // Local remaining countdown — counts down 1/sec during recording, resyncs from WS
  const [localRemain, setLocalRemain] = useState(camRemainSec)
  useEffect(() => { setLocalRemain(camRemainSec) }, [camRemainSec])
  useEffect(() => {
    if (recState !== 1 || localRemain <= 0) return
    const t = setInterval(() => setLocalRemain(v => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [recState, localRemain <= 0])

  const camDurSec = cam.raw?.recDurationSec ?? 0
  const recDurSec = camDurSec > 0 ? camDurSec : localElapsed

  // File format options: camera's list → known labels; fall back to full table
  const camFormatList = cam.raw?.movieFileFormatList ?? []
  const fileFormatOpts = camFormatList.length > 0
    ? camFormatList.map(v => ({ value: v, label: labelForFormat(v) }))
    : FILE_FORMAT_OPTIONS

  // Frame rate options: camera's live recFrameRateList → known labels; fall back to full table.
  const camFrameRateList = cam.raw?.recFrameRateList ?? []
  const frameRateOpts = camFrameRateList.length > 0
    ? camFrameRateList.map(v => ({ value: v, label: labelForFrameRate(v) }))
    : FRAME_RATE_OPTIONS as { value: number; label: string }[]

  // Recording setting options: always sourced from camera's live recSettingList.
  // If format differs from camera's current, user must Apply format first to refresh the list.
  const camCurFormat   = cam.raw?.movieFileFormat ?? 0
  const camSettingList = cam.raw?.recSettingList ?? []
  function getSettingOpts(_selectedFormat: number): { value: number; label: string }[] {
    if (camSettingList.length > 0) {
      return camSettingList.map(v => ({ value: v, label: labelForSetting(v) }))
    }
    return REC_SETTING_OPTIONS as { value: number; label: string }[]
  }

  // Slot selector (main REC card)
  const hasTwoSlots    = slotStatus2 !== 0
  const activeRecMedia = localRecMedia

  const activeRemainSec = (() => {
    if (activeRecMedia === 2) return recRemainSec2
    if (activeRecMedia === 0x0101) {
      const vals = [localRemain, recRemainSec2].filter(v => v > 0)
      return vals.length > 0 ? Math.min(...vals) : 0
    }
    return localRemain
  })()

  const activeSlotError = activeRecMedia === 2
    ? (slotStatus2 === 2 || slotStatus2 === 3)
    : (slotStatus === 2 || slotStatus === 3)

  const slot1Label = slotStatus === 2 ? 'Slot 1 — no card'
    : slotStatus === 3 ? 'Slot 1 — error' : 'Slot 1'
  const slot2Label = slotStatus2 === 2 ? 'Slot 2 — no card'
    : slotStatus2 === 3 ? 'Slot 2 — error' : 'Slot 2'

  function activeSlotStatusText(): string {
    if (activeRecMedia === 2) {
      if (slotStatus2 === 2) return 'Insert card in Slot 2'
      if (slotStatus2 === 3) return 'Slot 2 Error'
      if (slotStatus2 === 7) return 'Slot 2 Locked'
      if (recRemainSec2 > 0) return `${formatTime(recRemainSec2)} rem`
      return '—'
    }
    if (activeRecMedia === 0x0101) {
      const s1t = localRemain > 0 ? formatTime(localRemain) : (slotStatus === 2 ? '—' : '?')
      const s2t = recRemainSec2 > 0 ? formatTime(recRemainSec2) : (slotStatus2 === 2 ? '—' : '?')
      return `S1 ${s1t}  S2 ${s2t}`
    }
    if (slotStatus === 2) return 'No Card'
    if (slotStatus === 3) return 'Card Error'
    if (slotStatus === 7) return 'Card Locked'
    if (localRemain > 0) return `${formatTime(localRemain)} rem`
    return '—'
  }

  function handleSlotChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = +e.target.value
    setLocalRecMedia(val)
    post(`/api/cameras/${id}/rec-settings`, { recMedia: val })
  }

  function applyFormat(value: number) {
    setMovieFormatSel(value)
    if (value) post(`/api/cameras/${id}/rec-settings`, { movieFileFormat: value })
  }

  function applyFrameRate(value: number) {
    setRecFrameRateSel(value)
    if (value) post(`/api/cameras/${id}/rec-settings`, { recFrameRate: value })
  }

  function applyRecSetting(value: number) {
    setRecSettingSel(value)
    if (value) post(`/api/cameras/${id}/rec-settings`, { recSetting: value })
  }

  function executeFormat() {
    post(`/api/cameras/${id}/format-media`, { slot: formatSlot, type: formatType })
    setFormatConfirm(false)
  }

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
  function sendFocusPos(pos: number) {
    post(`/api/cameras/${id}/focus-position`, { position: pos })
    lastSentRef.current = Date.now()
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
          {connected && (
            <div className={styles.batRow}>
              <img src={iconBattery} className={styles.batIcon} alt="" />
              <span className={`${styles.batPct} ${lowBat ? styles.batPctLow : ''}`}>{bat}%</span>
              {cam.charging && <span className={styles.batCharging}>⚡︎</span>}
              {psLabel && <span className={styles.batSource}>{psLabel}</span>}
              {!cam.charging && batMins !== null && (
                <span className={styles.batMins}>{batMins}m</span>
              )}
            </div>
          )}
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
          <span className={styles.paramLabel}>FOCUS</span>
          <div className={`${styles.paramBox} ${focusSliderEnabled ? styles.focusBoxMf : ''}`}>
            {/* Always-visible row: toggle left, AF button right */}
            <div className={styles.focusCtrlRow}>
              <ModeToggle
                isAuto={!focusIsManual}
                onManual={toggleFocusMode}
                onAuto={toggleFocusMode}
                disabled={off}
              />
              <button className={styles.afBtn} onClick={triggerAF} disabled={off}>
                AF
              </button>
            </div>

            {/* Slider — only when MF/DMF AND camera supports focus position control */}
            {focusSliderEnabled && (
              <div className={styles.focusSliderRow}>
                <img src={focusCloseup} className={styles.focusEndIcon} alt="near" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={focusPos}
                  className={styles.focusSlider}
                  style={{ '--fp': `${focusPos}%` } as React.CSSProperties}
                  onPointerDown={() => setIsDragging(true)}
                  onChange={(e) => {
                    const val = +e.target.value
                    setFocusPos(val)
                    if (Date.now() - lastSentRef.current >= 100) sendFocusPos(val)
                  }}
                  onPointerUp={(e) => {
                    setIsDragging(false)
                    lastDragRef.current = Date.now()
                    sendFocusPos(+(e.currentTarget as HTMLInputElement).value)
                  }}
                  disabled={off}
                />
                <img src={focusMountain} className={styles.focusEndIcon} alt="far" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Rec settings panel (full-width, above bottom grid) ── */}
      {recSettingsOpen && (
        <div className={styles.recSettingsPanel}>
          {/* Current active settings badge */}
          {(camCurFormat > 0 || (cam.raw?.recFrameRate ?? 0) > 0 || (cam.raw?.recSetting ?? 0) > 0) && (
            <div className={styles.recSettingsCurrent}>
              {camCurFormat > 0 && <span>{labelForFormat(camCurFormat)}</span>}
              {(cam.raw?.recFrameRate ?? 0) > 0 && <span>{labelForFrameRate(cam.raw.recFrameRate)}</span>}
              {(cam.raw?.recSetting ?? 0) > 0 && <span>{labelForSetting(cam.raw.recSetting)}</span>}
            </div>
          )}
          <div className={styles.recSettingsRow}>
            <span className={styles.recSettingsLabel}>Format</span>
            <select
              className={styles.recSettingsSelect}
              value={movieFormatSel}
              onChange={(e) => applyFormat(+e.target.value)}
              disabled={off}
            >
              <option value={0}>— current —</option>
              {fileFormatOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.recSettingsRow}>
            <span className={styles.recSettingsLabel}>FPS</span>
            <select
              className={styles.recSettingsSelect}
              value={recFrameRateSel}
              onChange={(e) => applyFrameRate(+e.target.value)}
              disabled={off}
            >
              <option value={0}>— current —</option>
              {frameRateOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.recSettingsRow}>
            <span className={styles.recSettingsLabel}>Mode</span>
            <select
              className={styles.recSettingsSelect}
              value={recSettingSel}
              onChange={(e) => applyRecSetting(+e.target.value)}
              disabled={off}
            >
              <option value={0}>— current —</option>
              {getSettingOpts(movieFormatSel).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {movieFormatSel !== 0 && movieFormatSel !== camCurFormat && (
            <div className={styles.recSettingsModeHint}>
              Mode list updates after format change is applied by camera.
            </div>
          )}
          <div className={styles.recSettingsActions}>
            <button className={styles.recSettingsApply} onClick={() => setRecSettingsOpen(false)}>Done</button>
          </div>

          {/* ── Format zone ── */}
          <div className={styles.formatZone}>
            <div className={styles.formatZoneRow}>
              <div className={styles.formatSelects}>
                <select
                  className={styles.recSettingsSelect}
                  value={formatSlot}
                  onChange={(e) => setFormatSlot(+e.target.value as 1 | 2)}
                  disabled={off}
                >
                  <option value={1}>Slot 1</option>
                  <option value={2}>Slot 2</option>
                </select>
                <select
                  className={styles.recSettingsSelect}
                  value={formatType}
                  onChange={(e) => setFormatType(e.target.value as 'full' | 'quick')}
                  disabled={off}
                >
                  <option value="quick">Quick</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <button
                className={styles.formatBtn}
                onClick={() => setFormatConfirm(true)}
                disabled={off || recState === 1}
              >Format</button>
            </div>
            {formatConfirm && (
              <div className={styles.formatConfirm}>
                <span className={styles.formatConfirmText}>
                  {formatType === 'full' ? '⚠ Full format' : '⚠ Quick format'} Slot {formatSlot} — all data will be erased!
                </span>
                <div className={styles.formatConfirmBtns}>
                  <button className={styles.recSettingsCancel} onClick={() => setFormatConfirm(false)}>Cancel</button>
                  <button className={styles.formatConfirmGo} onClick={executeFormat} disabled={off}>Erase</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom: ATEM CONTROL | REC ── */}
      <div className={styles.bottomGrid}>

        {/* ATEM CONTROL */}
        <div className={`${styles.bottomModule} ${!atemConnected ? styles.bottomModuleDimmed : ''}`}>
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
            {/* Slot selector + gear */}
            <div className={styles.recTopRow}>
              {hasTwoSlots ? (
                <select
                  className={styles.recSlotSelect}
                  value={activeRecMedia}
                  onChange={handleSlotChange}
                  disabled={off}
                >
                  <option value={1} disabled={slotStatus === 2 || slotStatus === 3}>{slot1Label}</option>
                  <option value={2} disabled={slotStatus2 === 2 || slotStatus2 === 3}>{slot2Label}</option>
                  <option value={0x0101} disabled={slotStatus === 2 || slotStatus2 === 2}>Simultaneous</option>
                </select>
              ) : (
                <span className={styles.recSlotStatic}>Slot 1</span>
              )}
              <button
                className={styles.recGearBtn}
                onClick={() => setRecSettingsOpen((v) => !v)}
                title="Recording settings"
                disabled={off}
              >⚙</button>
            </div>
            <div className={styles.recTimeRow}>
              {recState === 1 ? (
                <>
                  <span className={styles.recElapsed}>● {formatTime(recDurSec)}</span>
                  {activeRemainSec > 0 && (
                    <span className={styles.recRemain}>{formatTime(activeRemainSec)}</span>
                  )}
                </>
              ) : (
                <span className={`${styles.recRemain} ${activeSlotError ? styles.recRemainWarn : ''}`}>
                  {activeSlotStatusText()}
                </span>
              )}
            </div>
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
