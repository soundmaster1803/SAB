/**
 * demoData — fabricated cameras for Demo Mode so the operator UI can be explored
 * with no hardware. Values are plausible but static; the demo driver ticks a few
 * of them (record time, audio meters) to feel alive. No control action reaches a
 * real camera in demo mode.
 */
import type { CameraUIState, SonyRawState, SonyDerivedState, SonyAlertState, TallyCode } from '../../types/ws'

interface Spec {
  id: string; name: string; ip: string; model: string
  tally: TallyCode; connected?: boolean
  recState: number; recDurationSec: number; recRemainSec: number
  battery: number; batteryMinutes: number; powerSource: number
  iso: string; shutter: string; fnumber: string; colorTemp: string
  atemInput: number; atemControlEnabled: boolean
}

const SPECS: Spec[] = [
  { id: 'demo-1', name: 'Cam 1 · Stage L', ip: '10.0.0.21', model: 'ILME-FX30', tally: 1, recState: 1, recDurationSec: 767, recRemainSec: 2460, battery: 78, batteryMinutes: 118, powerSource: 2, iso: '2000', shutter: '1/50', fnumber: '2.8', colorTemp: '5600K', atemInput: 1, atemControlEnabled: true },
  { id: 'demo-2', name: 'Cam 2 · Wide', ip: '10.0.0.22', model: 'ILME-FX6', tally: 2, recState: 0, recDurationSec: 0, recRemainSec: 7440, battery: 92, batteryMinutes: 160, powerSource: 1, iso: 'AUTO', shutter: '1/50', fnumber: '4.0', colorTemp: 'AWB', atemInput: 2, atemControlEnabled: true },
  { id: 'demo-3', name: 'Cam 3 · Tight', ip: '10.0.0.23', model: 'PXW-Z200', tally: 0, recState: 0, recDurationSec: 0, recRemainSec: 3480, battery: 64, batteryMinutes: 200, powerSource: 2, iso: '800', shutter: '1/50', fnumber: '5.6', colorTemp: '6500K', atemInput: 3, atemControlEnabled: false },
  { id: 'demo-4', name: 'Cam 5 · ZV-E10 II', ip: '10.0.0.25', model: 'ZV-E10M2', tally: 0, recState: 0, recDurationSec: 0, recRemainSec: 1320, battery: 51, batteryMinutes: 72, powerSource: 2, iso: '1600', shutter: '1/60', fnumber: '3.5', colorTemp: 'AWB', atemInput: 5, atemControlEnabled: true },
]

function rawFor(s: Spec): SonyRawState {
  return {
    id: s.id, ip: s.ip, name: s.name, model: s.model, connected: s.connected ?? true,
    iso: s.iso === 'AUTO' ? 0x00ffffff : Number(s.iso) || 0, fnumber: Number(s.fnumber) * 100 || 0,
    shutter: 0x00010000 | 50, expComp: 0, colorTemp: 5600,
    battery: s.battery, powerSource: s.powerSource, batteryMinutes: s.batteryMinutes, charging: s.powerSource !== 2,
    recState: s.recState, recRemainSec: s.recRemainSec, recDurationSec: s.recDurationSec,
    slotStatus: 1, slotStatus2: 0, recRemainSec2: 0,
    movieFileFormat: 0x0e, movieFileFormatList: [0x0e, 0x0b, 0x09], recSetting: 0x21, recSettingList: [0x21, 0x20],
    recMedia: 1, recFrameRate: 0, recFrameRateList: [], tally: s.tally, fps: 25, lastUpdate: Date.now(),
    focusMode: 0x8004, afStatus: 0x02, focalDistanceM: 0, focalDistanceMin: 0, focalDistanceMax: 0,
    focalDistanceStep: 0, focalDistanceEnabled: false, focusPosition: 0x8000, nearFarEnable: 1,
    wbMode: s.colorTemp === 'AWB' ? 0x0002 : 0x8012, shutterMode: 0,
  }
}

function derivedFor(s: Spec): SonyDerivedState {
  return {
    isoDisplay: s.iso, shutterDisplay: s.shutter, fnumberDisplay: s.fnumber,
    colorTempDisplay: s.colorTemp === 'AWB' ? 'AWB' : s.colorTemp,
    expCompEv: 0, expCompDisplay: '0', focusModeDisplay: 'AF-C', afStatusDisplay: 'Focused',
    focalDistanceDisplay: '—', wbIsAuto: s.colorTemp === 'AWB', shutterIsAuto: false,
  }
}

function alertsFor(s: Spec): SonyAlertState {
  return {
    connectionLost: false,
    batterySeverity: s.battery < 15 ? 'critical' : s.battery < 30 ? 'low' : s.powerSource !== 2 ? 'charging' : 'ok',
    lowBattery: s.battery < 30, criticalBattery: s.battery < 15,
    recRemaining: s.recRemainSec > 600 ? 'ok' : s.recRemainSec > 120 ? 'low' : 'critical',
  }
}

export function buildDemoCameras(): CameraUIState[] {
  return SPECS.map((s) => ({
    id: s.id, ip: s.ip, name: s.name, model: s.model, connected: s.connected ?? true,
    iso: s.iso, shutter: s.shutter, fnumber: s.fnumber, colorTemp: s.colorTemp,
    expComp: 0, battery: s.battery, powerSource: s.powerSource, batteryMinutes: s.batteryMinutes,
    charging: s.powerSource !== 2, recState: s.recState, recRemainSec: s.recRemainSec, recDurationSec: s.recDurationSec,
    slotStatus: 1, slotStatus2: 0, recRemainSec2: 0, movieFileFormat: 0x0e, movieFileFormatList: [0x0e, 0x0b, 0x09],
    recSetting: 0x21, recSettingList: [0x21, 0x20], recMedia: 1, recFrameRate: 0, recFrameRateList: [],
    tally: s.tally, fps: 25, lastUpdate: Date.now(),
    raw: rawFor(s), derived: derivedFor(s), alerts: alertsFor(s),
    atemInput: s.atemInput, atemControlEnabled: s.atemControlEnabled,
  }))
}
