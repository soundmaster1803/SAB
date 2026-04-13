/**
 * sony/polling/strategy.ts
 *
 * Capability-aware polling strategy.
 *
 * The polling system must not be statically hard-wired to camera names.
 * Poll priorities are derived from:
 *   1. Protocol knowledge layer (pollPriority field)
 *   2. Runtime camera model (which props the camera actually exposes)
 *   3. UI/alert criticality
 *
 * HIGH  (~200 ms)  — realtime exposure, rec state, battery, overheating
 * LOW   (~1 000 ms)— config/menu settings, focus mode, WB mode, display
 * ON_DEMAND        — BaseLook import, firmware, FTP, format, write-only ops
 * SKIP             — vendor markers, tally (write-only), format commands
 *
 * Unknown props are never polled at HIGH priority.
 * Unsupported props (not observed) are never polled at all.
 */

import type { RuntimeCameraModel } from '../runtime/types.js';

export type PollTier = 'high' | 'low' | 'on-demand' | 'skip';

/**
 * Get the effective poll priority for a prop code given the current runtime model.
 *
 * Returns 'skip' for:
 *   - Prop codes not observed from this camera
 *   - Vendor markers
 *   - Props explicitly marked skip in the knowledge layer
 *
 * Falls back to 'on-demand' for unknown props (observed but not in knowledge layer).
 */
export function getPollPriority(propCode: number, model: RuntimeCameraModel): PollTier {
  // Check known props first
  const knownProp = model.knownProps.get(propCode);
  if (knownProp) return knownProp.pollPriority;

  // Unknown but observed props: don't poll at high priority
  const unknownProp = model.unknownProps.get(propCode);
  if (unknownProp) return 'on-demand';

  // Not observed: skip
  return 'skip';
}

/**
 * Return true if a prop should be included in the HIGH-priority poll cycle.
 */
export function isHighPriority(propCode: number, model: RuntimeCameraModel): boolean {
  return model.highPriorityProps.includes(propCode);
}

/**
 * Return true if a prop should be included in the LOW-priority poll cycle.
 */
export function isLowPriority(propCode: number, model: RuntimeCameraModel): boolean {
  return model.lowPriorityProps.includes(propCode);
}

/**
 * Get the recommended poll intervals for this camera model.
 *
 * The runtime model does not yet support different physical poll intervals —
 * the current transport polls everything in one bulk call (0x9209).
 * This function expresses the intent for when the transport is split.
 */
export function getRecommendedPollIntervals(_model: RuntimeCameraModel): {
  highMs: number;
  lowMs: number;
} {
  return {
    highMs: 200,
    lowMs: 1000,
  };
}

/**
 * Compute a poll priority summary for all observed props in the runtime model.
 * Useful for debug endpoints and diagnostics.
 */
export function getPollSummary(model: RuntimeCameraModel): {
  high: number[];
  low: number[];
  onDemand: number[];
  skip: number[];
  unknown: number[];
} {
  return {
    high: [...model.highPriorityProps],
    low: [...model.lowPriorityProps],
    onDemand: [...model.onDemandProps],
    skip: [...model.skipProps],
    unknown: [...model.unknownProps.keys()].sort((a, b) => a - b),
  };
}

/**
 * Check whether a set of prop codes is safe to include in an automated
 * poll cycle (i.e. not in skip tier, not write-only, not dangerous).
 *
 * Returns the subset of codes that are safe to read automatically.
 */
export function filterSafeToRead(
  propCodes: number[],
  model: RuntimeCameraModel,
): number[] {
  return propCodes.filter(code => {
    const known = model.knownProps.get(code);
    if (!known) return false; // Not known or not observed → skip
    const tier = known.pollPriority;
    if (tier === 'skip') return false; // Explicitly excluded
    const safety = known.safety;
    if (safety === 'dangerous') return false; // Never auto-read dangerous props
    return true;
  });
}
