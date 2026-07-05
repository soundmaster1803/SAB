/**
 * ExposureTab — full base exposure params with every mode switch.
 *
 * Steppers and M/A toggles fire LIVE, routed by the footer's apply target (so a
 * single ISO ▲ can hit one camera, all, or the selected set). ISO/iris/shutter
 * value steps are relative (delta) endpoints, so they only make sense live —
 * pushing an absolute ISO to a group is not something the backend exposes.
 *
 * The footer's "Apply exposure" commits the batchable ABSOLUTE / mode settings
 * (WB mode, focus mode, focus area, and an exact shutter value if typed) to the
 * chosen target — the "dial one camera, push the look to all" flow.
 */
import { useEffect, useState } from 'react'

import type { ApplyAction, ApplyTarget, TabProps } from './types'
import { Field, Sec, Note, StepRow, Select } from './parts'
import styles from './CameraSettingsModal.module.css'

const ISO_AUTO = 0x00ffffff

const FOCUS_MODES = ['MF', 'AF-S', 'AF-C', 'AF-A', 'DMF', 'AF-D', 'PF'] as const
const FOCUS_MODE_VALUES: Record<string, number> = {
  MF: 0x0001, 'AF-S': 0x0002, 'AF-C': 0x8004, 'AF-A': 0x8005, DMF: 0x8006, 'AF-D': 0x8008, PF: 0x8009,
}
const FOCUS_AREAS = ['Wide', 'Zone', 'Center', 'Flexible-S', 'Flexible-M', 'Flexible-L', 'Lock-on'] as const
const WB_MODES = ['AWB', 'Daylight', 'Cloudy', 'Color Temp', 'Custom'] as const
const SHUTTER_MODES = ['Speed', 'Angle', 'ECS', 'Auto'] as const

function focusNameFor(raw: number): (typeof FOCUS_MODES)[number] | '' {
  return FOCUS_MODES.find((n) => FOCUS_MODE_VALUES[n] === raw) ?? ''
}

export function ExposureTab({ cam, dispatch, register }: TabProps) {
  const id = cam.id
  const off = !cam.connected

  // ── Live-derived read state ──────────────────────────────────────────────────
  const isoAuto = cam.raw?.iso === ISO_AUTO || cam.iso === 'AUTO'
  const isoVal = cam.derived?.isoDisplay || cam.iso || '—'
  const shutterAuto = cam.derived?.shutterIsAuto ?? false
  const shutterVal = cam.derived?.shutterDisplay || cam.shutter || '—'
  const irisAuto = !cam.fnumber || cam.fnumber === '—'
  const irisVal = irisAuto ? 'Auto' : `f/${cam.fnumber}`
  const wbAuto = cam.derived?.wbIsAuto ?? false
  const colorTempVal = cam.derived?.colorTempDisplay || cam.colorTemp || '—'

  // ── Local (staged) selections that footer-apply commits ──────────────────────
  const [wbMode, setWbMode] = useState<string>(wbAuto ? 'AWB' : 'Color Temp')
  const [focusMode, setFocusMode] = useState<string>(focusNameFor(cam.raw?.focusMode ?? 0) || 'AF-C')
  const [focusArea, setFocusArea] = useState<string>('Wide')
  const [shutterModeSel, setShutterModeSel] = useState<string>(shutterAuto ? 'Auto' : 'Speed')
  const [shutterExact, setShutterExact] = useState('')
  const [tint, setTint] = useState(50) // local only — no tint endpoint yet
  const [focusPull, setFocusPull] = useState(50)

  // Keep selects in sync with live camera state when it changes underneath us.
  useEffect(() => { setWbMode(wbAuto ? 'AWB' : 'Color Temp') }, [wbAuto])
  useEffect(() => {
    const n = focusNameFor(cam.raw?.focusMode ?? 0)
    if (n) setFocusMode(n)
  }, [cam.raw?.focusMode])
  useEffect(() => { setShutterModeSel(shutterAuto ? 'Auto' : 'Speed') }, [shutterAuto])

  // ── Live control actions (routed by footer target) ───────────────────────────
  const adjust = (param: string, delta: 1 | -1, label: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/adjust`, body: { param, delta } },
    bulk: { op: 'adjust', params: { param, delta }, label },
  })
  const modeAction = (param: string, mode: 'auto' | 'manual', label: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/mode`, body: { param, mode } },
    bulk: { op: 'mode', params: { param, mode }, label },
  })
  const colorTempAction = (direction: 1 | -1): ApplyAction => ({
    single: { path: `/api/cameras/${id}/color-temp`, body: { direction } },
    bulk: { op: 'color-temp', params: { direction }, label: 'WB' },
  })
  const focusModeAction = (mode: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/focus-mode`, body: { mode } },
    bulk: { op: 'focus-mode', params: { mode }, label: 'Focus mode' },
  })
  const focusAreaAction = (area: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/focus-area`, body: { area } },
    bulk: { op: 'focus-area', params: { area }, label: 'Focus area' },
  })
  const afAction = (): ApplyAction => ({
    single: { path: `/api/cameras/${id}/af` },
    bulk: { op: 'af', params: {}, label: 'AF' },
  })
  const shutterSetAction = (value: string): ApplyAction => ({
    single: { path: `/api/cameras/${id}/shutter-set`, body: { value } },
    bulk: { op: 'shutter-set', params: { value }, label: 'Shutter' },
  })

  // Handlers that fire immediately to the current target.
  const onWbMode = (v: string) => {
    setWbMode(v)
    dispatch(modeAction('wb', v === 'AWB' ? 'auto' : 'manual', 'WB mode'))
  }
  const onFocusMode = (v: string) => { setFocusMode(v); dispatch(focusModeAction(v)) }
  const onFocusArea = (v: string) => { setFocusArea(v); dispatch(focusAreaAction(v)) }
  const onShutterMode = (v: string) => {
    setShutterModeSel(v)
    dispatch(modeAction('shutter', v === 'Auto' ? 'auto' : 'manual', 'Shutter mode'))
  }
  const commitShutterExact = () => {
    const v = shutterExact.trim()
    if (!v) return
    dispatch(shutterSetAction(v))
    setShutterExact('')
  }
  // Focus pull is per-lens — single camera only (no bulk equivalent).
  const sendFocusPull = (pos: number) => {
    dispatch({ single: { path: `/api/cameras/${id}/focus-position`, body: { position: Math.round((pos / 100) * 0xffff) } } })
  }

  // ── Footer "Apply exposure": batchable modes + exact shutter ─────────────────
  useEffect(() => {
    const build = (): ApplyAction[] => {
      const actions: ApplyAction[] = [
        modeAction('wb', wbMode === 'AWB' ? 'auto' : 'manual', 'WB mode'),
        focusModeAction(focusMode),
        focusAreaAction(focusArea),
        modeAction('shutter', shutterModeSel === 'Auto' ? 'auto' : 'manual', 'Shutter mode'),
      ]
      if (shutterExact.trim()) actions.push(shutterSetAction(shutterExact.trim()))
      return actions
    }
    register({
      apply: (force?: ApplyTarget) => {
        for (const a of build()) dispatch(force ? { ...a } : a)
        // `force` is applied by the modal-level dispatch via its target ref; here
        // we simply re-fire each action. Target override is handled by the modal.
      },
    })
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbMode, focusMode, focusArea, shutterModeSel, shutterExact])

  const showTemp = wbMode !== 'AWB'

  return (
    <div className={styles.pane}>
      {/* ISO / Gain */}
      <Field label="ISO / Gain">
        <StepRow
          mode={isoAuto ? 'auto' : 'manual'}
          onMode={(m) => dispatch(modeAction('iso', m, 'ISO mode'))}
          value={isoVal}
          onUp={() => dispatch(adjust('iso', 1, 'ISO'))}
          onDown={() => dispatch(adjust('iso', -1, 'ISO'))}
          disabled={off}
          stepDisabled={isoAuto}
        />
      </Field>

      <Sec>Shutter</Sec>
      <Field label="Mode">
        <Select value={shutterModeSel} onChange={onShutterMode} disabled={off}>
          {SHUTTER_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </Field>
      <Field label="Value">
        <StepRow
          mode={shutterAuto ? 'auto' : 'manual'}
          onMode={(m) => dispatch(modeAction('shutter', m, 'Shutter mode'))}
          value={shutterVal}
          onUp={() => dispatch(adjust('shutter', 1, 'Shutter'))}
          onDown={() => dispatch(adjust('shutter', -1, 'Shutter'))}
          disabled={off}
        />
      </Field>
      <Field label="Set exact">
        <div className={styles.selfake}>
          <input
            className={styles.tin}
            value={shutterExact}
            onChange={(e) => setShutterExact(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitShutterExact()}
            placeholder={shutterVal !== '—' ? String(shutterVal) : '1/100'}
            disabled={off}
          />
          <button type="button" className={styles.afbtn} onClick={commitShutterExact} disabled={off || !shutterExact.trim()}>
            Set
          </button>
        </div>
      </Field>
      {(shutterModeSel === 'Angle' || shutterModeSel === 'ECS') && (
        <Note>Angle / ECS is a per-body switch (0xD010) not yet wired — selecting it sets Manual.</Note>
      )}

      <Sec>Iris</Sec>
      <Field label="Aperture">
        <StepRow
          mode={irisAuto ? 'auto' : 'manual'}
          onMode={(m) => dispatch(modeAction('iris', m, 'Iris mode'))}
          value={irisVal}
          onUp={() => dispatch(adjust('fnumber', 1, 'Iris'))}
          onDown={() => dispatch(adjust('fnumber', -1, 'Iris'))}
          disabled={off}
          stepDisabled={irisAuto}
        />
      </Field>

      <Sec>White balance</Sec>
      <Field label="Mode">
        <Select value={wbMode} onChange={onWbMode} disabled={off}>
          {WB_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </Field>
      {showTemp && (
        <>
          <Field label="Color temp">
            <StepRow
              value={colorTempVal}
              onUp={() => dispatch(colorTempAction(1))}
              onDown={() => dispatch(colorTempAction(-1))}
              disabled={off}
            />
          </Field>
          <Field label="Tint (G–M)">
            <div className={styles.selfake}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={100}
                value={tint}
                style={{ '--v': `${tint}%` } as React.CSSProperties}
                onChange={(e) => setTint(+e.target.value)}
                aria-label="Tint"
                disabled={off}
              />
              <span className={styles.sliderVal}>{tint - 50 > 0 ? `+${tint - 50}` : tint - 50}</span>
            </div>
          </Field>
          <Note>Tint is a local preview only — no tint endpoint yet.</Note>
        </>
      )}

      <Sec>Focus</Sec>
      <Field label="Mode">
        <Select value={focusMode} onChange={onFocusMode} disabled={off}>
          {FOCUS_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
      </Field>
      <Field label="Area">
        <Select value={focusArea} onChange={onFocusArea} disabled={off}>
          {FOCUS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      </Field>
      <Field label="Manual pull">
        <div className={styles.selfake}>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={100}
            value={focusPull}
            style={{ '--v': `${focusPull}%` } as React.CSSProperties}
            onChange={(e) => setFocusPull(+e.target.value)}
            onPointerUp={(e) => sendFocusPull(+(e.currentTarget as HTMLInputElement).value)}
            aria-label="Focus pull"
            disabled={off}
          />
          <button type="button" className={styles.afbtn} onClick={() => dispatch(afAction())} disabled={off}>
            Push AF
          </button>
        </div>
      </Field>
      <Note>
        Value steps (ISO / shutter / iris) fire live to the apply target. "Apply exposure" pushes the
        modes (WB, focus, shutter) and any exact shutter to the target.
      </Note>
    </div>
  )
}
