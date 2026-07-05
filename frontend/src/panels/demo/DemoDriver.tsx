/**
 * DemoDriver — when Demo Mode is on, seeds fabricated cameras + ATEM state into
 * the stores and ticks a few values (record time, audio, battery) so the UI feels
 * alive. Renders nothing. Mounted once in App.
 */
import { useEffect } from 'react'
import { useDemoStore } from '../../stores/demo'
import { useCamerasStore } from '../../stores/cameras'
import { useAtemStore } from '../../stores/atem'
import { buildDemoCameras } from './demoData'

export function DemoDriver() {
  const enabled = useDemoStore((s) => s.enabled)

  useEffect(() => {
    if (!enabled) return
    const setCameras = useCamerasStore.getState().setCameras
    let cams = buildDemoCameras()
    setCameras(cams)

    // Fake ATEM: connected, program on IN 1, preview on IN 2.
    const tally = Array.from({ length: 21 }, () => 0 as 0 | 1 | 2)
    tally[1] = 1; tally[2] = 2
    useAtemStore.getState().setAtemState({
      atemConnected: true, atemIp: '10.0.0.10', atemAutoReconnect: true,
      atemModel: 'ATEM Mini Pro (demo)', inputCount: 20,
      tally, topology: [], version: 'demo',
    })

    const t = setInterval(() => {
      cams = cams.map((c) => {
        const rec = c.recState === 1
        const recDur = rec ? c.recDurationSec + 1 : c.recDurationSec
        const recRem = rec ? Math.max(0, c.recRemainSec - 1) : c.recRemainSec
        return { ...c, recDurationSec: recDur, recRemainSec: recRem, raw: { ...c.raw, recDurationSec: recDur } }
      })
      setCameras(cams)
    }, 1000)

    return () => clearInterval(t)
  }, [enabled])

  return null
}
