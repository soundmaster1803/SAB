import type { CameraManager } from '../../sony/manager';
import type { SonyPTPClient } from '../../sony/ptp-client';
import type { ATEMListener } from '../../atem/listener';
import type { AppConfig, CameraConfig } from '../../config';
import { PROP_CODES } from '../../sony/constants';
import { syncCameraStateToAtem as syncStateImpl } from '../../bridge/sync/atem-sync';

export const CAMERA_PROP_MAP: Record<string, number> = {
  iso: PROP_CODES.ISO,
  fnumber: PROP_CODES.FNUMBER,
  shutter: PROP_CODES.SHUTTER_SPEED,
  expComp: PROP_CODES.EXP_COMP,
  colorTemp: PROP_CODES.COLOR_TEMP,
};

export function isValidIpv4(value: string): boolean {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export function parseAtemInput(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) return null;
  return parsed;
}

export function findAtemInputConflict(config: AppConfig, atemInput: number, excludeId?: string): CameraConfig | undefined {
  return config.cameras.find(c => c.atemInput === atemInput && c.id !== excludeId);
}

export async function awaitCameraConnection(
  client: SonyPTPClient,
  timeoutMs: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise(resolve => {
    let settled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (value: { ok: true } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      client.off('stateUpdate', onUpdate);
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, error: 'Connection timeout (15s). Check camera IP and PTP/IP mode.' });
    }, timeoutMs);

    const onUpdate = () => {
      if (client.state.connected) {
        finish({ ok: true });
      }
    };
    client.on('stateUpdate', onUpdate);

    poll = setInterval(() => {
      if (client.state.connected) {
        finish({ ok: true });
      }
    }, 200);
  });
}

export function syncCameraInputToAtem(
  atemListener: ATEMListener,
  atemInput: number,
  client: SonyPTPClient,
): void {
  if (!client.state.connected || client.state.lastUpdate === 0) return;
  syncStateImpl(atemListener.atem, atemInput, client.state);
}

export function reconnectCamera(manager: CameraManager, config: CameraConfig): void {
  manager.removeCamera(config.id);
  manager.addCamera(config);
}
