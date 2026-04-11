// Anti-loop: suppress incoming ATEM commands for a source for 500ms after
// we push a sync to ATEM. Prevents the echo from our own sync triggering
// a redundant Sony command.

const SYNC_COOLDOWN_MS = 500;

// Keyed by ATEM source input number (1-indexed). Value is expiry timestamp.
const syncCooldowns = new Map<number, number>();

/**
 * Mark source as in cooldown for SYNC_COOLDOWN_MS milliseconds.
 * Call immediately after pushing a sync command to ATEM.
 */
export function enterCooldown(source: number): void {
  syncCooldowns.set(source, Date.now() + SYNC_COOLDOWN_MS);
}

/**
 * Returns true if source is currently within the anti-loop cooldown window.
 * Incoming ATEM commands for this source should be suppressed while true.
 */
export function isInCooldown(source: number): boolean {
  const expiry = syncCooldowns.get(source);
  return expiry !== undefined && Date.now() < expiry;
}
