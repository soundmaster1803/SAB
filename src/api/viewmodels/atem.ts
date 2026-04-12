import type { ATEMListener } from '../../atem/listener';
import { deriveATEMState } from '../../atem/state/derived';

export function uiAtemState(atemListener: ATEMListener) {
  const raw = atemListener.getRawState();
  const derived = deriveATEMState(raw);

  return {
    connected: raw.connected,
    model: raw.model,
    inputCount: raw.knownInputIds.length,
    topology: derived.topology,
    tally: derived.tally,
    raw,
    derived,
  };
}
