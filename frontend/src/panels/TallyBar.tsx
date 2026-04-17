import { useAtemStore, tallyForInput } from '../stores/atem'
import { useCamerasStore } from '../stores/cameras'
import styles from './TallyBar.module.css'

export function TallyBar() {
  const topology      = useAtemStore((s) => s.topology)
  const tally         = useAtemStore((s) => s.tally)
  const atemConnected = useAtemStore((s) => s.connected)
  const cameras       = useCamerasStore((s) => s.cameras)

  // Build a label for a tally input:
  // prefer the camera name mapped to this ATEM input, otherwise show input number.
  function labelFor(inputId: number): string {
    for (const cam of cameras.values()) {
      if (cam.atemInput === inputId) return cam.name
    }
    return String(inputId)
  }

  return (
    <div className={styles.bar}>
      <span className={styles.label}>TALLY</span>
      <div className={styles.inputs}>
        {topology.map((inputId) => {
          const code = tallyForInput(topology, tally, inputId)
          const cls = [
            styles.btn,
            !atemConnected ? styles.disconnected : '',
            code === 1 ? styles.pgm : '',
            code === 2 ? styles.pvw : '',
          ].filter(Boolean).join(' ')

          return (
            <div key={inputId} className={cls} title={`Input ${inputId}`}>
              {labelFor(inputId)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
