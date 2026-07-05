/**
 * LookTab — picture look & color. Each control writes a device property via the
 * generic prop endpoint (POST /prop / bulk op `prop`), so it applies to one
 * camera or the whole group like everything else. Enum values are the confirmed
 * PTP3 wire codes. `force:true` because picture-profile props are config-level.
 */
import { useState } from 'react'
import type { ApplyAction, TabProps } from './types'
import { Field, Sec, Note, Select } from './parts'
import styles from './CameraSettingsModal.module.css'

// Confirmed enum maps (label → wire value) from the PTP3 catalog.
const MONITOR_LUT: Record<string, number> = { 'Off': 0x01, 'On': 0x02 }
const CREATIVE_LOOK: Record<string, number> = {
  'ST Standard': 0x0001, 'PT Portrait': 0x0002, 'NT Neutral': 0x0003, 'VV Vivid': 0x0004,
  'FL Film': 0x0006, 'IN Instant': 0x0007,
}
const PP_GAMMA: Record<string, number> = {
  'Movie': 0x0001, 'Still': 0x0002, 'S-Cinetone': 0x0003, 'Cine1': 0x0101, 'Cine2': 0x0102, 'Cine4': 0x0104,
}

const PROP = { monitorLut: 0xd04d, creativeLook: 0xd0fa, ppGamma: 0xd0e1, ppBlack: 0xd0e0, ppSat: 0xd0ea }

export function LookTab({ cam, dispatch }: TabProps) {
  const id = cam.id
  const off = !cam.connected

  const [lut, setLut] = useState('On')
  const [look, setLook] = useState('ST Standard')
  const [gamma, setGamma] = useState('S-Cinetone')
  const [black, setBlack] = useState(50)
  const [sat, setSat] = useState(50)

  const propAction = (code: number, value: number, label: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/prop`, body: { code, value, force: true } },
    bulk: { op: 'prop', params: { code, value, force: true }, label },
  })
  const enumField = (code: number, label: string, set: (v: string) => void, map: Record<string, number>) =>
    (v: string) => { set(v); dispatch(propAction(code, map[v] ?? 0, label)) }
  // Sliders map 0-100 → INT8 -128..127 for black/saturation.
  const toInt8 = (pct: number) => Math.round((pct / 100) * 254) - 127

  return (
    <div className={styles.pane}>
      <Field label="Monitor LUT">
        <Select value={lut} onChange={enumField(PROP.monitorLut, 'Monitor LUT', setLut, MONITOR_LUT)} disabled={off}>
          {Object.keys(MONITOR_LUT).map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>
      <Field label="Creative look">
        <Select value={look} onChange={enumField(PROP.creativeLook, 'Creative look', setLook, CREATIVE_LOOK)} disabled={off}>
          {Object.keys(CREATIVE_LOOK).map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>

      <Sec>Picture profile</Sec>
      <Field label="Gamma">
        <Select value={gamma} onChange={enumField(PROP.ppGamma, 'PP gamma', setGamma, PP_GAMMA)} disabled={off}>
          {Object.keys(PP_GAMMA).map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>
      <Field label="Black level">
        <div className={styles.selfake}>
          <input
            type="range" className={styles.slider} min={0} max={100} value={black}
            style={{ '--v': `${black}%` } as React.CSSProperties}
            onChange={(e) => setBlack(+e.target.value)}
            onPointerUp={() => dispatch(propAction(PROP.ppBlack, toInt8(black), 'PP black'))}
            aria-label="Black level" disabled={off}
          />
          <span className={styles.sliderVal}>{black - 50 > 0 ? `+${black - 50}` : black - 50}</span>
        </div>
      </Field>
      <Field label="Saturation">
        <div className={styles.selfake}>
          <input
            type="range" className={styles.slider} min={0} max={100} value={sat}
            style={{ '--v': `${sat}%` } as React.CSSProperties}
            onChange={(e) => setSat(+e.target.value)}
            onPointerUp={() => dispatch(propAction(PROP.ppSat, toInt8(sat), 'PP saturation'))}
            aria-label="Saturation" disabled={off}
          />
          <span className={styles.sliderVal}>{sat - 50 > 0 ? `+${sat - 50}` : sat - 50}</span>
        </div>
      </Field>
      <Note>Look changes fire to the current apply target. Values are read back from the camera on the next poll (live read of PP values is model-dependent).</Note>
    </div>
  )
}
