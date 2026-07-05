/**
 * AudioTab — per-channel input select, level mode, and gain, written via the
 * generic prop endpoint (confirmed PTP3 audio codes). Live VU meters need the
 * camera video stream (not a pollable prop), so they show as placeholders.
 */
import { useState } from 'react'
import type { ApplyAction, TabProps } from './types'
import { Field, Sec, Note, Select } from './parts'
import styles from './CameraSettingsModal.module.css'

const INPUTS: Record<string, number> = {
  'Off': 0x01, 'INPUT1 (XLR)': 0x02, 'INPUT2': 0x03, 'Internal MIC': 0x04, 'Shoe': 0x05,
}
const LEVEL: Record<string, number> = { 'Manual': 0x02, 'Auto': 0x01 }

// prop codes: CH1 input 0xE051, CH2 0xE052; CH1 level 0xE048, CH2 0xE049; CH1 gain 0xE04C, CH2 0xE04D.
const CH = [
  { n: 'CH1', input: 0xe051, level: 0xe048, gain: 0xe04c },
  { n: 'CH2', input: 0xe052, level: 0xe049, gain: 0xe04d },
]

export function AudioTab({ cam, dispatch }: TabProps) {
  const id = cam.id
  const off = !cam.connected
  const [state, setState] = useState(() =>
    CH.map(() => ({ input: 'INPUT1 (XLR)', level: 'Manual', gain: 60 })),
  )

  const propAction = (code: number, value: number, label: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/prop`, body: { code, value, force: true } },
    bulk: { op: 'prop', params: { code, value, force: true }, label },
  })
  const setCh = (i: number, patch: Partial<{ input: string; level: string; gain: number }>) =>
    setState((s) => s.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  return (
    <div className={styles.pane}>
      {CH.map((ch, i) => (
        <div key={ch.n}>
          <Sec>{ch.n}</Sec>
          <Field label="Input">
            <Select
              value={state[i].input}
              onChange={(v) => { setCh(i, { input: v }); dispatch(propAction(ch.input, INPUTS[v] ?? 0, `${ch.n} input`)) }}
              disabled={off}
            >
              {Object.keys(INPUTS).map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Level">
            <Select
              value={state[i].level}
              onChange={(v) => { setCh(i, { level: v }); dispatch(propAction(ch.level, LEVEL[v] ?? 0, `${ch.n} level`)) }}
              disabled={off}
            >
              {Object.keys(LEVEL).map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Gain">
            <div className={styles.selfake}>
              <input
                type="range" className={styles.slider} min={0} max={100} value={state[i].gain}
                style={{ '--v': `${state[i].gain}%` } as React.CSSProperties}
                onChange={(e) => setCh(i, { gain: +e.target.value })}
                onPointerUp={() => dispatch(propAction(ch.gain, Math.round((state[i].gain / 100) * 0xffff), `${ch.n} gain`))}
                aria-label={`${ch.n} gain`} disabled={off || state[i].level === 'Auto'}
              />
              <span className={styles.sliderVal}>{state[i].gain}%</span>
            </div>
          </Field>
        </div>
      ))}
      <Note>Live meters require the camera video stream and are not shown here yet. Input select, level mode and gain are direct device controls (also MIC/LINE type &amp; wind filter via All properties).</Note>
    </div>
  )
}
