/**
 * QuickControl — a single cell of the compact card's 2×2 quick-controls grid
 * (ISO / Shutter / Iris / WB). Label, optional M/A toggle, current value and
 * ▲▼ steppers. Purely presentational: all actions are delegated via props.
 *
 * Mirrors the `.qc` block in docs/design/camera-card-mockup.html.
 */
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import styles from './QuickControl.module.css'

/** Exposure mode of a knob, or `null` when the control has no M/A toggle. */
export type KnobMode = 'auto' | 'manual' | null

interface Props {
  label: string
  /** Current formatted value (already display-ready). */
  value: ReactNode
  /** Auto/Manual state, or null to hide the toggle (e.g. WB has none). */
  mode?: KnobMode
  /** Called when the operator picks a mode via the M/A toggle. */
  onMode?: (mode: 'auto' | 'manual') => void
  /** Called with +1 (▲) or -1 (▼) when a stepper is pressed. */
  onStep: (dir: 1 | -1) => void
  disabled?: boolean
}

export function QuickControl({ label, value, mode = null, onMode, onStep, disabled = false }: Props) {
  return (
    <div className={styles.qc}>
      <div className={styles.lab}>
        {label}
        {mode !== null && (
          <span className={styles.am}>
            <button
              type="button"
              className={mode === 'manual' ? styles.sel : undefined}
              disabled={disabled}
              onClick={() => onMode?.('manual')}
              title="Manual"
            >
              M
            </button>
            <button
              type="button"
              className={mode === 'auto' ? styles.sel : undefined}
              disabled={disabled}
              onClick={() => onMode?.('auto')}
              title="Auto"
            >
              A
            </button>
          </span>
        )}
      </div>
      <div className={styles.body}>
        <span className={styles.val}>{value}</span>
        <span className={styles.stepper}>
          <button type="button" className={styles.step} disabled={disabled} onClick={() => onStep(1)} title={`${label} up`}>
            <Icon name="up" size={12} />
          </button>
          <button type="button" className={styles.step} disabled={disabled} onClick={() => onStep(-1)} title={`${label} down`}>
            <Icon name="down" size={12} />
          </button>
        </span>
      </div>
    </div>
  )
}
