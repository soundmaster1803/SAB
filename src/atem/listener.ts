import { Atem, Commands } from 'atem-connection'
import { EventEmitter } from 'events'
import type { ATEMRawState } from './state/raw'

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string)  { console.log(`[${ts()}] [ATEM] ${msg}`); }
function warn(msg: string) { console.warn(`[${ts()}] [ATEM] WARN: ${msg}`); }

// atem-connection v3.x already fully parses CameraControlUpdateCommand.
// NOTE: TallyBySourceCommand.applyToState() returns [] and does NOT update
// atem.state — tally must be captured from receivedCommands manually.

export interface ATEMCameraControl {
  source: number      // camera input 1-indexed
  category: number
  parameter: number
  type: number        // CameraControlDataType
  numberData: number[]
  boolData: boolean[]
}

export interface TallyEntry {
  program: boolean
  preview: boolean
}

export class ATEMListener extends EventEmitter {
  atem: Atem
  connected = false

  // Tally keyed by source input number (1-indexed)
  tallyBySource: Record<number, TallyEntry> = {}

  // Suppress bridge commands for 2s after connect — ATEM dumps its full state
  // on every connect which contains stale/bogus values.
  private readyAfter = 0

  // Flag to prevent auto-reconnect when manually disconnected
  private manualDisconnect = false

  // Config for auto-reconnect
  private autoReconnect: boolean

  get atemModel(): string {
    const info = (this.atem.state as any)?.info;
    return info?.productIdentifier ?? info?.deviceName ?? 'ATEM';
  }

  get inputCount(): number {
    return Object.keys(this.atem.state?.inputs ?? {})
      .map(Number).filter(n => n >= 1 && n <= 20).length;
  }

  constructor(autoReconnect = true) {
    super()
    this.autoReconnect = autoReconnect
    // disableMultithreaded: true — prevents threadedClass from spawning a worker
    // process via file path resolution, which breaks in esbuild bundles.
    // Runs AtemSocket inline (same thread) instead — functionally identical.
    this.atem = new Atem({ disableMultithreaded: true })
    this._wireAtem()
    log('ATEMListener ready')
  }

  private _wireAtem(): void {
    this.atem.on('connected', () => {
      this.connected = true
      log('Connected ✓ (bridge commands suppressed for 3s)')
    })

    this.atem.on('disconnected', () => {
      this.connected = false
      if (this.manualDisconnect) {
        log('Disconnected (manual)')
        this.manualDisconnect = false
      } else if (this.autoReconnect) {
        warn('Disconnected — will auto-reconnect')
      } else {
        warn('Disconnected — auto-reconnect disabled')
      }
    })

    this.atem.on('receivedCommands', (cmds) => {
      for (const cmd of cmds) {
        if (cmd instanceof Commands.CameraControlUpdateCommand) {
          this.handleCameraControl(cmd)
        }
        // TallyBySourceCommand does not apply to state — capture here
        if (cmd instanceof Commands.TallyBySourceCommand) {
          this.handleTally(cmd)
        }
      }
    })
  }

  connect(ip: string): void {
    log(`Connecting to ${ip}...`)
    this.readyAfter = Date.now() + 3000  // pre-set BEFORE connect to suppress initial state dump
    this.atem.connect(ip).catch((e: any) => {
      warn(`connect() error: ${e.message}`)
    })
  }

  disconnect(): void {
    log('Disconnecting...')
    this.manualDisconnect = true
    this.atem.removeAllListeners('disconnected')
    Promise.resolve(this.atem.disconnect()).then(() => {
      this.connected = false
      log('Disconnected')
    }).catch(() => {
      this.connected = false
    })
    this.tallyBySource = {}
    // Recreate so a future connect() starts clean
    this.atem = new Atem({ disableMultithreaded: true })
    this._wireAtem()
    this.connected = false
    log('ATEM disconnected (new instance ready for reconnect)')
  }

  private handleTally(cmd: Commands.TallyBySourceCommand): void {
    // Data is in cmd.properties (not cmd.sources) in atem-connection v3.x
    const sources = (cmd as any).properties as Record<number, TallyEntry>
    if (!sources) return

    let changed = false
    for (const [srcStr, val] of Object.entries(sources)) {
      const src = Number(srcStr)
      const prev = this.tallyBySource[src]
      if (!prev || prev.program !== val.program || prev.preview !== val.preview) {
        this.tallyBySource[src] = val
        changed = true
      }
    }

    if (changed) {
      const active = Object.entries(this.tallyBySource)
        .filter(([, v]) => v.program || v.preview)
        .map(([k, v]) => `${k}:${v.program ? 'PGM' : 'PVW'}`)
        .join(' ')
      log(`Tally update${active ? ': ' + active : ' (all clear)'}`)
      this.emit('tallyUpdate', this.tallyBySource)
    }
  }

  getRawState(): ATEMRawState {
    return {
      connected: this.connected,
      model: this.atemModel,
      knownInputIds: Object.keys(this.atem.state?.inputs ?? {})
        .map(Number)
        .filter(n => n >= 1 && n <= 20)
        .sort((a, b) => a - b),
      tallyBySource: { ...this.tallyBySource },
      readyAfterMs: this.readyAfter,
    }
  }

  private handleCameraControl(cmd: Commands.CameraControlUpdateCommand): void {
    const props = cmd.properties

    // Skip empty/status-only packets (no actual data)
    if (props.numberData.length === 0 && props.boolData.length === 0 && props.bigintData.length === 0) {
      return
    }

    const control: ATEMCameraControl = {
      source:     cmd.source,
      category:   cmd.category,
      parameter:  cmd.parameter,
      type:       props.type,
      numberData: props.numberData,
      boolData:   props.boolData,
    }

    this.emit('cameraControl', control)
  }
}
