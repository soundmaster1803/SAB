/**
 * DeviceTab — per-camera identity & ATEM link. Name / IP / ATEM input / control
 * mode are PATCHed to this one camera (not batchable). Remove deletes the camera
 * and closes the modal.
 */
import { useEffect, useState } from 'react'
import type { ApplyTarget, TabProps } from './types'
import { Field, Sec, Note } from './parts'
import { patch, del } from '../../../lib/api'
import styles from './CameraSettingsModal.module.css'

interface Props extends TabProps {
  onClose: () => void
}

export function DeviceTab({ cam, register, onClose }: Props) {
  const id = cam.id
  const [name, setName] = useState(cam.name)
  const [ip, setIp] = useState(cam.ip)
  const [atemInput, setAtemInput] = useState(String(cam.atemInput ?? 0))
  const [control, setControl] = useState(cam.atemControlEnabled ? 'linked' : 'off')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => { setName(cam.name); setIp(cam.ip) }, [cam.name, cam.ip])
  useEffect(() => { setAtemInput(String(cam.atemInput ?? 0)) }, [cam.atemInput])

  // Footer "Apply device" — PATCH this camera's config (single only).
  useEffect(() => {
    register({
      apply: (_force?: ApplyTarget) => {
        const body: Record<string, unknown> = {}
        if (name.trim() && name !== cam.name) body.name = name.trim()
        if (ip.trim() && ip !== cam.ip) body.ip = ip.trim()
        const inNum = Number(atemInput)
        if (Number.isInteger(inNum) && inNum !== cam.atemInput) body.atemInput = inNum
        const ctrl = control === 'linked'
        if (ctrl !== cam.atemControlEnabled) body.atemControlEnabled = ctrl
        if (Object.keys(body).length > 0) patch(`/api/cameras/${id}`, body).catch(() => {})
      },
    })
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ip, atemInput, control])

  function remove() {
    del(`/api/cameras/${id}`).catch(() => {})
    onClose()
  }

  return (
    <div className={styles.pane}>
      <Field label="Name">
        <input className={styles.tin} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="IP address">
        <input className={styles.tin} value={ip} onChange={(e) => setIp(e.target.value)} inputMode="decimal" autoComplete="off" />
      </Field>
      <Field label="Model">
        <span className={styles.staticVal}>{cam.model ?? 'Sony camera'}</span>
      </Field>

      <Sec>ATEM link</Sec>
      <Field label="ATEM input">
        <input
          className={styles.tin}
          value={atemInput}
          onChange={(e) => setAtemInput(e.target.value.replace(/[^0-9]/g, ''))}
          inputMode="numeric"
          placeholder="1–20, 0 = none"
        />
      </Field>
      <Field label="Control">
        <select className={styles.select} value={control} onChange={(e) => setControl(e.target.value)}>
          <option value="linked">Linked (control + tally)</option>
          <option value="off">Tally only</option>
        </select>
      </Field>
      <Note>Name / IP / ATEM changes apply to this camera only — use the Save button below.</Note>

      <Sec>Danger zone</Sec>
      <Field label="Remove">
        {!confirmDel ? (
          <div className={styles.selfakeSpread}>
            <span className={styles.staticVal}>Unpair this camera</span>
            <button type="button" className={`${styles.afbtn} ${styles.danger}`} onClick={() => setConfirmDel(true)}>
              Remove…
            </button>
          </div>
        ) : (
          <div className={styles.confirmBox}>
            <div className={styles.confirmText}>Remove “{cam.name}” from SAB?</div>
            <div className={styles.confirmBtns}>
              <button type="button" className={styles.afbtn} onClick={() => setConfirmDel(false)}>Cancel</button>
              <button type="button" className={`${styles.afbtn} ${styles.danger}`} onClick={remove}>Remove</button>
            </div>
          </div>
        )}
      </Field>
    </div>
  )
}
