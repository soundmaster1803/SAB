/**
 * Sony PXW-Z200 — model specification.
 *
 * Status: confirmed
 *
 * PTP version documented as PTP3 v1.3 (docs/research/ref-cameras.md).
 * Capabilities below are derived conservatively from the Sony research corpus in this repo:
 * - knowledge/sony/models/pxw-z200.json
 * - knowledge/sony/capability-catalog.json
 * - docs/research/extract/ptp-device-properties-full-catalog-analysis.md
 */

import type { SonyModelSpec } from './types.js';

export const Z200_SPEC: SonyModelSpec = {
  name: 'PXW-Z200',
  modelIds: ['PXW-Z200'],
  ptpVersion: 'ptp3-v1.3',
  status: 'confirmed',
  capabilities: {
    iso: true,
    shutterSpeed: true,
    fNumber: true,
    exposureComp: true,
    recordingState: true,
    movieRecButton: false,
    batteryRemain: true,
    focusMode: true,
    mfNearFar: false,
    focusPosition: false,
    whiteBalance: true,
    colorTemp: true,
    wbTint: true,
    hdmiControl: false,
    hdmiTimecodeRecControl: false,
    lensInfo: false,
    tallyLamps: false,
    ndFilter: true,
    streaming: true,
    panTiltZoom: true,
  },

  notes: [
    'Confirmed conservatively from repo research artifacts; unknown items remain false until live test or narrower SDK evidence confirms them.',
    'Z200 is treated as a PTP3 v1.3 PTZ-capable camcorder, so panTiltZoom is enabled.',
    'Streaming and ND filter are enabled from the current Sony research corpus.',
    'movieRecButton, focusPosition, HDMI control, tally lamps, and lensInfo remain conservative until a narrower verification pass promotes them.',
  ],
};
