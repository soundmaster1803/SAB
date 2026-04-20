/**
 * AtemBar — fixed bottom strip dedicated to the ATEM switcher.
 *
 * Sections:
 *   1. IP input (with mDNS scan dropdown) + Connect/Disconnect + Auto-reconnect
 *   2. (when connected) Detected model name
 *   3. (when connected) Per-input camera buttons "Cam N" with tally colors —
 *      not clickable, display only. Each cell shows the linked Sony camera
 *      name underneath, or "not linked" if no Sony camera maps to that input.
 */
import { useEffect, useRef, useState } from 'react'
import { useAtemStore, tallyForInput } from '../../stores/atem'
import { useCamerasStore } from '../../stores/cameras'
import { Dot } from '../../components/Dot'
import { SearchIcon } from '../../components/icons/SearchIcon'
import styles from './AtemBar.module.css'

interface DiscoveredAtem {
  ip: string
  name: string
  hostname: string
  port: number
  model?: string
  uniqueId?: string
  firmware?: string
}

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

async function setAutoReconnect(autoReconnect: boolean): Promise<void> {
  await fetch('/api/atem/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoReconnect }),
  })
}

async function discoverAtems(timeoutMs = 3000): Promise<DiscoveredAtem[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs + 1000) // +1s for safety
  try {
    const r = await fetch(`/api/atem/discover?timeout=${timeoutMs}`, {
      signal: controller.signal,
    })
    if (!r.ok) return []
    const data = await r.json() as { ok: boolean; found?: DiscoveredAtem[] }
    return data.found ?? []
  } catch (e) {
    console.warn('discoverAtems failed:', e)
    return []
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getAtemFavorites(): Promise<{ ip: string; name?: string; model?: string }[]> {
  const r = await fetch('/api/atem/favorites')
  if (!r.ok) return []
  const data = await r.json() as { ok: boolean; favorites?: { ip: string; name?: string; model?: string }[] }
  return data.favorites ?? []
}

async function addAtemFavorite(ip: string, name?: string, model?: string): Promise<void> {
  await fetch('/api/atem/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, name, model }),
  })
}

async function removeAtemFavorite(ip: string): Promise<void> {
  await fetch(`/api/atem/favorites/${ip}`, { method: 'DELETE' })
}

export function AtemBar() {
  const connected     = useAtemStore((s) => s.connected)
  const ip            = useAtemStore((s) => s.ip)
  const model         = useAtemStore((s) => s.model)
  const topology      = useAtemStore((s) => s.topology)
  const tally         = useAtemStore((s) => s.tally)
  const autoReconnect = useAtemStore((s) => s.autoReconnect)
  const cameras       = useCamerasStore((s) => s.cameras)

  const [ipInput, setIpInput] = useState('')
  const inputFocused = useRef(false)

  // mDNS scan state
  const [scanning, setScanning] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredAtem[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<{ ip: string; name?: string; model?: string }[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!inputFocused.current) setIpInput(ip)
  }, [ip])

  useEffect(() => {
    getAtemFavorites().then(setFavorites).catch(() => {})
  }, [])

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!dropdownOpen) return
    const onClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [dropdownOpen])

  const handleToggle = async () => {
    if (connected) {
      await atemDisconnect()
    } else {
      const v = ipInput.trim()
      if (!v) return
      await atemConnect(v)
    }
  }

  const handleAutoReconnect = (e: React.ChangeEvent<HTMLInputElement>) => {
    void setAutoReconnect(e.target.checked)
  }

  const handleScan = async () => {
    if (scanning) return
    setScanning(true)
    setDropdownOpen(true)
    setScanError(null)
    try {
      const list = await discoverAtems(3000)
      setDiscovered(list)
    } catch (e) {
      setDiscovered([])
      setScanError('Network scan failed. Check firewall or permissions.')
    } finally {
      setScanning(false)
    }
  }

  const handlePickFavorite = async (f: { ip: string; name?: string; model?: string }) => {
    setIpInput(f.ip)
    await atemConnect(f.ip)
    setDropdownOpen(false)
  }

  const handlePick = async (d: DiscoveredAtem) => {
    setIpInput(d.ip)
    await atemConnect(d.ip)
    setDropdownOpen(false)
  }

  const handleToggleFavorite = async (d: DiscoveredAtem, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await removeAtemFavorite(d.ip)
        setFavorites(favorites.filter(f => f.ip !== d.ip))
      } else {
        await addAtemFavorite(d.ip, d.name, d.model)
        setFavorites([...favorites, { ip: d.ip, name: d.name, model: d.model }])
      }
    } catch {
      // ignore
    }
  }

  // Build a lookup: ATEM input id → paired camera name (user's custom name).
  const linkedByInput = new Map<number, string>()
  for (const cam of cameras.values()) {
    if (cam.atemInput >= 1) linkedByInput.set(cam.atemInput, cam.name)
  }

  return (
    <div className={styles.bar}>
      {/* ── Row 1: connection controls ────────────────────────────── */}
      <div className={styles.connRow}>
        <Dot on={connected} title="ATEM connection" />
        <span className={styles.label}>ATEM</span>

        <div className={styles.ipWrap} ref={dropdownRef}>
          <input
            className={styles.ipInput}
            value={ipInput}
            placeholder="192.168.1.240"
            inputMode="decimal"
            autoComplete="off"
            maxLength={15}
            disabled={connected}
            onFocus={() => { inputFocused.current = true }}
            onBlur={() => { inputFocused.current = false }}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleToggle() }}
          />
          <button
            type="button"
            className={styles.scanBtn}
            onClick={handleScan}
            disabled={scanning}
            aria-label="Scan LAN for ATEM switchers"
            title="Scan LAN for ATEM switchers (mDNS)"
          >
            {scanning
              ? <span className={styles.spinner} aria-hidden="true" />
              : <SearchIcon size={14} title="Scan" />
            }
          </button>

          {dropdownOpen && (
            <div className={styles.dropdown} role="listbox">
              <div className={styles.dropdownHeader}>
                <span>Discovered switchers</span>
                {!scanning && (
                  <button
                    type="button"
                    className={styles.dropdownRescan}
                    onClick={handleScan}
                  >
                    Rescan
                  </button>
                )}
              </div>

              <div className={styles.dropdownFilters}>
                <label className={styles.dropdownFilter}>
                  <input
                    type="checkbox"
                    checked={showFavoritesOnly}
                    onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                  />
                  <span>Show favorites only</span>
                </label>
              </div>

              {favorites.length > 0 && (
                <div className={styles.dropdownSection}>
                  <div className={styles.dropdownSectionTitle}>Favorites</div>
                  {favorites.map((f) => (
                    <button
                      type="button"
                      key={f.ip}
                      className={styles.dropdownItem}
                      onClick={() => handlePickFavorite(f)}
                      title={f.name || f.model || f.ip}
                    >
                      <span className={styles.ddIp}>{f.ip}</span>
                      <span className={styles.ddName}>
                        {f.model || f.name || 'ATEM'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.dropdownSection}>
                <div className={styles.dropdownSectionTitle}>Network Scan</div>

              {scanning && (
                <div className={styles.dropdownStatus}>Scanning network…</div>
              )}

              {!scanning && discovered.length === 0 && !scanError && (
                <div className={styles.dropdownStatus}>
                  No ATEM switchers found on the LAN.
                </div>
              )}

              {!scanning && scanError && (
                <div className={styles.dropdownError}>
                  {scanError}
                </div>
              )}

              {!scanning && discovered
                .filter(d => !showFavoritesOnly || favorites.some(f => f.ip === d.ip))
                .map((d) => {
                const isFavorite = favorites.some(f => f.ip === d.ip);
                return (
                  <div key={d.ip} className={styles.dropdownItem}>
                    <button
                      type="button"
                      className={styles.dropdownItemMain}
                      onClick={() => handlePick(d)}
                      title={d.hostname || d.name}
                    >
                      <span className={styles.ddIp}>{d.ip}</span>
                      <span className={styles.ddName}>
                        {d.model || d.name || d.hostname || 'ATEM'}
                        {d.firmware && <span className={styles.ddFirmware}> (FW: {d.firmware})</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.dropdownFavorite}
                      onClick={() => handleToggleFavorite(d, isFavorite)}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        <button
          className={`${styles.btn} ${connected ? styles.btnDisconnect : styles.btnConnect}`}
          onClick={handleToggle}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={autoReconnect}
            onChange={handleAutoReconnect}
          />
          <span>Auto-reconnect</span>
        </label>

        {connected && model && (
          <div className={styles.model}>
            <span className={styles.modelTag}>Model</span>
            <span className={styles.modelName}>{model}</span>
          </div>
        )}
      </div>

      {/* ── Row 2: per-input tally buttons with linked camera labels ── */}
      {connected && topology.length > 0 && (
        <div className={styles.inputsRow}>
          {topology.map((inputId) => {
            const code = tallyForInput(topology, tally, inputId)
            const linkedName = linkedByInput.get(inputId)
            const cls = [
              styles.camCell,
              code === 1 ? styles.pgm : '',
              code === 2 ? styles.pvw : '',
            ].filter(Boolean).join(' ')
            return (
              <div key={inputId} className={cls} title={`ATEM Input ${inputId}`}>
                <span className={styles.camBtnLabel}>Cam {inputId}</span>
                <span className={linkedName ? styles.linkedNameOn : styles.linkedNameOff}>
                  {linkedName ?? 'not linked'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
