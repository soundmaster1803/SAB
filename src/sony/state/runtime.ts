import type { CameraState } from '../ptp-client';
import type { SonyRawState } from './raw';
import { deriveSonyState, type SonyDerivedState } from './derived';
import { deriveSonyAlerts, type SonyAlertState } from './alerts';

export interface SonyRuntimeState {
  raw: SonyRawState;
  derived: SonyDerivedState;
  alerts: SonyAlertState;
}

export function toSonyRawState(state: CameraState): SonyRawState {
  return {
    id: state.id,
    ip: state.ip,
    name: state.name,
    ...(state.model ? { model: state.model } : {}),
    connected: state.connected,
    iso: state.iso,
    fnumber: state.fnumber,
    shutter: state.shutter,
    expComp: state.expComp,
    colorTemp: state.colorTemp,
    battery: state.battery,
    powerSource: state.powerSource,
    batteryMinutes: state.batteryMinutes,
    charging: state.charging,
    recState: state.recState,
    recRemainSec: state.recRemainSec,
    tally: state.tally,
    ...(state.fps !== undefined ? { fps: state.fps } : {}),
    lastUpdate: state.lastUpdate,
    focusMode:      state.focusMode,
    afStatus:       state.afStatus,
    focalDistanceM: state.focalDistanceM,
  };
}

export function getSonyRuntimeState(state: CameraState): SonyRuntimeState {
  const raw = toSonyRawState(state);
  const derived = deriveSonyState(raw);
  const alerts = deriveSonyAlerts(raw, derived);
  return { raw, derived, alerts };
}
