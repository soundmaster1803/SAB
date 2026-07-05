/**
 * CameraGrid — responsive grid of compact camera cards + the settings modal.
 *
 * Reads the live camera list from useCamerasStore. Each card's Settings button
 * opens the comprehensive CameraSettingsModal for that camera. The legacy
 * CameraCard remains in the tree but is no longer rendered here.
 */
import { useState } from 'react'
import { useCamerasStore, selectCameraList } from '../../stores/cameras'
import { CompactCameraCard } from './CompactCameraCard'
import { CameraSettingsModal } from './settings/CameraSettingsModal'
import styles from './CameraGrid.module.css'

export function CameraGrid() {
  const cameras = useCamerasStore(selectCameraList)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const settingsCam = cameras.find((c) => c.id === settingsId) ?? null

  if (cameras.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No cameras paired.</p>
        <p className={styles.emptyHint}>Use "Add Camera" in the header to pair your first Sony camera.</p>
      </div>
    )
  }

  return (
    <>
      <div className={styles.grid}>
        {cameras.map((cam) => (
          <CompactCameraCard key={cam.id} cam={cam} onSettings={setSettingsId} />
        ))}
      </div>
      <CameraSettingsModal cam={settingsCam} onClose={() => setSettingsId(null)} />
    </>
  )
}
