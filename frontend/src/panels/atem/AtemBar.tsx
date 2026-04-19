/**
 * AtemBar — fixed bottom strip dedicated to the ATEM switcher.
 *
 * Sections:
 *   1. IP input + Connect/Disconnect + Auto-reconnect checkbox
 *   2. (when connected) Detected model name
 *   3. (when connected) Per-input camera buttons "Cam N" with tally colors —
 *      not clickable, display only.
 *   4. (when connected) "Linked camera: <name>" — paired Sony cameras whose
 *      ATEM input is currently on PGM tally.
 */
import { useEffect, useRef, useState } from 'react'
import { useAtemStore, tallyForInput } from '../../stores/atem'
import { useCamerasStore } from '../../stores/cameras'
import { Dot } from '../../components/Dot'
import styles from './AtemBar.module.css'

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

  useEffect(() => {
    if (!inputFocused.current) setIpInput(ip)
  }, [ip])

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
