import styles from './CameraCard.module.css'

/**
 * OfflineOverlay — blurred scrim rendered inside the card when disconnected.
 * The card head (name, buttons) sits at z-index 11, above this overlay,
 * so Reconnect / Edit buttons stay clickable while the camera is offline.
 */
export function OfflineOverlay() {
  return (
    <div className={styles.offlineOverlay}>
      <span className={styles.offlineLabel}>OFFLINE</span>
    </div>
  )
}
