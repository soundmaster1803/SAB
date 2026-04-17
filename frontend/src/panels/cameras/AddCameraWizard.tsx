/**
 * AddCameraWizard — multi-step modal for pairing a new Sony camera.
 *
 * Steps:
 *   1. Form  — enter IP, name, ATEM input → "Add Camera" triggers pair API
 *   2. Connecting — blocking wait (up to 15s); after 2.5s shows "confirm on camera" hint
 *   3. Result — success ("Camera added!") or error (message + retry option)
 *
 * The /api/cameras/pair endpoint is blocking and handles the connection itself.
 * Close with Escape, backdrop click, or Done/Cancel buttons.
 */
import { useEffect, useRef, useState } from 'react'
import styles from './AddCameraWizard.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'form' | 'connecting' | 'success' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export function AddCameraWizard({ open, onClose }: Props) {
  const [step,      setStep]      = useState<Step>('form')
  const [ip,        setIp]        = useState('')
  const [name,      setName]      = useState('')
  const [atemInput, setAtemInput] = useState('1')
  const [error,     setError]     = useState('')
  const [hint,      setHint]      = useState(false)   // "confirm on camera" hint

  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameRef      = useRef<HTMLInputElement>(null)

  // Reset to form when opened
  useEffect(() => {
    if (open) {
      setStep('form')
      setIp('')
      setName('')
      setAtemInput('1')
      setError('')
      setHint(false)
      // Focus name field on next frame
      requestAnimationFrame(() => nameRef.current?.focus())
    }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'connecting') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step, onClose])

  // Cleanup hint timer on unmount
  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
  }, [])

  if (!open) return null

  // ── Form submit ─────────────────────────────────────────────────────────────

  async function submit() {
    const trimmedName = name.trim()
    const trimmedIp   = ip.trim()
    const inputNum    = parseInt(atemInput, 10)

    if (!trimmedName) { setError('Camera name is required.'); return }
    if (!trimmedIp)   { setError('IP address is required.'); return }
    if (isNaN(inputNum) || inputNum < 1 || inputNum > 20) {
      setError('ATEM input must be a number from 1 to 20.')
      return
    }

    setError('')
    setHint(false)
    setStep('connecting')

    // Show "confirm on camera" hint after 2.5s
    hintTimerRef.current = setTimeout(() => setHint(true), 2500)

    try {
      const res = await fetch('/api/cameras/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, ip: trimmedIp, atemInput: inputNum }),
        signal: AbortSignal.timeout(18000),
      })

      clearTimeout(hintTimerRef.current!)
      hintTimerRef.current = null

      if (res.ok) {
        setStep('success')
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        setError(data.error ?? 'Pairing failed')
        setStep('error')
      }
    } catch (e: unknown) {
      clearTimeout(hintTimerRef.current!)
      hintTimerRef.current = null
      const msg = e instanceof Error && e.name === 'TimeoutError'
        ? 'Camera did not respond. Check the IP address and try again.'
        : `Connection failed: ${e instanceof Error ? e.message : String(e)}`
      setError(msg)
      setStep('error')
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && step !== 'connecting') onClose()
  }

  function retry() {
    setStep('form')
    setError('')
    setHint(false)
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>

        {/* ── Step 1: form ── */}
        {step === 'form' && (
          <>
            <h2 className={styles.heading}>Add Camera</h2>

            <div className={styles.field}>
              <label className={styles.label}>Camera Name</label>
              <input
                ref={nameRef}
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sony FX30 — A"
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>IP Address</label>
              <input
                className={styles.input}
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.100"
                inputMode="decimal"
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>ATEM Input (1–20)</label>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={20}
                value={atemInput}
                onChange={(e) => setAtemInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>Cancel</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={submit}>Add Camera</button>
            </div>
          </>
        )}

        {/* ── Step 2: connecting ── */}
        {step === 'connecting' && (
          <>
            <h2 className={styles.heading}>Connecting…</h2>
            <div className={styles.connectingBody}>
              <div className={styles.spinner} />
              <p className={styles.connectingIp}>
                {ip}
              </p>
              {hint && (
                <div className={styles.hintBox}>
                  Look at the camera screen and press <strong>OK</strong> to accept the connection.
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 3a: success ── */}
        {step === 'success' && (
          <>
            <h2 className={styles.heading}>Camera Added</h2>
            <div className={styles.resultBody}>
              <div className={styles.successIcon}>✓</div>
              <p className={styles.resultText}>
                <strong>{name}</strong> is now connected and will appear in the camera grid.
              </p>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Done</button>
            </div>
          </>
        )}

        {/* ── Step 3b: error ── */}
        {step === 'error' && (
          <>
            <h2 className={styles.heading}>Pairing Failed</h2>
            <div className={styles.resultBody}>
              <div className={styles.errorIcon}>✕</div>
              <p className={styles.resultText}>{error}</p>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnGhost}`}   onClick={onClose}>Cancel</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={retry}>Try Again</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
