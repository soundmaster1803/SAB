/**
 * CameraGrid — responsive grid of compact camera cards.
 *
 * Reads the live camera list from useCamerasStore (populated by WS state messages).
 * Shows an empty state placeholder when no cameras are paired.
 *
 * Renders the redesigned CompactCameraCard (layer 1). The Settings button opens
 * the deep-settings modal — a later layer; for now `onSettings` is a placeholder.
 * The legacy CameraCard remains in the tree but is no longer rendered here.
 */
import { useCamerasStore, selectCameraList } from '../../stores/cameras'
import { CompactCameraCard } from './CompactCameraCard'
import styles from './CameraGrid.module.css'

interface Props {
  /**
   * Opens deep settings for a camera. The real settings modal is a later layer;
   * until then App wires this to the debug modal. Falls back to a no-op.
   */
  onSettings?: (id: string) => void
}

export function CameraGrid({ onSettings }: Props) {
  const cameras = useCamerasStore(selectCameraList)

  const handleSettings = onSettings ?? ((id: string) => console.info('[CameraGrid] open settings for', id))

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
        <CompactCameraCard key={cam.id} cam={cam} onSettings={handleSettings} />
      ))}
    </div>
  )
}
