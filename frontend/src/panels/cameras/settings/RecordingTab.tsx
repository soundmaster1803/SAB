/**
 * RecordingTab — file/codec → resolution/mode → frame-rate cascade + media slot
 * and a format-card dialog. Options come from the camera's LIVE supported lists
 * (0xD241 / 0xD242 / 0xD286); the shared tables only provide labels / fallback.
 *
 * "Apply recording" pushes the chosen rec-settings to the footer target (bulk op
 * `rec-settings` validates each camera's supported list → honest partial report).
 */
import { useEffect, useState } from 'react'
import type { ApplyAction, ApplyTarget, TabProps } from './types'
import { Field, Sec, Note, Select } from './parts'
import {
  fileFormatOptions, frameRateOptions, recSettingOptions,
} from '../recordingOptions'
import { post } from '../../../lib/api'
import styles from './CameraSettingsModal.module.css'

export function RecordingTab({ cam, dispatch, register }: TabProps) {
  const id = cam.id
  const off = !cam.connected

  const formatOpts = fileFormatOptions(cam.raw?.movieFileFormatList ?? cam.movieFileFormatList ?? [])
  const fpsOpts = frameRateOptions(cam.recFrameRateList ?? [])
  const settingOpts = recSettingOptions(cam.recSettingList ?? [])

  const [format, setFormat] = useState<number>(cam.movieFileFormat || 0)
  const [fps, setFps] = useState<number>(cam.recFrameRate || 0)
  const [setting, setSetting] = useState<number>(cam.recSetting || 0)
  const [media, setMedia] = useState<number>(cam.recMedia || 1)

  // Sync from camera when it changes underneath us.
  useEffect(() => { setFormat(cam.movieFileFormat || 0) }, [cam.movieFileFormat])
  useEffect(() => { setFps(cam.recFrameRate || 0) }, [cam.recFrameRate])
  useEffect(() => { setSetting(cam.recSetting || 0) }, [cam.recSetting])
  useEffect(() => { setMedia(cam.recMedia || 1) }, [cam.recMedia])

  // Format-card dialog.
  const [fmtOpen, setFmtOpen] = useState(false)
  const [fmtSlot, setFmtSlot] = useState<1 | 2>(1)
  const [fmtType, setFmtType] = useState<'quick' | 'full'>('quick')

  const recording = cam.recState === 1

  // Register footer "Apply recording" — one rec-settings action with all chosen fields.
  useEffect(() => {
    const build = (): ApplyAction => {
      const params: Record<string, number> = {}
      if (format) params.movieFileFormat = format
      if (fps) params.recFrameRate = fps
      if (setting) params.recSetting = setting
      if (media) params.recMedia = media
      return {
        single: { path: `/api/cameras/${id}/rec-settings`, body: params },
        bulk: { op: 'rec-settings', params, label: 'Recording' },
      }
    }
    register({ apply: (_force?: ApplyTarget) => dispatch(build()) })
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, fps, setting, media])

  function doFormat() {
    post(`/api/cameras/${id}/format-media`, { slot: fmtSlot, type: fmtType }).catch(() => {})
    setFmtOpen(false)
  }

  return (
    <div className={styles.pane}>
      <Field label="File / codec">
        <Select value={format} onChange={(v) => setFormat(+v)} disabled={off || recording}>
          <option value={0}>— current —</option>
          {formatOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label="Mode / bitrate">
        <Select value={setting} onChange={(v) => setSetting(+v)} disabled={off || recording}>
          <option value={0}>— current —</option>
          {settingOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Field label="Frame rate">
        <Select value={fps} onChange={(v) => setFps(+v)} disabled={off || recording}>
          <option value={0}>— current —</option>
          {fpsOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Note>Options come from each camera's own supported list; Apply-to-all reports any camera that can't do the chosen format.</Note>

      <Sec>Media</Sec>
      <Field label="Record to">
        <Select value={media} onChange={(v) => setMedia(+v)} disabled={off || recording}>
          <option value={1}>Slot 1</option>
          <option value={2}>Slot 2</option>
          <option value={0x0101}>Simultaneous</option>
        </Select>
      </Field>
      <Field label="Format card">
        {!fmtOpen ? (
          <div className={styles.selfakeSpread}>
            <span className={styles.staticVal}>Erase a card — irreversible</span>
            <button type="button" className={styles.afbtn} onClick={() => setFmtOpen(true)} disabled={off || recording}>
              Format…
            </button>
          </div>
        ) : (
          <div className={styles.confirmBox}>
            <div className={styles.formatRow}>
              <Select value={fmtSlot} onChange={(v) => setFmtSlot(+v as 1 | 2)} disabled={off}>
                <option value={1}>Slot 1</option>
                <option value={2}>Slot 2</option>
              </Select>
              <Select value={fmtType} onChange={(v) => setFmtType(v as 'quick' | 'full')} disabled={off}>
                <option value="quick">Quick</option>
                <option value="full">Full</option>
              </Select>
            </div>
            <div className={styles.confirmText}>Erase Slot {fmtSlot} on this camera?</div>
            <div className={styles.confirmBtns}>
              <button type="button" className={styles.afbtn} onClick={() => setFmtOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.afbtn} ${styles.danger}`} onClick={doFormat} disabled={off}>Erase</button>
            </div>
          </div>
        )}
      </Field>
      {recording && <Note>Recording settings are locked while the camera is recording.</Note>}
    </div>
  )
}
