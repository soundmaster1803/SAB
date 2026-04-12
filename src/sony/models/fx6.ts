/**
 * Sony FX6 (ILME-FX6) — model specification.
 *
 * Status: confirmed
 *
 * PTP version documented as PTP3 v1.0 (docs/research/ref-cameras.md).
 * Capabilities below are derived conservatively from the Sony research corpus in this repo:
 * - knowledge/sony/models/ilme-fx6.json
 * - knowledge/sony/capability-catalog.json
 * - docs/research/extract/ptp-device-properties-full-catalog-analysis.md
 */

import type { SonyModelSpec } from './types.js';

export const FX6_SPEC: SonyModelSpec = {
  name: 'FX6',
  modelIds: ['ILME-FX6'],
  ptpVersion: 'ptp3-v1.0',
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
    lensInfo: true,
    tallyLamps: false,
    ndFilter: true,
    streaming: false,
    panTiltZoom: false,
  },

  notes: [
    'Confirmed conservatively from repo research artifacts; unknown items remain false until live test or narrower SDK evidence confirms them.',
    'FX6 has a built-in variable ND filter, so ndFilter is enabled.',
    'Lens info, white balance, color temperature, exposure, recording-state, and battery flags are backed by the current Sony research corpus.',
    'movieRecButton, focusPosition, HDMI control, tally lamps, and streaming remain conservative until a narrower verification pass promotes them.',
  ],
};
