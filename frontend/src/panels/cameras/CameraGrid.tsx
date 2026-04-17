/**
 * CameraGrid — responsive grid of CameraCards.
 *
 * Reads the live camera list from useCamerasStore (populated by WS state messages).
 * Shows an empty state placeholder when no cameras are paired.
 *
 * The `onDebug` callback is threaded down to each CameraCard.
 * F4 will supply the real debug modal handler; until then it is optional.
 */
import { useCamerasStore, selectCameraList } from '../../stores/cameras'
import { CameraCard } from './CameraCard'
import styles from './CameraGrid.module.css'

interface Props {
  onDebug?: (id: string) => void
}

export function CameraGrid({ onDebug }: Props) {
  const cameras = useCamerasStore(selectCameraList)

  if (cameras.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No cameras paired.</p>
        <p className={styles.emptyHint}>Use "Add Camera" in the header to pair your first Sony camera.</p>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {cameras.map((cam) => (
        <CameraCard key={cam.id} cam={cam} onDebug={onDebug} />
      ))}
    </div>
  )
}
