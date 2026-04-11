/**
 * Sony FX6 (ILME-FX6) — model specification.
 *
 * Status: STUB — unverified
 *
 * PTP version documented as PTP3 v1.0 (docs/research/ref-cameras.md).
 * No live-test confirmation of individual capability flags.
 * All capability flags default to false until confirmed by hardware test or SDK review.
 *
 * DO NOT wire this spec to any runtime gate until status is updated to 'confirmed'.
 */

import type { SonyModelSpec } from './types.js';

/** Zeroed capability block — all false by default for unverified stubs. */
const UNVERIFIED_CAPABILITIES = {
  iso: false,
  shutterSpeed: false,
  fNumber: false,
  exposureComp: false,
  recordingState: false,
  movieRecButton: false,
  batteryRemain: false,
  focusMode: false,
  mfNearFar: false,
  focusPosition: false,
  whiteBalance: false,
  colorTemp: false,
  wbTint: false,
  hdmiControl: false,
  hdmiTimecodeRecControl: false,
  lensInfo: false,
  tallyLamps: false,
  ndFilter: false,
  streaming: false,
  panTiltZoom: false,
} as const;

export const FX6_SPEC: SonyModelSpec = {
  name: 'FX6',
  modelIds: ['ILME-FX6'],
  ptpVersion: 'ptp3-v1.0',
  status: 'stub',
  capabilities: { ...UNVERIFIED_CAPABILITIES },

  notes: [
    'STUB — capabilities are unverified. Do not use for runtime capability gating.',
    'PTP3 v1.0 documented in ref-cameras.md. FX6 likely shares most FX30 PTP3 v1.0 props.',
    'FX6 has a built-in ND filter — ndFilter should be set to true once confirmed by live test.',
    'Update status to "confirmed" and fill capabilities after hardware test or SDK review.',
  ],
};
