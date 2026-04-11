// Throttle: one Sony command per camera per parameter per 200 ms.
// Prevents overwhelming the camera when ATEM sends 25+ updates/sec.

const lastCmdTime = new Map<string, number>();
const CMD_THROTTLE_MS = 200;

export function canSend(camId: string, param: string): boolean {
  const key = `${camId}:${param}`;
  const now  = Date.now();
  if (now - (lastCmdTime.get(key) ?? 0) < CMD_THROTTLE_MS) return false;
  lastCmdTime.set(key, now);
  return true;
}
