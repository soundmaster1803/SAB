import type { RuntimeCapabilities, RuntimeInfo } from '../../types/ws'
import styles from './CameraCard.module.css'

interface Props {
  runtimeInfo?: RuntimeInfo
  capabilities?: RuntimeCapabilities
}

/**
 * RuntimeBadges — small pill badges shown under the camera model name.
 * Badges appear only after the camera's runtime model has been built
 * (i.e. runtimeInfo is present). They surface PTP version, a subset of
 * capability flags, and any unknown props observed by the polling loop.
 */
export function RuntimeBadges({ runtimeInfo, capabilities: caps }: Props) {
  if (!runtimeInfo) return null

  return (
    <div className={styles.runtimeBadges}>
      {runtimeInfo.ptpVersion && (
        <span className={`${styles.badge} ${styles.badgePtp}`}>
          {runtimeInfo.ptpVersion}
        </span>
      )}
      {caps?.hasSilentMode        && <span className={`${styles.badge} ${styles.badgeCap}`}>Silent</span>}
      {caps?.hasNdFilter          && <span className={`${styles.badge} ${styles.badgeCap}`}>ND</span>}
      {caps?.hasStabilization     && <span className={`${styles.badge} ${styles.badgeCap}`}>IS</span>}
      {caps?.hasSubjectRecognition && <span className={`${styles.badge} ${styles.badgeCap}`}>AF-S</span>}
      {caps?.hasStreaming          && <span className={`${styles.badge} ${styles.badgeCap}`}>Stream</span>}
      {caps?.hasTallyLamps         && <span className={`${styles.badge} ${styles.badgeCap}`}>Tally</span>}
      {runtimeInfo.unknownPropCount > 0 && (
        <span className={`${styles.badge} ${styles.badgeUnk}`}>
          {runtimeInfo.unknownPropCount} unk
        </span>
      )}
    </div>
  )
}
