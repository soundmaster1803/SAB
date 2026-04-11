# Sony PTP/IP — Compact Reference

## Transport
- TCP port 15740, two connections: Command socket + Event socket
- Little-Endian byte order everywhere
- Session established per power cycle; survives brief cable drops only

## Packet Structure
```
[Length: 4 LE][PacketType: 4 LE][Payload...]
```
PacketType values:
```
1 = InitCommandRequest    (client→camera, open command channel)
2 = InitCommandAck        (camera→client)
3 = InitEventRequest      (client→camera, open event channel)
4 = InitEventAck          (camera→client)
5 = OperationRequest      (client→camera, PTP command)
6 = OperationResponse     (camera→client)
7 = Event                 (camera→client, async notify)
9 = StartDataPacket       (client→camera, data phase start)
10 = DataPacket           (client→camera, data payload)
12 = EndDataPacket        (client→camera, data phase end)
13 = StartDataPacket      (camera→client)
14 = DataPacket           (camera→client)
```

## InitCommandRequest payload
```
[GUID: 16 bytes][Name: UTF-16LE null-term][ProtocolVersion: 4 LE = 0x00010000]
```

## OperationRequest payload
```
[DataPhase: 4 LE][OpCode: 4 LE][TransactionID: 4 LE][Param1: 4 LE]...[ParamN: 4 LE]
DataPhase: 1=no data, 2=data out (client sends), 3=data in (camera sends)
```

## OperationResponse payload
```
[ResponseCode: 4 LE][SessionID: 4 LE][TransactionID: 4 LE][Param1...]
ResponseCode 0x2001 = OK
```

## Event payload (PacketType=7)
```
[EventCode: 4 LE][SessionID: 4 LE][TransactionID: 4 LE][Param1: 4 LE]
EventCode 0x4006 = DevicePropChanged (Param1 = propCode)
```

## SDIO_Connect Sequence (CORRECT — from SDK CaptureDlg.cpp + authentication.sh)
```
1. OpenSession(SessionID=1)
2. SDIOConnect(p1=1, p2=0, p3=0)          OpCode=0x9201
3. SDIOConnect(p1=2, p2=0, p3=0)          OpCode=0x9201
4. SDIOGetExtDeviceInfo(version=0xC8)      OpCode=0x9202
   → loop until response[0..1] = 0xC800 (i.e. first UINT16 = 0x00C8)
5. SDIOConnect(p1=3, p2=0, p3=0)          OpCode=0x9201
6. Sleep(200ms)
```
GetExtDeviceInfo response is a blob; check first 2 bytes. On older cameras may return 0 bytes first — keep looping (max ~5 retries, 50ms apart).

## Key Opcodes
```
0x1001  GetDeviceInfo
0x1002  OpenSession        param1=SessionID
0x9201  SDIO_Connect       param1=phase(1/2/3), param2=0, param3=0
0x9202  SDIO_GetExtDeviceInfo  param1=version (0x00C8 = 200)
0x9205  SDIO_SetExtDevicePropValue  param1=propCode  + data phase
0x9207  SDIO_ControlDevice          param1=propCode  + data phase
0x9209  SDIO_GetAllExtDevicePropInfo  no params, response = all props blob
```

## SDIO_GetAllExtDevicePropInfo (0x9209) — Polling
Poll every 200ms. Response is a blob of property records:
```
[Count: 4 LE][PropRecord × Count]
PropRecord:
  [PropCode: 2 LE][DataType: 2 LE][GetSet: 1][IsEnable: 1][FormFlag: 1]
  [Default: <DataType> bytes][Current: <DataType> bytes]
  if FormFlag=0x01 (Range): [Min][Max][Step]
  if FormFlag=0x02 (Enum): [Count: 2 LE][Value × Count]
```
IsEnable: 0x00=valid, 0x01=invalid, 0x02=display-only

## SDIO_SetExtDevicePropValue (0x9205) — Direct Set
Data phase: raw value in DataType width (LE). Use for props that accept absolute values.
```
Example set ISO 400:
  OpCode=0x9205, param1=0xD21E
  data = [0x90, 0x01, 0x00, 0x00]  // UINT32 LE: 400
```

## SDIO_ControlDevice (0x9207) — Notch/Button
Data phase format (PTP/IP only — NOT USB):
```
[SDI_CONTROL_TYPE: 1][Value bytes...]
```
SDI_CONTROL_TYPE:
```
0x81 = Button   data=[BUTTON_CODE: 1][0x00]  (2 bytes total after type)
0x82 = Notch    data=[INT8 step]              (1 byte after type)
0x83 = Lock     data=[0x01=lock|0x00=unlock]
```

Button codes (for type=0x81):
```
0x01 = MovieRec (record button)
0x07 = S1 (AF/AE lock, half press)
0x08 = S2 (shutter full press)
0x09 = AEL
0x0E = Focus Magnifier
0x14 = Still Image (not for movie models)
```
Button send: Down (0x02) → delay 100ms → Up (0x03)
MovieRec is Hold mode: Down → delay → Up (camera toggles)

Notch (0x82): differential step ±1 per call. INT8: +1=increase one step, -1=decrease one step.
Used for: ISO (0xD21E), ShutterSpeed (0xD20D), FNumber (0x5007), ExpComp (0x5010)

## Property Value Encoding

### ShutterSpeed 0xD20D — UINT32
```
value = (numerator << 16) | denominator
"1/100" → (1 << 16) | 100 = 0x00010064
"1/250" → (1 << 16) | 250 = 0x000100FA
"1/4000"→ (1 << 16) | 4000 = 0x00010FA0
"1/2"  → (1 << 16) | 2   = 0x00010002
"1"    → (1 << 16) | 1   = 0x00010001
"2"    → (2 << 16) | 10  = 0x0002000A  (2 = numerator, denom=10 means "×0.1s"?)
BULB   → 0xFFFFFFFF
```
Decode: `num = (v >> 16) & 0xFFFF; den = v & 0xFFFF; str = num===1 ? "1/"+den : num+'"'`

### FNumber 0x5007 — UINT16
```
value = f-number × 100
f/1.8 → 180, f/2.8 → 280, f/4.0 → 400, f/5.6 → 560
```

### ExpComp 0x5010 — INT16 (confirmed from DevicePropItemList.h)
```
value = EV × 1000
+1.0 EV → 1000 (0x03E8)
+0.3 EV → 300  (0x012C)
 0.0    → 0
-1.0 EV → -1000 (0xFC18 as int16)
-5.0 EV → -5000
Range: -5000 to +5000 in steps of 333 (1/3 EV)
```

### ISO 0xD21E — UINT32
Direct ISO value: 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200, 102400
Auto ISO: 0xFFFFFF (check IsEnable for auto state)

### Battery 0xD218 — UINT8
0–100 percent remaining

### RecState 0xD21D — UINT8
0x00 = idle, 0x01 = recording, 0x02 = standby/waiting

### MovieRecButton 0xD2C8 — UINT16
Read via polling. 0x0000 = not pressed, 0x0002 = held down (use RecState for actual state)

## Decode Helpers (TypeScript)
```typescript
function decodeShutter(v: number): string {
  if (v === 0xFFFFFFFF) return 'BULB';
  const num = (v >> 16) & 0xFFFF;
  const den = v & 0xFFFF;
  if (num === 1) return `1/${den}`;
  return `${num}"`;  // bulb-style slow
}

function decodeFNumber(v: number): string {
  return `f/${(v / 100).toFixed(1)}`;
}

function decodeExpComp(v: number): string {
  // v is INT16, interpret as signed
  const signed = v > 0x7FFF ? v - 0x10000 : v;
  return (signed / 1000).toFixed(1);
}

function decodeISO(v: number): string {
  return v === 0xFFFFFF ? 'AUTO' : String(v);
}
```

## PTP2 vs PTP3 Detection
After GetAllExtDevicePropInfo, check if propCode 0xD3B0 (LensModelName) is present in the response. If yes → PTP3 camera. If not → PTP2. Also check SDKVersion from GetDeviceInfo data phase.

## Error Handling
- ResponseCode ≠ 0x2001: log and retry (transient), or disconnect after N retries
- Socket timeout (default 5s): close both sockets, reconnect
- GetAllExtDevicePropInfo returns 0 bytes: camera not ready, retry after 500ms
- SDIO_Connect phase 2 returns non-OK: auth failed, model not supported
