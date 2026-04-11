/**
 * Sony PXW-Z200 — model specification.
 *
 * Status: STUB — unverified
 *
 * PTP version documented as PTP3 v1.3 (docs/research/ref-cameras.md).
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

export const Z200_SPEC: SonyModelSpec = {
  name: 'PXW-Z200',
  modelIds: ['PXW-Z200'],
  ptpVersion: 'ptp3-v1.3',
  status: 'stub',
  capabilities: { ...UNVERIFIED_CAPABILITIES },

  notes: [
    'STUB — capabilities are unverified. Do not use for runtime capability gating.',
    'PTP3 v1.3 documented in ref-cameras.md. Z200 may support PTZ (0xD504+) and tally lamps (0xD513+).',
    'Z200 is a camcorder — panTiltZoom may not apply despite being v1.3. Confirm via hardware test.',
    'Update status to "confirmed" and fill capabilities after hardware test or SDK review.',
  ],
};
