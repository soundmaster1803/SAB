/**
 * sony/polling/low-priority.ts
 *
 * Low-priority poll cycle definition.
 *
 * Props in this tier are extracted at ~1000 ms by reading the cached
 * lastPollBlob from the most recent high-priority cycle. No additional
 * PTP call is issued — the blob is always fresh enough for these values.
 *
 * These are configuration and menu-state props that change infrequently
 * and do not need to be reflected in the UI at realtime cadence.
 *
 * NOTE: SonyRawState does not yet carry fields for these props.
 * They will be added in Phase 8 when action gating is wired.
 * This file establishes the structural boundary now.
 */

/** Interval in milliseconds for the low-priority poll cycle. */
export const LOW_PRIORITY_INTERVAL_MS = 1000;

/**
 * Prop codes that belong to the low-priority poll tier.
 *
 * These props have pollPriority: 'low' in prop-knowledge.ts.
 * Extraction from the blob runs at 1000 ms cadence, not 200 ms.
 */
export const LOW_PRIORITY_PROP_CODES: readonly number[] = [
  0x5005, // White balance mode
  0x500A, // Focus mode
  0x500B, // Metering mode
  0x500E, // Exposure mode (M / A / S / P)
  0x5013, // Drive mode
  0xD160, // Recording media (slot selection)
  0xD241, // Movie file format
  0xD242, // Recording setting (fps + bitrate)
  0xD286, // Rec frame rate
  0xD248, // Media slot 1 status
  0xD256, // Media slot 2 status
  0xD258, // Media slot 2 remaining recordable time
] as const;
