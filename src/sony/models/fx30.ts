/**
 * Sony FX30 (ILME-FX30 / ILME-FX30B) — model specification.
 *
 * Status: confirmed
 * PTP version: PTP3 v1.0+ (firmware-dependent; v1.3 tally requires fw 3.0+)
 *
 * Sources:
 *   - Sony CameraRemoteCommand SDK 2.00.02 (PTPDef.h, DevicePropItemList.h)
 *   - docs/research/ref-cameras.md
 *   - src/sony/constants.ts (KELVIN_SCALE comment confirms ColorTemp quirk)
 */

import type { SonyModelSpec } from './types.js';

export const FX30_SPEC: SonyModelSpec = {
  name: 'FX30',
  modelIds: ['ILME-FX30', 'ILME-FX30B'],
  ptpVersion: 'ptp3-v1.0',
  status: 'confirmed',

  capabilities: {
    // Exposure — all confirmed via SDK prop table
    iso: true,
    shutterSpeed: true,
    fNumber: true,
    exposureComp: true,

    // Recording — confirmed
    recordingState: true,
    movieRecButton: true,

    // Power / status — confirmed
    batteryRemain: true,

    // Focus — confirmed
    focusMode: true,
    mfNearFar: true,
    focusPosition: true, // PTP3 v1.0 — 0xD380/0xD381

    // White balance — confirmed
    whiteBalance: true,
    colorTemp: true, // FX30 does NOT enumerate ColorTemp as an enum; raw Kelvin via 0xD20F
    wbTint: true,   // 0xD21C (AB) + 0xD210 (GM)

    // HDMI — confirmed PTP3 v1.0 range (0xD3A0–0xD3A8)
    hdmiControl: true,
    hdmiTimecodeRecControl: true,

    // Lens info — confirmed PTP3 v1.0
    lensInfo: true,

    // Tally — PTP3 v1.3 only; FX30 requires firmware ≥ 3.0
    // Listed under v1.3 props in ref-cameras.md; FX30 is noted as "v1.0-v1.3 (fw-dependent)"
    tallyLamps: true,

    // ND filter — FX30 has NO built-in ND filter hardware
    ndFilter: false,

    // Streaming — PTP3 v1.2 props (0xD450+); FX30 is v1.0 base; unconfirmed on FX30
    streaming: false,

    // PTZ — FX30 is a shoulder/cinema camera, not a PTZ unit
    panTiltZoom: false,
  },

  notes: [
    'FX30 ColorTemp (0xD20F) returns raw Kelvin, not an enumerated list — use KELVIN_SCALE from constants.ts.',
    'Tally lamps (0xD513–0xD515) require firmware 3.0+. The tallyLamps flag may be overridden at runtime by prop presence check.',
    'FX30 firmware range is PTP3 v1.0–v1.3 depending on installed version.',
    'FX30 has no built-in ND filter. Do not expose ND actions for this model.',
  ],
};
