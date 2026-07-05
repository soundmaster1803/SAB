/**
 * parts — small presentational building blocks shared by the settings tabs.
 * All are purely visual; behaviour is delegated via props. They share the
 * modal's CSS module so class names stay identical to the mockup.
 */
import type { ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import styles from './CameraSettingsModal.module.css'

/** A labelled settings row (118px label column + control). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

/** A section divider heading inside a pane. */
export function Sec({ children }: { children: ReactNode }) {
  return <div className={styles.sec}>{children}</div>
}

/** A dimmed note spanning the full field width. */
export function Note({ children }: { children: ReactNode }) {
  return <div className={styles.note}>{children}</div>
}

/** Manual / Auto pill toggle. `mode` null hides it (control has no A/M). */
export function AM({
  mode,
  onMode,
  disabled,
}: {
  mode: 'auto' | 'manual' | null
  onMode: (m: 'auto' | 'manual') => void
  disabled?: boolean
}) {
  if (mode === null) return null
  return (
    <span className={styles.am}>
      <button
        type="button"
        className={mode === 'manual' ? styles.sel : undefined}
        onClick={() => onMode('manual')}
        disabled={disabled}
        title="Manual"
      >
        M
      </button>
      <button
        type="button"
        className={mode === 'auto' ? styles.sel : undefined}
        onClick={() => onMode('auto')}
        disabled={disabled}
        title="Auto"
      >
        A
      </button>
    </span>
  )
}

/** value + ▲▼ steppers row, with an optional leading M/A pill. */
export function StepRow({
  mode = null,
  onMode,
  value,
  onUp,
  onDown,
  disabled,
  stepDisabled,
}: {
  mode?: 'auto' | 'manual' | null
  onMode?: (m: 'auto' | 'manual') => void
  value: ReactNode
  onUp: () => void
  onDown: () => void
  disabled?: boolean
  /** Disable only the steppers (e.g. value is in Auto) while M/A stays live. */
  stepDisabled?: boolean
}) {
  return (
    <div className={styles.row2}>
      {mode !== null && <AM mode={mode} onMode={(m) => onMode?.(m)} disabled={disabled} />}
      <span className={styles.val2}>{value}</span>
      <span className={styles.stepper2}>
        <button type="button" className={styles.step} onClick={onUp} disabled={disabled || stepDisabled} title="Increase">
          <Icon name="up" size={12} />
        </button>
        <button type="button" className={styles.step} onClick={onDown} disabled={disabled || stepDisabled} title="Decrease">
          <Icon name="down" size={12} />
        </button>
      </span>
    </div>
  )
}

/** A native <select> wired to a string value. */
export function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string | number
  onChange: (v: string) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {children}
    </select>
  )
}
