/**
 * sony/polling/high-priority.ts
 *
 * High-priority poll cycle definition.
 *
 * Props in this tier are extracted on every poll cycle at ~200 ms.
 * These are the values critical for real-time operator display and bridge control:
 * exposure settings, recording state, battery level, and remaining record time.
 *
 * The poll blob (0x9209) is fetched here and stored as lastPollBlob for
 * the low-priority cycle to read without an additional PTP call.
 */

/** Interval in milliseconds for the high-priority poll cycle. */
export const HIGH_PRIORITY_INTERVAL_MS = 200;

/**
 * Prop codes extracted on every high-priority poll cycle.
 *
 * These must match what parseSonyProps() actively reads from the blob.
 * Any prop added here should have pollPriority: 'high' in prop-knowledge.ts.
 */
export const HIGH_PRIORITY_PROP_CODES: readonly number[] = [
  0xD21E, // ISO
  0xD20D, // Shutter speed
  0x5007, // F-number
  0x5010, // Exposure compensation
  0xD20F, // Color temperature
  0xD218, // Battery level
  0xD205, // Battery level icon (charging detection)
  0xD20E, // Battery step
  0xD21D, // Recording state
  0xD3C4, // Slot 3 remaining time
  0xD3C2, // Slot 1 remaining time
] as const;
