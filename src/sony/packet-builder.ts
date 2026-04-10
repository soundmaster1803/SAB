// DataPhase field in PTP/IP OperationRequest — values from working v60.py reference:
//   0 = no data phase   (commands with no payload in either direction)
//   1 = data-out        (host → device, e.g. SetExtDevicePropValue, ControlDevice)
//   2 = data-in         (device → host, e.g. GetAllExtDevicePropInfo, GetDeviceInfo)
export const DATA_PHASE_NONE  = 0;
export const DATA_PHASE_WRITE = 1;
export const DATA_PHASE_READ  = 2;

/**
 * Build a PTP/IP OperationRequest packet (type=6).
 * dataPhase: 0=no data, 1=write, 2=read (matches v60.py phase logic)
 */
export function buildOperationRequest(
  opcode: number,
  transactionId: number,
  params: number[] = [],
  dataPhase: number = DATA_PHASE_NONE,
): Buffer {
  const payloadSize = 6 + params.length * 4  // Opcode(2) + TransId(4) + params
  const totalSize = 12 + payloadSize          // Length(4) + Type(4) + DataPhase(4) + payload
  const buf = Buffer.alloc(totalSize)
  let o = 0
  buf.writeUInt32LE(totalSize, o); o += 4   // Length
  buf.writeUInt32LE(0x0006, o);   o += 4   // Type = OperationRequest
  buf.writeUInt32LE(dataPhase, o); o += 4  // DataPhase
  buf.writeUInt16LE(opcode, o);   o += 2   // Opcode
  buf.writeUInt32LE(transactionId, o); o += 4  // TransactionId
  for (const p of params) { buf.writeUInt32LE(p, o); o += 4 }
  return buf
}

/**
 * Build InitCommandRequest packet (type=1).
 */
export function buildInitCommandRequest(guid: Buffer, name: string): Buffer {
  const nameUtf16 = Buffer.from(name + '\0', 'utf16le')
  const totalLen = 8 + 16 + nameUtf16.length + 4
  const buf = Buffer.alloc(totalLen)
  buf.writeUInt32LE(totalLen, 0)
  buf.writeUInt32LE(0x0001, 4)        // Type = InitCommandRequest
  guid.copy(buf, 8)                    // GUID 16 bytes
  nameUtf16.copy(buf, 24)             // Name UTF-16LE
  buf.writeUInt32LE(0x00010000, 24 + nameUtf16.length)  // ProtocolVersion
  return buf
}

/**
 * Build InitEventRequest packet (type=3).
 */
export function buildInitEventRequest(sessionId: number): Buffer {
  const buf = Buffer.alloc(12)
  buf.writeUInt32LE(12, 0)
  buf.writeUInt32LE(0x0003, 4)  // Type = InitEventRequest
  buf.writeUInt32LE(sessionId, 8)
  return buf
}

/**
 * Build a write-data operation: OperationRequest + StartData + Data + EndData.
 * Used for SDIO_ControlDevice and SDIO_SetExtDevicePropValue.
 */
export function buildOperationRequestWithData(
  opcode: number,
  transactionId: number,
  params: number[],
  data: Buffer,
): Buffer[] {
  // 1. OperationRequest with DataPhase=write
  const req = buildOperationRequest(opcode, transactionId, params, DATA_PHASE_WRITE)

  // 2. StartData [Length:4][Type:4=9][TransId:4][TotalDataLen:8]
  const startData = Buffer.alloc(20)
  startData.writeUInt32LE(20, 0)
  startData.writeUInt32LE(0x0009, 4)
  startData.writeUInt32LE(transactionId, 8)
  startData.writeBigUInt64LE(BigInt(data.length), 12)

  // 3. Data packet [Length:4][Type:4=0x0A][TransId:4][Data...]
  const dataPacket = Buffer.alloc(12 + data.length)
  dataPacket.writeUInt32LE(12 + data.length, 0)
  dataPacket.writeUInt32LE(0x000A, 4)
  dataPacket.writeUInt32LE(transactionId, 8)
  data.copy(dataPacket, 12)

  // 4. EndData [Length:4][Type:4=0x0C][TransId:4] — no payload
  const endData = Buffer.alloc(12)
  endData.writeUInt32LE(12, 0)
  endData.writeUInt32LE(0x000C, 4)
  endData.writeUInt32LE(transactionId, 8)

  return [req, startData, dataPacket, endData]
}
