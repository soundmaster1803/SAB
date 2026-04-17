import { useRef, useState, useEffect, useCallback } from 'react'
import { Dot } from './Dot'
import { useWsStore } from '../stores/ws'
import { useAtemStore } from '../stores/atem'
import styles from './Header.module.css'

interface NetworkIface {
  name: string
  address: string
}

// ─── ATEM API helpers ─────────────────────────────────────────────────────────

async function atemConnect(ip: string): Promise<void> {
  await fetch('/api/atem/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip }),
  })
}

async function atemDisconnect(): Promise<void> {
  await fetch('/api/atem/disconnect', { method: 'POST' })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface HeaderProps {
  onAddCamera?: () => void
  onRecAll?: () => void
  onStopAll?: () => void
}

export function Header({ onAddCamera, onRecAll, onStopAll }: HeaderProps) {
  const wsStatus      = useWsStore((s) => s.status)
  const atemConnected = useAtemStore((s) => s.connected)
  const atemIp        = useAtemStore((s) => s.ip)
  const appVersion    = useAtemStore((s) => s.appVersion)

  const [ipInput,       setIpInput]       = useState('')
  const [ifaceList,     setIfaceList]     = useState<NetworkIface[]>([])
  const [ifaceOpen,     setIfaceOpen]     = useState(false)
  const ifacePillRef = useRef<HTMLDivElement>(null)

  // Sync IP input from WS state, but don't override while user is typing
  const inputFocused = useRef(false)
  useEffect(() => {
    if (!inputFocused.current) setIpInput(atemIp)
  }, [atemIp])

  // Load network interfaces once connected
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

  // Close iface dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ifacePillRef.current && !ifacePillRef.current.contains(e.target as Node)) {
        setIfaceOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleAtemToggle = async () => {
    if (atemConnected) {
      await atemDisconnect()
    } else {
      const ip = ipInput.trim()
      if (!ip) return
      await atemConnect(ip)
    }
  }

  const ifaceLabel = ifaceList.length === 0
    ? '—'
    : ifaceList.length === 1
      ? ifaceList[0]!.address
      : `${ifaceList.length} IPs`

  const actions = (
    <div className={styles.actions}>
      <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onAddCamera}>
        + Add Camera
      </button>
      <button className={`${styles.btn} ${styles.btnStopAll}`} onClick={onStopAll}>
        ■ Stop All
      </button>
      <button className={`${styles.btn} ${styles.btnRecAll}`} onClick={onRecAll}>
        ● REC ALL
      </button>
    </div>
  )

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        {/* Logo + WS status */}
        <div className={styles.logo}>
          <Dot on={wsStatus === 'connected'} title="Bridge connection" />
          Cine<em>Link</em>
        </div>

        {appVersion && (
          <div className={styles.verBadge}>v{appVersion}</div>
        )}

        <div className={styles.spacer} />

        {/* ATEM panel */}
        <div className={styles.atemPanel}>
          <Dot on={atemConnected} title="ATEM" />
          <span className={styles.atemLabel}>ATEM</span>
          <input
            className={styles.atemIpInput}
            value={ipInput}
            placeholder="192.168.1.240"
            inputMode="decimal"
            autoComplete="off"
            maxLength={15}
            disabled={atemConnected}
            onFocus={() => { inputFocused.current = true }}
            onBlur={() => { inputFocused.current = false }}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAtemToggle() }}
          />
          <button
            className={`${styles.btnAtem} ${atemConnected ? styles.disconnect : ''}`}
            onClick={handleAtemToggle}
          >
            {atemConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        {/* Network interfaces pill */}
        {ifaceList.length > 0 && (
          <div
            ref={ifacePillRef}
            className={styles.ifacePill}
            onClick={(e) => { e.stopPropagation(); setIfaceOpen((v) => !v) }}
          >
            <span>📡</span>
            <span>{ifaceLabel}</span>
            <div className={`${styles.ifaceDropdown} ${ifaceOpen ? styles.open : ''}`}>
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
          </div>
        )}

        <div className={styles.spacer} />

        {/* Desktop actions */}
        {actions}
      </div>

      {/* Mobile second row */}
      <div className={styles.rowMobile}>
        {actions}
      </div>
    </header>
  )
}
