/**
 * TallyStrip — compact per-input tally row embedded inside AtemPanel.
 *
 * Shows every ATEM input in topology order as a labeled button.
 * Camera name is shown when the input is mapped to a camera; otherwise
 * the raw input number is shown (e.g. unused inputs or non-camera inputs).
 *
 * Unlike TallyBar (fixed bottom strip), TallyStrip is an inline
 * content component — part of the AtemPanel.
 */
import { useAtemStore, tallyForInput } from '../../stores/atem'
import { useCamerasStore } from '../../stores/cameras'
import styles from './TallyStrip.module.css'

export function TallyStrip() {
  const topology      = useAtemStore((s) => s.topology)
  const tally         = useAtemStore((s) => s.tally)
  const atemConnected = useAtemStore((s) => s.connected)
  const cameras       = useCamerasStore((s) => s.cameras)

  if (topology.length === 0) {
    return <p className={styles.empty}>No inputs detected. Connect ATEM to see topology.</p>
  }

  function labelFor(inputId: number): string {
    for (const cam of cameras.values()) {
      if (cam.atemInput === inputId) return cam.name
    }
    return `In ${inputId}`
  }

  return (
    <div className={styles.strip}>
      {topology.map((inputId) => {
        const code = tallyForInput(topology, tally, inputId)
        const cls = [
          styles.btn,
          !atemConnected ? styles.disconnected : '',
          code === 1 ? styles.pgm : '',
          code === 2 ? styles.pvw : '',
        ].filter(Boolean).join(' ')

        return (
          <div key={inputId} className={cls} title={`ATEM Input ${inputId}`}>
            <span className={styles.inputNum}>{inputId}</span>
            <span className={styles.label}>{labelFor(inputId)}</span>
          </div>
        )
      })}
    </div>
  )
}
