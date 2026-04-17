/**
 * AtemPanel — ATEM switcher status card in the main content area.
 *
 * Shows:
 *  - Connection status with green/grey dot
 *  - Model name + IP + input count (when connected)
 *  - TallyStrip: per-input tally state with camera name labels
 *
 * Intentionally minimal — the header already has the connect/disconnect
 * controls, so this panel is a read-only status overview.
 * Hidden when ATEM is not connected and topology is empty.
 */
import { useAtemStore } from '../../stores/atem'
import { TallyStrip } from './TallyStrip'
import styles from './AtemPanel.module.css'

export function AtemPanel() {
  const connected  = useAtemStore((s) => s.connected)
  const model      = useAtemStore((s) => s.model)
  const ip         = useAtemStore((s) => s.ip)
  const inputCount = useAtemStore((s) => s.inputCount)
  const topology   = useAtemStore((s) => s.topology)

  // Hide the panel entirely when there's nothing to show
  if (!connected && topology.length === 0) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
        <span className={styles.title}>ATEM Switcher</span>
        {connected && model && <span className={styles.model}>{model}</span>}
        {connected && ip && (
          <span className={styles.meta}>{ip} · {inputCount} inputs</span>
        )}
        {!connected && <span className={styles.offline}>Disconnected</span>}
      </div>

      <TallyStrip />
    </div>
  )
}
