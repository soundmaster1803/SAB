import { create } from 'zustand'
import type { TallyCode } from '../types/ws'

interface AtemStore {
  connected: boolean
  ip: string
  model: string
  inputCount: number
  /** Per-input tally codes, positionally ordered by topology. */
  tally: TallyCode[]
  /** Sorted camera input IDs. Positional index matches tally[]. */
  topology: number[]
  /** App version string from the last state message. */
  appVersion: string

  setAtemState: (state: {
    atemConnected: boolean
    atemIp: string
    atemModel: string
    inputCount: number
    tally: TallyCode[]
    topology: number[]
    version: string
  }) => void
}

export const useAtemStore = create<AtemStore>((set) => ({
  connected: false,
  ip: '',
  model: '',
  inputCount: 0,
  tally: [],
  topology: [],
  appVersion: '',

  setAtemState({ atemConnected, atemIp, atemModel, inputCount, tally, topology, version }) {
    set({
      connected: atemConnected,
      ip: atemIp,
      model: atemModel,
      inputCount,
      tally,
      topology,
      appVersion: version,
    })
  },
}))

/**
 * Selector: tally code for a given ATEM input number.
 * Returns 0 (no tally) if the input is not in the topology.
 */
export function tallyForInput(
  topology: number[],
  tally: TallyCode[],
  inputId: number,
): TallyCode {
  const idx = topology.indexOf(inputId)
  return idx === -1 ? 0 : (tally[idx] ?? 0)
}
