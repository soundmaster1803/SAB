/**
 * Sony ZV-E10 II (ILCE-ZV-E10M2) — model specification.
 *
 * Status: confirmed
 * PTP version: PTP3 v1.2
 *
 * Sources:
 *   - Sony CameraRemoteCommand SDK 2.00.02 (PTPDef.h, DevicePropItemList.h)
 *   - docs/research/ref-cameras.md (explicitly listed as PTP3 v1.2)
 *   - docs/research/ref-sony.md
 */

import type { SonyModelSpec } from './types.js';

export const ZVE10M2_SPEC: SonyModelSpec = {
  name: 'ZV-E10 II',
  modelIds: ['ILCE-ZV-E10M2'],
  ptpVersion: 'ptp3-v1.2',
  status: 'confirmed',

  capabilities: {
    // Exposure — all confirmed via SDK prop table (PTP2 base props, all v1.2 cameras)
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
    focusPosition: true, // PTP3 v1.0+ — 0xD380/0xD381

    // White balance — confirmed
    whiteBalance: true,
    colorTemp: true,
    wbTint: true, // 0xD21C (AB) + 0xD210 (GM)

    // HDMI — PTP3 v1.0 range; ZV-E10 II is v1.2 (superset of v1.0)
    // NOTE: ZV-E10 II has an HDMI port but tally/rec-control via PTP is unconfirmed by live test.
    // Keeping true based on PTP version hierarchy — override if live test contradicts.
    hdmiControl: true,
    hdmiTimecodeRecControl: false, // unconfirmed for this model — conservative default

    // Lens info — PTP3 v1.0+ — confirmed by version
    lensInfo: true,

    // Tally — PTP3 v1.3 only; ZV-E10 II is v1.2, no tally hardware
    tallyLamps: false,

    // ND filter — ZV-E10 II has no built-in ND filter
    ndFilter: false,

    // Streaming — PTP3 v1.2 confirmed for ZV-E10 II (0xD450–0xD45B, 0xD511)
    streaming: true,

    // PTZ — ZV-E10 II is a mirrorless camera, not a PTZ unit
    panTiltZoom: false,
  },

  notes: [
    'ZV-E10 II is PTP3 v1.2 — includes streaming props (0xD450–0xD45B, 0xD511).',
    'ZV-E10 II has no built-in ND filter. Do not expose ND actions for this model.',
    'hdmiTimecodeRecControl is conservatively false — not confirmed by live test on this model.',
    'ZV-E10 mk1 (ILCE-ZV-E10, without M2 suffix) is PTP2 only and requires a separate spec.',
  ],
};
