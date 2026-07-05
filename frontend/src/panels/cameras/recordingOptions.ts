/**
 * recordingOptions — shared Sony recording-format label tables and helpers.
 *
 * Extracted from the legacy CameraCard so the settings modal's Recording tab and
 * any future consumer share one source of truth. Values are the confirmed PTP3
 * wire codes for movie file format (0xD241), recording setting / fps+bitrate
 * (0xD242) and video frame rate (0xD286).
 *
 * The camera reports its LIVE supported lists (movieFileFormatList, recSettingList,
 * recFrameRateList). Prefer those; these full tables are only a fallback for
 * labelling and for the rare camera that does not enumerate a list.
 */

export interface RecOption {
  value: number
  label: string
}

export const FILE_FORMAT_OPTIONS: readonly RecOption[] = [
  { value: 0x03, label: 'AVCHD' },
  { value: 0x04, label: 'MP4' },
  { value: 0x08, label: 'XAVC S 4K' },
  { value: 0x09, label: 'XAVC S HD' },
  { value: 0x0B, label: 'XAVC HS 4K' },
  { value: 0x0C, label: 'XAVC S-L 4K' },
  { value: 0x0D, label: 'XAVC S-L HD' },
  { value: 0x0E, label: 'XAVC S-I 4K' },
  { value: 0x0F, label: 'XAVC S-I HD' },
  { value: 0x13, label: 'XAVC HS HD' },
  { value: 0x14, label: 'XAVC S-I DCI 4K' },
  { value: 0x1B, label: 'XAVC HS-L 422' },
  { value: 0x1C, label: 'XAVC HS-L 420' },
  { value: 0x1D, label: 'XAVC S-L 422' },
  { value: 0x1E, label: 'XAVC S-L 420' },
  { value: 0x1F, label: 'XAVC S-I 422' },
]

export const REC_SETTING_OPTIONS: readonly RecOption[] = [
  // XAVC S HD / 720p
  { value: 0x0001, label: '60p 50M / XAVC S' },
  { value: 0x0002, label: '30p 50M / XAVC S' },
  { value: 0x0003, label: '24p 50M / XAVC S' },
  { value: 0x0004, label: '50p 50M / XAVC S' },
  { value: 0x0005, label: '25p 50M / XAVC S' },
  { value: 0x0010, label: '120p 50M 720p / XAVC S' },
  { value: 0x0011, label: '100p 50M 720p / XAVC S' },
  { value: 0x0018, label: '60p 25M / XAVC S HD' },
  { value: 0x0019, label: '50p 25M / XAVC S HD' },
  { value: 0x001A, label: '30p 16M / XAVC S HD' },
  { value: 0x001B, label: '25p 16M / XAVC S HD' },
  { value: 0x001C, label: '120p 100M 1080 / XAVC S HD' },
  { value: 0x001D, label: '100p 100M 1080 / XAVC S HD' },
  { value: 0x001E, label: '120p 60M 1080 / XAVC S HD' },
  { value: 0x001F, label: '100p 60M 1080 / XAVC S HD' },
  // XAVC S 4K
  { value: 0x0020, label: '30p 100M / XAVC S 4K' },
  { value: 0x0021, label: '25p 100M / XAVC S 4K' },
  { value: 0x0022, label: '24p 100M / XAVC S 4K' },
  { value: 0x0023, label: '30p 60M / XAVC S 4K' },
  { value: 0x0024, label: '25p 60M / XAVC S 4K' },
  { value: 0x0025, label: '24p 60M / XAVC S 4K' },
  // AVCHD
  { value: 0x0006, label: '60i 24M(FX) / AVCHD' },
  { value: 0x0007, label: '50i 24M(FX) / AVCHD' },
  { value: 0x0008, label: '60i 17M(FH) / AVCHD' },
  { value: 0x0009, label: '50i 17M(FH) / AVCHD' },
  { value: 0x000A, label: '60p 28M(PS) / AVCHD' },
  { value: 0x000B, label: '50p 28M(PS) / AVCHD' },
  { value: 0x000C, label: '24p 24M(FX) / AVCHD' },
  { value: 0x000D, label: '25p 24M(FX) / AVCHD' },
  { value: 0x000E, label: '24p 17M(FH) / AVCHD' },
  { value: 0x000F, label: '25p 17M(FH) / AVCHD' },
  // MP4
  { value: 0x0012, label: '1080 30p 16M / MP4' },
  { value: 0x0013, label: '1080 25p 16M / MP4' },
  { value: 0x0014, label: '720 30p 6M / MP4' },
  { value: 0x0015, label: '720 25p 6M / MP4' },
  { value: 0x0016, label: '1080 60p 28M / MP4' },
  { value: 0x0017, label: '1080 50p 28M / MP4' },
  // High-bitrate / XAVC HS / S-I
  { value: 0x0026, label: '600M 422 10bit' },
  { value: 0x0027, label: '500M 422 10bit' },
  { value: 0x0028, label: '400M 420 10bit' },
  { value: 0x0029, label: '300M 422 10bit' },
  { value: 0x002A, label: '280M 422 10bit' },
  { value: 0x002B, label: '250M 422 10bit' },
  { value: 0x002C, label: '240M 422 10bit' },
  { value: 0x002D, label: '222M 422 10bit' },
  { value: 0x002E, label: '200M 422 10bit' },
  { value: 0x002F, label: '200M 420 10bit' },
  { value: 0x0030, label: '200M 420 8bit' },
  { value: 0x0031, label: '185M 422 10bit' },
  { value: 0x0032, label: '150M 420 10bit' },
  { value: 0x0033, label: '150M 420 8bit' },
  { value: 0x0034, label: '140M 422 10bit' },
  { value: 0x0035, label: '111M 422 10bit' },
  { value: 0x0036, label: '100M 422 10bit' },
  { value: 0x0037, label: '100M 420 10bit' },
  { value: 0x0038, label: '100M 420 8bit' },
  { value: 0x0039, label: '93M 422 10bit' },
  { value: 0x003A, label: '89M 422 10bit' },
  { value: 0x003B, label: '75M 420 10bit' },
  { value: 0x003C, label: '60M 420 8bit' },
  { value: 0x003D, label: '50M 422 10bit' },
  { value: 0x003E, label: '50M 420 10bit' },
  { value: 0x003F, label: '50M 420 8bit' },
  { value: 0x0040, label: '45M 420 10bit' },
  { value: 0x0041, label: '30M 420 10bit' },
  { value: 0x0042, label: '25M 420 8bit' },
  { value: 0x0043, label: '16M 420 8bit' },
  { value: 0x0044, label: '520M 422 10bit' },
  { value: 0x0045, label: '260M 422 10bit' },
]

export const FRAME_RATE_OPTIONS: readonly RecOption[] = [
  { value: 0x01, label: '23.98p' },
  { value: 0x02, label: '100p' },
  { value: 0x03, label: '59.94p' },
  { value: 0x04, label: '50p' },
  { value: 0x05, label: '24p' },
  { value: 0x06, label: '25p' },
  { value: 0x07, label: '30p' },
  { value: 0x08, label: '60p' },
  { value: 0x09, label: '120p' },
  { value: 0x0A, label: '119.88p' },
]

export function labelForSetting(value: number): string {
  return REC_SETTING_OPTIONS.find((o) => o.value === value)?.label
    ?? `0x${value.toString(16).toUpperCase().padStart(4, '0')}`
}

export function labelForFormat(value: number): string {
  return FILE_FORMAT_OPTIONS.find((o) => o.value === value)?.label
    ?? `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
}

export function labelForFrameRate(value: number): string {
  return FRAME_RATE_OPTIONS.find((o) => o.value === value)?.label
    ?? `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
}

/** File-format options from the camera's live list, else the full fallback table. */
export function fileFormatOptions(liveList: number[]): RecOption[] {
  return liveList.length > 0
    ? liveList.map((v) => ({ value: v, label: labelForFormat(v) }))
    : [...FILE_FORMAT_OPTIONS]
}

/** Frame-rate options from the camera's live list, else the full fallback table. */
export function frameRateOptions(liveList: number[]): RecOption[] {
  return liveList.length > 0
    ? liveList.map((v) => ({ value: v, label: labelForFrameRate(v) }))
    : [...FRAME_RATE_OPTIONS]
}

/** Recording-mode options from the camera's live list, else the full fallback table. */
export function recSettingOptions(liveList: number[]): RecOption[] {
  return liveList.length > 0
    ? liveList.map((v) => ({ value: v, label: labelForSetting(v) }))
    : [...REC_SETTING_OPTIONS]
}
