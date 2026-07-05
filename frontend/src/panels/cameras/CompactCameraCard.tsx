/**
 * CompactCameraCard — layer-1 uniform camera card for the operator console.
 *
 * Every camera renders with the identical layout (header, status bar, ATEM
 * strip, 2×2 quick controls, footer); only the values differ. This is the
 * "glanceable & fast" card from docs/design/camera-ui-redesign.md. Deep settings
 * live in a modal opened via the Settings button (a later layer — here we only
 * call the `onSettings` prop).
 *
 * All control actions are fire-and-forget POSTs; transport / non-2xx errors are
 * logged, never thrown into render.
 */
import type { CameraUIState } from '../../types/ws'
import { post } from '../../lib/api'
import { Icon } from '../../components/Icon'
import { QuickControl, type KnobMode } from './QuickControl'
import styles from './CompactCameraCard.module.css'

/** ISO wire value that means AUTO (masked UINT). */
const ISO_AUTO = 0x00ffffff

interface Props {
  cam: CameraUIState
  /** Opens the (later-layer) settings modal for this camera. */
  onSettings?: (id: string) => void
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

/** Seconds → "m:ss" or "h:mm:ss". */
function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Minutes → "h:mm". */
function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// ── Fire-and-forget POST that logs failures ────────────────────────────────────

function send(path: string, body?: object): void {
  post(path, body)
    .then((res) => {
      // Some knobs (iris/shutter M/A) may answer 501 on certain bodies — treat
      // any non-2xx as a no-op rather than surfacing it to the operator.
      if (!res.ok) console.warn(`[CompactCameraCard] POST ${path} → ${res.status}`)
    })
    .catch((e) => console.error(`[CompactCameraCard] POST ${path} failed`, e))
}

export function CompactCameraCard({ cam, onSettings }: Props) {
  const { id, connected, tally } = cam
  const recording = cam.recState === 1

  // ── Derived exposure/mode state for the M/A toggles ──────────────────────────
  const isoAuto = cam.raw?.iso === ISO_AUTO || cam.iso === 'AUTO'
  const shutterAuto = cam.derived?.shutterIsAuto ?? false
  const wbAuto = cam.derived?.wbIsAuto ?? false
  const irisAuto = !cam.fnumber || cam.fnumber === '—'

  const isoMode: KnobMode = isoAuto ? 'auto' : 'manual'
  const shutterMode: KnobMode = shutterAuto ? 'auto' : 'manual'
  const irisMode: KnobMode = irisAuto ? 'auto' : 'manual'

  // ── Header derivations ───────────────────────────────────────────────────────
  const metaParts = [cam.model, cam.ip, cam.atemInput > 0 ? `IN ${cam.atemInput}` : null].filter(Boolean)
  const ringClass = tally === 1 ? styles.live : tally === 2 ? styles.pvw : ''
  const tallyClass = tally === 1 ? styles.onAir : tally === 2 ? styles.preview : styles.idle
  const tallyLabel = tally === 1 ? 'On Air' : tally === 2 ? 'Preview' : 'Idle'

  // ── Status bar derivations ───────────────────────────────────────────────────
  const cardTime = cam.recRemainSec > 0 ? formatTime(cam.recRemainSec) : '—'
  const batteryTime = cam.batteryMinutes > 0 ? formatMinutes(cam.batteryMinutes) : null
  // `charging` = on external power; powerSource 1=DC, 3=PoE also mean mains.
  const onAdapter = cam.charging || cam.powerSource === 1 || cam.powerSource === 3

  // ── ATEM strip derivations ───────────────────────────────────────────────────
  const atemInLabel = cam.atemInput > 0 ? `IN ${cam.atemInput}` : 'No input'
  const atemLinkText = cam.atemControlEnabled ? 'Control + tally' : 'Tally only'

  // ── Actions ──────────────────────────────────────────────────────────────────
  const reconnect = () => send(`/api/cameras/${id}/connect`)
  const toggleRec = () => send(`/api/cameras/${id}/record`)
  const adjust = (param: string, delta: 1 | -1) => send(`/api/cameras/${id}/adjust`, { param, delta })
  const colorTemp = (direction: 1 | -1) => send(`/api/cameras/${id}/color-temp`, { direction })
  const setMode = (param: string, mode: 'auto' | 'manual') => send(`/api/cameras/${id}/mode`, { param, mode })

  return (
    <div className={`${styles.card} ${ringClass}`}>
      {/* Header */}
      <div className={styles.chead}>
        <div className={styles.cid}>
          <div className={styles.cname}>{cam.name}</div>
          <div className={styles.cmeta}>
            <span className={`${styles.conn} ${connected ? '' : styles.off}`} />
            {metaParts.join(' · ')}
          </div>
        </div>
        <span className={`${styles.tally} ${tallyClass}`}>{tallyLabel}</span>
        <button type="button" className={styles.icn} onClick={reconnect} title="Reconnect">
          <Icon name="refresh" />
        </button>
      </div>

      {/* Status bar */}
      <div className={styles.statusbar}>
        <div className={`${styles.st} ${recording ? styles.rec : ''}`}>
          <div className={styles.statK}>{recording ? 'Rec' : 'Status'}</div>
          <div className={`${styles.statV} ${recording ? styles.recBadge : ''}`}>
            {recording && <span className={styles.recDot} />}
            {recording ? formatTime(cam.recDurationSec) : 'Idle'}
          </div>
        </div>
        <div className={styles.st}>
          <div className={styles.statK}>Card</div>
          <div className={styles.statV}>{cardTime}</div>
        </div>
        <div className={styles.st}>
          <div className={styles.statK}>Battery</div>
          <div className={`${styles.statV} ${styles.batV}`}>
            <span>{cam.battery}%</span>
            {batteryTime && <span className={styles.tm}>{batteryTime}</span>}
          </div>
          {onAdapter && (
            <div className={styles.adp}>
              <Icon name="bolt" size={12} />
              On adapter
            </div>
          )}
        </div>
        <div className={styles.st}>
          <div className={styles.statK}>Audio</div>
          <div className={styles.mrow}>
            <div className={styles.amtr}>
              <i style={{ width: '0%' }} />
            </div>
            <div className={styles.amtr}>
              <i style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ATEM link strip */}
      <div className={`${styles.catem} ${cam.atemControlEnabled ? '' : styles.off}`}>
        <span className={styles.atemL}>ATEM</span>
        <span className={styles.atemIn}>{atemInLabel}</span>
        <span className={styles.atemLk}>
          <span className={styles.atemDot} />
          {atemLinkText}
        </span>
      </div>

      {/* Quick controls */}
      <div className={styles.quick}>
        <QuickControl
          label="ISO"
          value={cam.iso}
          mode={isoMode}
          onMode={(m) => setMode('iso', m)}
          onStep={(dir) => adjust('iso', dir)}
          disabled={!connected}
        />
        <QuickControl
          label="Shutter"
          value={cam.shutter}
          mode={shutterMode}
          onMode={(m) => setMode('shutter', m)}
          onStep={(dir) => adjust('shutter', dir)}
          disabled={!connected}
        />
        <QuickControl
          label="Iris"
          value={irisAuto ? 'Auto' : `f/${cam.fnumber}`}
          mode={irisMode}
          onMode={(m) => setMode('iris', m)}
          onStep={(dir) => adjust('fnumber', dir)}
          disabled={!connected}
        />
        <QuickControl
          label="WB"
          value={wbAuto ? 'Auto' : cam.colorTemp}
          onStep={(dir) => colorTemp(dir)}
          disabled={!connected}
        />
      </div>

      {/* Footer */}
      <div className={styles.cfoot}>
        <button
          type="button"
          className={`${styles.recbtn} ${recording ? styles.recording : ''}`}
          onClick={toggleRec}
          disabled={!connected}
        >
          <Icon name={recording ? 'stop' : 'rec'} />
          {recording ? 'Stop' : 'Record'}
        </button>
        <button type="button" className={styles.setbtn} onClick={() => onSettings?.(id)} title="Camera settings">
          <Icon name="cog" />
          Settings
        </button>
      </div>

      {/* Offline overlay — pointer-events:none so Reconnect stays clickable */}
      {!connected && (
        <div className={styles.offline}>
          <span className={styles.offlineLabel}>OFFLINE</span>
        </div>
      )}
    </div>
  )
}
