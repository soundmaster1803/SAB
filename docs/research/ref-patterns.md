# CineLink — Code Patterns Reference

## 1. Packet Builder
```typescript
// Build PTP/IP packet
function buildPacket(type: number, payload: Buffer): Buffer {
  const buf = Buffer.allocUnsafe(8 + payload.length)
  buf.writeUInt32LE(8 + payload.length, 0)  // Length
  buf.writeUInt32LE(type, 4)                 // PacketType
  payload.copy(buf, 8)
  return buf
}

// Build OperationRequest (no data phase)
function buildOpRequest(opCode: number, txId: number, ...params: number[]): Buffer {
  const payload = Buffer.allocUnsafe(12 + params.length * 4)
  payload.writeUInt32LE(1, 0)        // DataPhase: no data
  payload.writeUInt32LE(opCode, 4)
  payload.writeUInt32LE(txId, 8)
  params.forEach((p, i) => payload.writeUInt32LE(p >>> 0, 12 + i * 4))
  return buildPacket(5, payload)
}

// Build OperationRequest (data out — client sends data)
function buildOpRequestWithData(opCode: number, txId: number, data: Buffer, ...params: number[]): Buffer[] {
  // 1. OperationRequest packet (DataPhase=2)
  const opPayload = Buffer.allocUnsafe(12 + params.length * 4)
  opPayload.writeUInt32LE(2, 0)
  opPayload.writeUInt32LE(opCode, 4)
  opPayload.writeUInt32LE(txId, 8)
  params.forEach((p, i) => opPayload.writeUInt32LE(p >>> 0, 12 + i * 4))

  // 2. StartDataPacket
  const startPayload = Buffer.allocUnsafe(8)
  startPayload.writeUInt32LE(txId, 0)
  startPayload.writeUInt32LE(data.length, 4)  // total data length

  // 3. DataPacket
  const dataPayload = Buffer.allocUnsafe(4 + data.length)
  dataPayload.writeUInt32LE(txId, 0)
  data.copy(dataPayload, 4)

  // 4. EndDataPacket
  const endPayload = Buffer.allocUnsafe(4)
  endPayload.writeUInt32LE(txId, 0)

  return [
    buildPacket(5, opPayload),
    buildPacket(9, startPayload),
    buildPacket(10, dataPayload),
    buildPacket(12, endPayload),
  ]
}
```

## 2. Response Parser
```typescript
// Parse incoming data into packets (handles partial reads)
class PacketParser {
  private buf = Buffer.alloc(0)

  feed(chunk: Buffer): Buffer[] {
    this.buf = Buffer.concat([this.buf, chunk])
    const packets: Buffer[] = []
    while (this.buf.length >= 8) {
      const len = this.buf.readUInt32LE(0)
      if (this.buf.length < len) break
      packets.push(this.buf.slice(0, len))
      this.buf = this.buf.slice(len)
    }
    return packets
  }
}

// Parse OperationResponse from packet payload (after 8-byte header)
function parseResponse(packet: Buffer): { code: number; txId: number; params: number[] } {
  const payload = packet.slice(8)
  const code = payload.readUInt32LE(0)
  const txId = payload.readUInt32LE(8)
  const params: number[] = []
  for (let i = 12; i + 4 <= payload.length; i += 4) {
    params.push(payload.readUInt32LE(i))
  }
  return { code, txId, params }
}

// Parse GetAllExtDevicePropInfo blob
interface PropInfo {
  code: number; dataType: number; getSet: number; isEnable: number
  formFlag: number; current: Buffer; defaultVal: Buffer
}
function parseAllProps(data: Buffer): Map<number, PropInfo> {
  const map = new Map<number, PropInfo>()
  let offset = 0
  const count = data.readUInt32LE(offset); offset += 4

  for (let i = 0; i < count; i++) {
    const code = data.readUInt16LE(offset); offset += 2
    const dataType = data.readUInt16LE(offset); offset += 2
    const getSet = data.readUInt8(offset++);
    const isEnable = data.readUInt8(offset++);
    const formFlag = data.readUInt8(offset++);
    const size = dataTypeSize(dataType)
    const defaultVal = data.slice(offset, offset + size); offset += size
    const current = data.slice(offset, offset + size); offset += size
    if (formFlag === 0x01) offset += size * 3       // range: min+max+step
    if (formFlag === 0x02) {
      const enumCount = data.readUInt16LE(offset); offset += 2
      offset += enumCount * size
    }
    map.set(code, { code, dataType, getSet, isEnable, formFlag, current, defaultVal })
  }
  return map
}

function dataTypeSize(type: number): number {
  switch (type) {
    case 0x0001: case 0x0002: return 1  // INT8/UINT8
    case 0x0003: case 0x0004: return 2  // INT16/UINT16
    case 0x0005: case 0x0006: return 4  // INT32/UINT32
    case 0x0007: case 0x0008: return 8  // INT64/UINT64
    default: return 4
  }
}
```

## 3. Polling Loop
```typescript
class PollLoop {
  private timer: NodeJS.Timeout | null = null
  private running = false

  start(intervalMs: number, fn: () => Promise<void>) {
    if (this.running) return
    this.running = true
    const tick = async () => {
      if (!this.running) return
      try { await fn() } catch { /* log, don't crash */ }
      if (this.running) this.timer = setTimeout(tick, intervalMs)
    }
    tick()
  }

  stop() {
    this.running = false
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }
}

// Usage in SonyPTPClient:
// this.poller.start(200, () => this.pollState())
```

## 4. Command Queue (serial, no overlap)
```typescript
import { EventEmitter } from 'events'

type CmdFn = () => Promise<void>

class CommandQueue extends EventEmitter {
  private queue: CmdFn[] = []
  private busy = false

  enqueue(cmd: CmdFn) {
    this.queue.push(cmd)
    this.drain()
  }

  private async drain() {
    if (this.busy) return
    this.busy = true
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!
      try { await fn() } catch (e) { this.emit('error', e) }
    }
    this.busy = false
  }
}
```

## 5. Sony SDIO_ControlDevice — Notch Helper
```typescript
// Send one notch step on a prop (INT8 ±1)
async function sendNotch(client: SonyPTPClient, propCode: number, step: -1 | 1): Promise<void> {
  // data = [TYPE=0x82][INT8 step]
  const data = Buffer.from([0x82, step < 0 ? 0xFF : 0x01])
  await client.controlDevice(propCode, data)
}

// Send multiple notch steps toward target
async function notchToTarget(
  client: SonyPTPClient, propCode: number,
  currentIdx: number, targetIdx: number, scale: number[]
): Promise<void> {
  const delta = targetIdx - currentIdx
  const dir = delta > 0 ? 1 : -1
  for (let i = 0; i < Math.abs(delta); i++) {
    await sendNotch(client, propCode, dir as -1 | 1)
    await sleep(30)  // Sony needs gap between notch steps
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
```

## 6. Sony MovieRec Button (Hold Mode)
```typescript
async function toggleMovieRec(client: SonyPTPClient): Promise<void> {
  // Button code 0x01 = MovieRec, Down=0x02, Up=0x03
  const down = Buffer.from([0x81, 0x01, 0x02])
  const up   = Buffer.from([0x81, 0x01, 0x03])
  await client.controlDevice(0xD2C8, down)
  await sleep(100)
  await client.controlDevice(0xD2C8, up)
}
```

## 7. WebSocket State Push
```typescript
import { WebSocketServer, WebSocket } from 'ws'

class WSServer {
  private wss: WebSocketServer
  private clients = new Set<WebSocket>()

  constructor(port: number) {
    this.wss = new WebSocketServer({ port })
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.on('close', () => this.clients.delete(ws))
      ws.on('message', (data) => this.handleMessage(ws, data))
    })
  }

  broadcast(payload: object) {
    const msg = JSON.stringify(payload)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg)
      }
    }
  }

  private handleMessage(ws: WebSocket, data: any) {
    try {
      const msg = JSON.parse(data.toString())
      // handle UI commands: { type: 'recordToggle', cameraId: 'cam1' }
    } catch { /* ignore malformed */ }
  }
}
```

## 8. Express HTTP Skeleton
```typescript
import express from 'express'
import path from 'path'

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend/dist')))

// Add camera
app.post('/api/cameras', async (req, res) => {
  const { id, name, ip, atm_slot } = req.body
  // validate, add to config, connect
  res.json({ ok: true })
})

// Remove camera
app.delete('/api/cameras/:id', async (req, res) => {
  // disconnect, remove from config
  res.json({ ok: true })
})

// Get full state
app.get('/api/state', (req, res) => {
  res.json(/* all camera states */)
})

app.listen(3000)
```

## 9. InitCommandRequest payload builder
```typescript
function buildInitCommandRequest(guid: Buffer, name: string): Buffer {
  // guid = 16 bytes, name = UTF-16LE null-terminated
  const nameBytes = Buffer.from(name + '\0', 'utf16le')
  const payload = Buffer.allocUnsafe(16 + nameBytes.length + 4)
  guid.copy(payload, 0)
  nameBytes.copy(payload, 16)
  payload.writeUInt32LE(0x00010000, 16 + nameBytes.length)  // protocol version
  return buildPacket(1, payload)
}

// Fixed GUID for CineLink:
const CLIENT_GUID = Buffer.from('CineLink00000000', 'ascii').slice(0, 16)
const CLIENT_NAME = 'CineLink Bridge'
```

## 10. Transaction ID Management
```typescript
class TxIdManager {
  private counter = 1
  next(): number {
    return this.counter++
  }
}
// One instance per SonyPTPClient. Never reuse IDs within same session.
```
