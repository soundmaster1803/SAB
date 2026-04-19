import { create } from 'zustand'
import type { WsMessage } from '../types/ws'
import { useCamerasStore } from './cameras'
import { useAtemStore } from './atem'
import { useLogsStore } from './logs'

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

interface WsStore {
  status: WsStatus
  /** Start the WS connection and reconnect loop. Idempotent — safe to call once. */
  connect: () => void
}

// ─── WS URL ───────────────────────────────────────────────────────────────────

function getWsUrl(): string {
  if (import.meta.env.DEV) return 'ws://localhost:7777'
  return `ws://${window.location.host}`
}

// ─── Message dispatch ─────────────────────────────────────────────────────────

function dispatch(msg: WsMessage): void {
  if (msg.type === 'state') {
    useCamerasStore.getState().setCameras(msg.cameras)
    useAtemStore.getState().setAtemState({
      atemConnected: msg.atemConnected,
      atemIp: msg.atemIp,
      atemAutoReconnect: msg.atemAutoReconnect,
      atemModel: msg.atemModel,
      inputCount: msg.inputCount,
      tally: msg.tally,
      topology: msg.topology,
      version: msg.version,
    })
    return
  }
  if (msg.type === 'logs') {
    useLogsStore.getState().appendLogs(msg.entries)
    return
  }
}

// ─── Reconnect loop ───────────────────────────────────────────────────────────

const RECONNECT_DELAY_MS = 3000

let _started = false

function startLoop(setStatus: (s: WsStatus) => void): void {
  const url = getWsUrl()
  setStatus('connecting')

  const ws = new WebSocket(url)

  ws.addEventListener('open', () => {
    setStatus('connected')
  })

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string) as WsMessage
      dispatch(msg)
    } catch {
      // Malformed message — ignore silently.
    }
  })

  ws.addEventListener('close', () => {
    setStatus('disconnected')
    setTimeout(() => startLoop(setStatus), RECONNECT_DELAY_MS)
  })

  ws.addEventListener('error', () => {
    // 'error' always precedes 'close' — let the close handler restart.
    ws.close()
  })
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWsStore = create<WsStore>((set) => ({
  status: 'disconnected',

  connect() {
    if (_started) return
    _started = true
    startLoop((status) => set({ status }))
  },
}))
