/**
 * Sony model spec registry.
 *
 * Provides a lookup function from a camera model identifier (as reported by
 * PTP GetDeviceInfo or SDIO_GetExtDeviceInfo) to its static SonyModelSpec.
 *
 * This module is a skeleton — it is NOT wired into the runtime during Phase 4.
 * It will be connected in Phase 8 (capability gating).
 */

import type { SonyModelSpec } from './types.js';
import { FX30_SPEC } from './fx30.js';
import { ZVE10M2_SPEC } from './zve10m2.js';
import { FX6_SPEC } from './fx6.js';
import { Z200_SPEC } from './z200.js';

export type { SonyModelSpec, SonyCapabilities, SonyPtpVersion } from './types.js';

/** All registered model specs. */
const MODEL_SPECS: SonyModelSpec[] = [
  FX30_SPEC,
  ZVE10M2_SPEC,
  FX6_SPEC,
  Z200_SPEC,
];

/**
 * Resolve a SonyModelSpec from a model identifier string.
 *
 * The `modelId` should be the model name as returned by GetDeviceInfo or as
 * stored in the camera record (e.g. "ILME-FX30", "ILCE-ZV-E10M2").
 *
 * Returns `null` if no spec is registered for the given identifier.
 * Callers must handle the null case — do not fall back to a default spec.
 */
export function getSonyModelSpec(modelId: string): SonyModelSpec | null {
  for (const spec of MODEL_SPECS) {
    if (spec.modelIds.includes(modelId)) {
      return spec;
    }
  }
  return null;
}

/**
 * Return all registered model specs (confirmed and stubs).
 * Useful for listing supported models in the UI or for diagnostics.
 */
export function getAllSonyModelSpecs(): SonyModelSpec[] {
  return MODEL_SPECS;
}
