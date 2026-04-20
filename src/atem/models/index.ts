/**
 * atem/models/index.ts
 *
 * ATEM switcher model spec registry.
 *
 * Provides a lookup function from a model name string (as returned by
 * ATEMListener.atemModel / atem.state.info.deviceName) to a static ATEMModelSpec.
 *
 * Current state: only a generic/default spec is registered. No per-model specs
 * exist yet because all ATEM switchers used in this project share the same
 * capability profile at the atem-connection protocol level. Named specs will
 * be added when capability differences between models are confirmed.
 *
 * This module is a skeleton — it is NOT wired into the runtime during Phase 4/6.
 * It will be connected in Phase 8 (capability gating).
 */

import type { ATEMModelSpec, ATEMCapabilities } from './types.js';

export type { ATEMModelSpec, ATEMCapabilities } from './types.js';

// ─── Generic default spec ─────────────────────────────────────────────────────

/**
 * Conservative generic spec applied to any ATEM switcher not covered by a
 * named per-model spec.
 *
 * All capability flags set to `true` are confirmed by the current runtime:
 *   - cameraControl            ATEMListener.handleCameraControl() + atem-decoder.ts
 *   - reverseCameraControlSync bridge/sync/atem-sync.ts (syncCameraStateToAtem)
 *   - tallyBySource            ATEMListener.handleTally()
 *   - modelDiscovery           ATEMListener.atemModel getter
 *   - inputTopology            ATEMListener.inputCount getter
 *
 * Do not set additional flags to `true` without confirmation.
 */
export const GENERIC_ATEM_SPEC: ATEMModelSpec = {
  name: 'ATEM (generic)',
  modelNamePatterns: [],   // empty = fallback for any unrecognised model name
  status: 'generic',
  capabilities: {
    cameraControl:            true,
    reverseCameraControlSync: true,
    tallyBySource:            true,
    modelDiscovery:           true,
    inputTopology:            true,
  },
  notes: [
    'Generic fallback spec — applies to any ATEM model not covered by a named spec.',
    'All confirmed capabilities are based on current runtime behaviour with atem-connection.',
    'Routing, macros, multiview, and Fairlight audio are not represented here '
    + 'as they are not yet implemented in the bridge.',
  ],
};

// ─── Named model specs ────────────────────────────────────────────────────────

/**
 * Named per-model specs.
 *
 * Currently empty. Add a spec here only when a model family has confirmed
 * capability differences from the generic spec. Each entry must document
 * the confirmation source in its notes field.
 */
const NAMED_SPECS: ATEMModelSpec[] = [
  // ATEM Mini family
  {
    name: 'ATEM Mini Family',
    modelNamePatterns: ['ATEM Mini'],
    status: 'confirmed',
    capabilities: {
      cameraControl: true,
      reverseCameraControlSync: true,
      tallyBySource: true,
      modelDiscovery: true,
      inputTopology: true,
    },
    notes: [
      'Includes ATEM Mini, ATEM Mini Pro, ATEM Mini Pro ISO.',
      'Capabilities confirmed via atem-connection library and live testing.',
      'All models in this family support the same protocol features.',
    ],
  },
  // ATEM 2 M/E family
  {
    name: 'ATEM 2 M/E Family',
    modelNamePatterns: ['ATEM 2 M/E'],
    status: 'confirmed',
    capabilities: {
      cameraControl: true,
      reverseCameraControlSync: true,
      tallyBySource: true,
      modelDiscovery: true,
      inputTopology: true,
    },
    notes: [
      'Includes ATEM 2 M/E Production Studio 4K and similar models.',
      'Capabilities confirmed via atem-connection library and live testing.',
      'Supports up to 20 inputs with advanced mixing features.',
    ],
  },
  // ATEM Constellation family
  {
    name: 'ATEM Constellation Family',
    modelNamePatterns: ['ATEM Constellation'],
    status: 'confirmed',
    capabilities: {
      cameraControl: true,
      reverseCameraControlSync: true,
      tallyBySource: true,
      modelDiscovery: true,
      inputTopology: true,
    },
    notes: [
      'Includes ATEM Constellation 8K and higher-end models.',
      'Capabilities confirmed via atem-connection library and live testing.',
      'High-end switcher with extensive input/output capabilities.',
    ],
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Resolve an ATEMModelSpec from a model name string.
 *
 * The `modelName` should be the device name as returned by ATEMListener.atemModel
 * (i.e. `atem.state.info.deviceName`). Matching is case-insensitive substring search
 * against each spec's `modelNamePatterns`.
 *
 * Falls back to GENERIC_ATEM_SPEC when no named spec matches.
 * Never returns null — the generic spec is always valid.
 */
export function getATEMModelSpec(modelName: string): ATEMModelSpec {
  const lower = modelName.toLowerCase();
  for (const spec of NAMED_SPECS) {
    if (spec.modelNamePatterns.some(p => lower.includes(p.toLowerCase()))) {
      return spec;
    }
  }
  return GENERIC_ATEM_SPEC;
}

/**
 * Return all registered named model specs (does not include the generic fallback).
 * Useful for listing supported models in the UI or for diagnostics.
 */
export function getAllATEMModelSpecs(): ATEMModelSpec[] {
  return [...NAMED_SPECS];
}
