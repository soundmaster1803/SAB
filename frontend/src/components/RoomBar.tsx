/**
 * RoomBar — control-room top bar (new design). Replaces the legacy Header.
 * Brand + bridge status + version, global actions (REC all / Stop all / Push
 * format to all / Presets / Add camera / Logs), and a Demo Mode toggle to explore
 * the UI without cameras. SVG icons, English, responsive (wraps on narrow).
 */
import { useCallback, useEffect, useState } from 'react'
import { useWsStore } from '../stores/ws'
import { useAtemStore } from '../stores/atem'
import { useCamerasStore } from '../stores/cameras'
import { useDemoStore } from '../stores/demo'
import { Icon } from './Icon'
import styles from './RoomBar.module.css'

interface Props {
  onAddCamera?: () => void
  onRecAll?: () => void
  onStopAll?: () => void
  onDeleteAll?: () => void
  onOpenLogs?: () => void
  onOpenPresets?: () => void
  onPushFormat?: () => void
}

interface NetIface { name: string; address: string }

export function RoomBar({ onAddCamera, onRecAll, onStopAll, onDeleteAll, onOpenLogs, onOpenPresets, onPushFormat }: Props) {
  const wsStatus = useWsStore((s) => s.status)
  const version = useAtemStore((s) => s.appVersion)
  const cameraCount = useCamerasStore((s) => s.cameraList.length)
  const demo = useDemoStore((s) => s.enabled)
  const toggleDemo = useDemoStore((s) => s.toggle)

  const [ifaces, setIfaces] = useState<NetIface[]>([])
  const loadIfaces = useCallback(async () => {
    try { setIfaces((await (await fetch('/api/interfaces')).json()) as NetIface[]) } catch { /* ignore */ }
  }, [])
  useEffect(() => { if (wsStatus === 'connected') loadIfaces() }, [wsStatus, loadIfaces])

  const deleteAll = () => {
    if (cameraCount === 0) return
    if (window.confirm(`Disconnect and remove ALL ${cameraCount} camera(s)?`)) onDeleteAll?.()
  }

  const connected = wsStatus === 'connected'

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
        <b>SAB</b>
        <span className={styles.sub}>Control Room</span>
        {demo && <span className={styles.demoTag}>DEMO</span>}
        {version && <span className={styles.ver}>v{version}</span>}
        {ifaces.length > 0 && !demo && (
          <span className={styles.iface} title="Where the UI is reachable on the network">
            {ifaces.length === 1 ? `${ifaces[0]!.address}:7777` : `${ifaces.length} addresses`}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={onRecAll}>
          <span className={styles.recDot} />REC all
        </button>
        <button type="button" className={styles.btn} onClick={onStopAll}>
          <Icon name="stop" size={13} />Stop all
        </button>
        <button type="button" className={styles.btn} onClick={onPushFormat}>
          <Icon name="sliders" size={14} />Push format to all
        </button>
        <button type="button" className={styles.btn} onClick={onOpenPresets}>
          <Icon name="save" size={14} />Presets
        </button>
        <button type="button" className={styles.btn} onClick={onAddCamera}>
          <Icon name="plus" size={14} />Add
        </button>
        <button type="button" className={styles.btn} onClick={onOpenLogs}>Logs</button>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={deleteAll} disabled={cameraCount === 0} title="Remove all cameras">
          <Icon name="trash" size={13} />
        </button>
        <button type="button" className={`${styles.btn} ${demo ? styles.demoOn : ''}`} onClick={toggleDemo} title="Explore the UI without cameras">
          <Icon name="diag" size={14} />{demo ? 'Demo: On' : 'Demo'}
        </button>
      </div>
    </header>
  )
}
