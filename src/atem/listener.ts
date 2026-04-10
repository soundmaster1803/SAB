import { Atem, Commands } from 'atem-connection'
import { EventEmitter } from 'events'
import type { CameraState } from '../sony/ptp-client'

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

  // Anti-feedback: after we push a sync to ATEM, ignore incoming commands for that source for 500ms.
  private syncCooldowns = new Map<number, number>()

  get atemModel(): string {
    return (this.atem.state as any)?.info?.deviceName ?? 'ATEM';
  }

  get inputCount(): number {
    return Object.keys(this.atem.state?.inputs ?? {})
      .map(Number).filter(n => n >= 1 && n <= 20).length;
  }

  constructor() {
    super()
    this.atem = new Atem()
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
      warn('Disconnected — will auto-reconnect')
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
    this.atem.connect(ip)
  }

  disconnect(): void {
    log('Disconnecting...')
    this.atem.removeAllListeners('disconnected')
    this.atem.disconnect().then(() => {
      this.connected = false
      log('Disconnected')
    }).catch(() => {
      this.connected = false
    })
    this.tallyBySource = {}
    // Recreate so a future connect() starts clean
    this.atem = new Atem()
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

  // Sync Sony camera state back to ATEM switcher (bi-directional).
  // Uses CameraControlCommand (CCmd) — the writable counterpart of CCdP.
  // Sets a 500ms cooldown to prevent the echo from triggering another Sony command.
  syncCameraStateToAtem(source: number, state: CameraState): void {
    const { CameraControlCommand, CameraControlDataType } = Commands
    const base = { boolData: [] as boolean[], bigintData: [] as bigint[], stringData: '', relative: false }

    // ISO — category=1, param=14, SINT32 direct value
    if (state.iso > 0 && (state.iso & 0x00FFFFFF) !== 0x00FFFFFF) {
      try {
        this.atem.sendCommand(new CameraControlCommand(source, 1, 14, {
          ...base,
          type: CameraControlDataType.SINT32,
          numberData: [state.iso],
        }))
      } catch (_e) {}
    }

    // Iris — category=0, param=2, FLOAT normalized 0.0–1.0 (1.0 = wide open)
    // fnumber is f*100 (e.g., 280 = f/2.8). Assume range f/1.0–f/22.
    if (state.fnumber > 0) {
      const fVal = state.fnumber / 100
      const iris = Math.max(0, Math.min(1, (22 - fVal) / 21))
      try {
        this.atem.sendCommand(new CameraControlCommand(source, 0, 2, {
          ...base,
          type: CameraControlDataType.FLOAT,
          numberData: [iris],
        }))
      } catch (_e) {}
    }

    // White Balance — category=1, param=2, SINT16 (Kelvin)
    if (state.colorTemp > 0) {
      try {
        this.atem.sendCommand(new CameraControlCommand(source, 1, 2, {
          ...base,
          type: CameraControlDataType.SINT16,
          numberData: [state.colorTemp],
        }))
      } catch (_e) {}
    }

    this.syncCooldowns.set(source, Date.now() + 500)
    log(`Sync→ATEM src=${source} iso=${state.iso} fnumber=${state.fnumber} colorTemp=${state.colorTemp}`)
  }

  private handleCameraControl(cmd: Commands.CameraControlUpdateCommand): void {
    if (Date.now() < this.readyAfter) return  // suppress initial state dump on connect
    const cooldown = this.syncCooldowns.get(cmd.source)
    if (cooldown && Date.now() < cooldown) return  // suppress echo from our own sync push

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
