# ATEM Camera Control — Compact Reference

## Library
```
npm install atem-connection @atem-connection/camera-control
```
Version: atem-connection ^4.x (NRK Sofie TV Automation)

## Connect and Listen
```typescript
import { Atem } from 'atem-connection'

const atem = new Atem({ debugBuffers: false })
atem.connect('192.168.x.x')  // UDP 9910

atem.on('connected', () => { /* ready */ })
atem.on('disconnected', () => { /* handle */ })
atem.on('error', (err) => { /* handle */ })
```

## Receiving Camera Control Commands
```typescript
import { Commands } from 'atem-connection'

atem.on('receivedCommands', (commands: Commands.IDeserializedCommand[]) => {
  for (const cmd of commands) {
    if (cmd instanceof Commands.CameraControlUpdateCommand) {
      handleCameraControl(cmd)
    }
  }
})
```

## CameraControlUpdateCommand Structure
```typescript
cmd.cameraId: number          // 1-based ATEM input number (1=cam1, 2=cam2...)
cmd.commandId: number         // unique per packet
cmd.category: number          // what type of parameter
cmd.parameter: number         // which specific property
cmd.type: number              // data type (0=void, 1=bool, 2=int8, 3=int16, 4=int32, 5=float, 128=string)
cmd.boolValues?: boolean[]
cmd.int8Values?: number[]
cmd.int16Values?: number[]
cmd.int32Values?: number[]
cmd.floatValues?: number[]    // normalized 0.0–1.0 range for most continuous params
cmd.stringValue?: string
```

## Category + Parameter Reference
Category 0 — Lens:
```
param 0 = Focus          float[0] = 0.0–1.0 (0=near, 1=far)
param 1 = AutoFocus      void (trigger)
param 2 = Iris (aperture) float[0] = 0.0–1.0 (0=closed, 1=open)
param 3 = AutoIris       void (trigger)
param 9 = Zoom           float[0] = 0.0–1.0
```

Category 1 — Video:
```
param 0 = WB             int16[0]=mode, int16[1]=tint
param 1 = Exposure (gain/ISO)  int16[0]=gain in dB (integer), OR floatValues
param 5 = Shutter speed  int32[0]=speed numerator, int32[1]=denominator
           OR float[0]=0.0–1.0 (check type field)
param 6 = ISO            int32[0]=ISO value directly
param 8 = ND filter      float[0]=0.0–1.0 (0=clear, 1=max)
```

Category 4 — Display/Output: (mostly read-only status)
```
param 0 = Video mode     int8[0]=fps, int8[1]=format
```

Category 6 — Reference:
```
param 0 = Source         int8[0]=0(internal),1(program),2(external)
```

Category 8 — Color Correction:
```
param 0 = Lift RGBA      float[0..3] (-2.0 to +2.0 each)
param 1 = Gamma RGBA     float[0..3]
param 2 = Gain RGBA      float[0..3]
param 3 = Offset RGBA    float[0..3]
param 4 = Contrast       float[0]=pivot(0–1), float[1]=adjust(0–2)
param 5 = Luma mix       float[0]=0–1
param 6 = Hue/Sat        float[0]=hue(-1 to 1), float[1]=sat(0–2)
```

Category 11 — Extended Lens:
```
param 0 = Focus near/far int8[0]= -1(near) / +1(far) / 0(stop)
param 1 = AutoFocus
param 2 = Aperture normalized  float[0]
param 3 = AutoIris
param 9 = Zoom speed     int8[0]= -1..+1
```

## Recording Control
ATEM triggers recording via its own transport control, NOT via camera control commands.
Use TransportInfoCommand / MediaPlayerStatusCommand for record state.
In practice: map ATEM "record" to Sony PTP MovieRec button via separate logic.

## Sending Commands to Camera (from Node.js)
Not needed for CineLink Bridge (we only receive). But if needed:
```typescript
import { AtemCameraControlDirectCommandSender } from '@atem-connection/camera-control'
const sender = new AtemCameraControlDirectCommandSender(atem)
await sender.setLens(cameraId, { focus: 0.5 })
await sender.setColorCorrection(cameraId, { lift: { r:0, g:0, b:0, a:0 } })
```

## State Builder (optional — tracks current values)
```typescript
import { AtemCameraControlStateBuilder } from '@atem-connection/camera-control'
const builder = new AtemCameraControlStateBuilder()
// feed commands into it:
builder.applyCommand(cmd)
const state = builder.getState(cameraId)  // current known state per camera
```

## ATEM Input → Camera Mapping
ATEM inputs 1–8 correspond to physical SDI/HDMI inputs. Camera Control sends to camera at input N. Map this to Sony camera IP via config:
```json
{ "atm_slot": 1, "camera_id": "cam1" }
```

## Key Behaviors
- Commands arrive as bursts during user control (joystick/panel)
- Iris/Focus/Zoom commands stream continuously while being adjusted
- Each floatValue is 0.0–1.0 normalized — must convert to Sony scale
- Multiple params may arrive in same command burst (same category)
- cameraId is 1-indexed; always subtract 1 or use mapping table

## Connection State
```typescript
atem.status  // AtemConnectionStatus enum: 'disconnected'|'connecting'|'connected'
```
Auto-reconnect: atem-connection handles internally.
Manual reconnect if needed: call `atem.connect(ip)` again after disconnect event.
