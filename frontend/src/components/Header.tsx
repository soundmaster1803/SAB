import { useRef, useState, useEffect, useCallback } from 'react'
import { Dot } from './Dot'
import { useWsStore } from '../stores/ws'
import { useAtemStore } from '../stores/atem'
import { useCamerasStore } from '../stores/cameras'
import styles from './Header.module.css'

interface NetworkIface {
  name: string
  address: string
}

interface HeaderProps {
  onAddCamera?: () => void
  onRecAll?: () => void
  onStopAll?: () => void
  onDeleteAll?: () => void
  onOpenLogs?: () => void
}

export function Header({
  onAddCamera,
  onRecAll,
  onStopAll,
  onDeleteAll,
  onOpenLogs,
}: HeaderProps) {
  const wsStatus    = useWsStore((s) => s.status)
  const appVersion  = useAtemStore((s) => s.appVersion)
  const cameraCount = useCamerasStore((s) => s.cameraList.length)

  const [ifaceList, setIfaceList] = useState<NetworkIface[]>([])
  const [ifaceOpen, setIfaceOpen] = useState(false)
  const ifacePillRef = useRef<HTMLDivElement>(null)

  const loadInterfaces = useCallback(async () => {
    try {
      const res  = await fetch('/api/interfaces')
      const list = (await res.json()) as NetworkIface[]
      setIfaceList(list)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (wsStatus === 'connected') loadInterfaces()
  }, [wsStatus, loadInterfaces])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ifacePillRef.current && !ifacePillRef.current.contains(e.target as Node)) {
        setIfaceOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleDeleteAll = () => {
    if (cameraCount === 0) return
    const ok = window.confirm(
      `Disconnect and delete ALL ${cameraCount} camera(s)? This removes them from config.`,
    )
    if (ok) onDeleteAll?.()
  }

  const ifaceLabel = ifaceList.length === 0
    ? 'No network'
    : ifaceList.length === 1
      ? `${ifaceList[0]!.address}:7777`
      : `${ifaceList.length} addresses`

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        {/* ── Brand ───────────────────────────────────────────── */}
        <div className={styles.brand}>
          <Dot on={wsStatus === 'connected'} title="Bridge connection" />
          <div className={styles.brandText}>
            <span className={styles.brandLogo}>SAB</span>
            <span className={styles.brandSep}>—</span>
            <span className={styles.brandName}>Sony ATEM Bridge</span>
          </div>
          {appVersion && <span className={styles.verBadge}>v{appVersion}</span>}
        </div>

        {/* ── Add Camera (separated from rest) ─────────────────── */}
        <div className={styles.addGroup}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAddCamera}>
            + Add Camera
          </button>
        </div>

        <div className={styles.spacer} />

        {/* ── Network address selector ─────────────────────────── */}
        {ifaceList.length > 0 && (
          <div
            ref={ifacePillRef}
            className={styles.ifacePill}
            onClick={(e) => { e.stopPropagation(); setIfaceOpen((v) => !v) }}
            title="Local addresses where the UI is reachable"
          >
            <span className={styles.ifaceCaret}>▾</span>
            <span className={styles.ifaceLabel}>{ifaceLabel}</span>

            {ifaceOpen && (
              <div className={styles.ifaceDropdown}>
                <div className={styles.ifaceDropdownTitle}>Open in browser</div>
                {ifaceList.map((iface) => (
                  <div
                    key={iface.address}
                    className={styles.ifaceEntry}
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`http://${iface.address}:7777`, '_blank')
                      setIfaceOpen(false)
                    }}
                  >
                    <span className={styles.ifaceEntryName}>{iface.name}</span>
                    <span className={styles.ifaceEntryUrl}>http://{iface.address}:7777</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Global actions ───────────────────────────────────── */}
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnRecAll}`} onClick={onRecAll}>
            ● REC ALL
          </button>
          <button className={`${styles.btn} ${styles.btnStopAll}`} onClick={onStopAll}>
            ■ Stop All
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={handleDeleteAll}
            disabled={cameraCount === 0}
            title="Disconnect and delete all cameras"
          >
            ⌫ Delete All
          </button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onOpenLogs}>
            Logs
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnPlaceholder}`}
            disabled
            title="Coming soon"
          >
            Recall Settings
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnPlaceholder}`}
            disabled
            title="Coming soon"
          >
            Camera Links
          </button>
        </div>
      </div>
    </header>
  )
}
