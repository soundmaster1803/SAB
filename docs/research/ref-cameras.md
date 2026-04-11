# ref-cameras.md — Sony Camera Models + SDK Real Data
# Source: Sony CameraRemoteCommand SDK 2.00.02 (source code + PDFs)

## ⚠ КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ к ref-sony.md

### SDIO_Connect — правильная последовательность (из CaptureDlg.cpp)
```
SDIOConnect(p1=1, p2=0, p3=0)       ← НЕ (1,0,0) (1,1,0) (2,1,0) как было раньше
SDIOConnect(p1=2, p2=0, p3=0)
SDIOGetExtDeviceInfo(0xC8)           ← loop пока ответ не начнётся с 0xC800
SDIOConnect(p1=3, p2=0, p3=0)
Sleep(200ms)
```

### ShutterSpeed (0xD20D) — реальный формат (из DevicePropItemList.h)
```
UINT32: (numerator << 16) | denominator
0x00010064 = "1/100"    (1/100s)
0x000100FA = "1/250"    (1/250s)
0x000107D0 = "1/2000"   (1/2000s)
0x00FA000A = "25"       (25.0s = 250/10)
0x0064000A = "10"       (10.0s = 100/10)
0x0050000A = "8"        (8.0s = 80/10)

decode: num=(raw>>16), den=(raw&0xFFFF)
display: num==1 ? "1/"+den : (num/den).toFixed(1)+"s"
```

### ExpComp (0x5010) — реальный формат (из DevicePropItemList.h)
```
INT16, value = EV × 1000
  0x0000 =  0.0 EV
  0x012C = +0.3 EV  (300)
  0x01F4 = +0.5 EV  (500)
  0x03E8 = +1.0 EV  (1000)
  0x07D0 = +2.0 EV  (2000)
  0x1388 = +5.0 EV  (5000)
  0xFED4 = -0.3 EV  (-300)
  0xFC18 = -1.0 EV  (-1000)
  0xF830 = -2.0 EV  (-2000)
  0xEC78 = -5.0 EV  (-5000)
Range: ±5.0 EV (±15 units в 1/3 EV шаги но хранится в 1/1000 EV)
```

### FNumber (0x5007) — подтверждено
```
UINT16, value = f × 100
  0x0064 = f/1.0   (100)
  0x008C = f/1.4   (140)
  0x0118 = f/2.8   (280)
  0x0230 = f/5.6   (560)
  0x0320 = f/8.0   (800)
  0x0898 = f/22.0  (2200)
```

### SDIOControlDevice — Windows USB vs PTP/IP (ВАЖНО!)
Windows SDK (USB/WIA) не имеет байта SDI_CONTROL_TYPE. Значения UP/DOWN:
- ISO/Shutter/FNumber: UP=0x0001, DOWN=0x00FF
- ExpComp/FlashComp:  UP=0x0001, DOWN=0x00F1
- Buttons (MovieRec, S1, S2): UP=0x0001, DOWN=0x0002

**Для нашего PTP/IP (TCP):** сохраняем структуру [TYPE byte][Value]:
- Notch: [0x82][INT8 step] где +1=вверх, -1=вниз
- Button: [0x81][UINT16] 0x0001=UP, 0x0002=DOWN

---

## Совместимость моделей (PTP2 vs PTP3)

### PTP2 only (старый протокол, до 2020)
Только опкоды 0x9201-0x9209, свойства 0x50xx и 0xD2xx

| Модель | Примечание |
|--------|-----------|
| ZV-E10 mk1 (ILCE-ZV-E10) | PTP2 только |
| Alpha A6000, A6100, A6400, A6600 | PTP2 |
| Alpha A7 (original, II, III, IV) | PTP2 |
| Alpha A7R (original, II, III, IV) | PTP2 |
| Alpha A7S (original, II) | PTP2 |
| Alpha A9 (original) | PTP2 |
| RX100 (все версии до M7A) | PTP2 |
| ZV-1 (оригинал) | PTP2 |

### PTP3 v1.0+ (2020-2022)
Добавляет: HDMI контроль, информация о линзе, фокус по позиции, slot3 медиа

| Модель | Примечание |
|--------|-----------|
| Alpha 1 (ILCE-1) | PTP3 v1.0 |
| Alpha 7C II (ILCE-7CM2) | PTP3 v1.0 |
| Alpha 7R IV A (ILCE-7RM4A) | PTP3 v1.0 |
| ILME-FX6 | PTP3 v1.0 |
| FX30 (ILME-FX30) | PTP3 v1.0+ (возможно v1.3) |

### PTP3 v1.2+ (2022-2024)
Добавляет: стриминг (H.264/H.265), FTP передача, расширенные настройки

| Модель | Примечание |
|--------|-----------|
| ZV-E10 II (ILCE-ZV-E10M2) | PTP3 v1.2 |
| Alpha 1 II (ILCE-1M2) | PTP3 v1.2 |
| ILME-FX3A | PTP3 v1.2 |
| ILME-FR7 | PTP3 v1.2 (PTZ камера) |
| DSC-RX100M7A | PTP3 v1.2 |
| ZV-1A | PTP3 v1.2 |

### PTP3 v1.3+ (2024+)
Добавляет: Pan-Tilt-Zoom (0xD500+), Tally лампы, E-framing

| Модель | Примечание |
|--------|-----------|
| BRC-AM7 (PTZ) | PTP3 v1.3 |
| HXR-NX800 | PTP3 v1.3 |
| PXW-Z200 | PTP3 v1.3 |

**Как определить версию программно:**
```typescript
// SDIOGetExtDeviceInfo(0xC8) возвращает список команд
// Первые 2 байта ответа = версия: 0xC800 = PTP2, 0xC801+ = PTP3
// Проверить поддержку конкретного propCode: есть ли он в ответе
```

---

## Полная таблица всех PropCode (из PTPDef.h + SDK)

### Стандартные PTP (0x50xx) — все модели PTP2+
```
0x5001 BatteryLevel          UINT8   0-100%  (дубль, лучше 0xD20E)
0x5004 CompressionSetting    UINT16  JPEG quality
0x5005 WhiteBalance          UINT16  enum (см. ниже)
0x5007 FNumber               UINT16  f×100
0x500A FocusMode             UINT16  1=AF-S,2=AF-C,3=AF-A,4=MF
0x500B MeteringMode          UINT16  1=Multi,2=Center,3=Spot,6=Highlight
0x500C FlashMode             UINT16  1=Off,2=Auto,3=On,4=Slow,5=SlowRed,6=Rear
0x500E ExposureMode          UINT16  1=P,3=A,4=S,5=M
0x5010 ExposureBias          INT16   EV×1000 (±5.0EV)
0x5013 DriveMode             UINT16  1=Single,2=ContHi,3=ContLo,4=SpeedPriority
```

### Sony Extended PTP2 (0xD2xx) — все модели PTP2+
```
IMAGING:
0xD200 FlashComp             INT16   EV×1000 (-2.0..+2.0 EV)
0xD201 DRO_HDR               UINT16  enum (см. ниже)
0xD203 ImageSize             UINT16  enum (L/M/S, зависит от модели)
0xD20D ShutterSpeed          UINT32  (num<<16)|den (e.g. 0x00010064=1/100s)
0xD20E BatteryLevel          UINT16  0-100%
0xD20F ColorTemp             UINT16  Kelvin (3000-8000)
0xD210 WB_GM                 INT16   -99..+99 (Green-Magenta)
0xD211 AspectRatio           UINT16  1=3:2,2=16:9,3=1:1,4=4:3
0xD213 AF_Status             UINT16  0=OK,1=Fail,2=Inconclusive
0xD215 ShootingFileInfo      UINT16  bit0=1→файл в буфере (ObjectHandle=0xFFFFC001)
0xD217 AELockIndication      UINT16  AE lock status
0xD218 BatteryRemain         UINT16  0-100% (или минуты, зависит от модели)
0xD219 MovieFormat           UINT16  1=AVCHD,2=MP4,3=XAVC-S,4=XAVC-HS
0xD21B PictureEffects        UINT16  0=Off,1=Poster,2=Sepia,3=B&W...
0xD21C WB_AB                 INT16   -99..+99 (Amber-Blue)
0xD21D MovieRecordingStatus  UINT16  0=idle,1=recording
0xD21E ISO                   UINT32  прямое значение (100,200,400...)
0xD21F AFLockIndication      UINT16  AF lock status
0xD221 LiveViewStatus        UINT16  0=off,1=on (используй ObjectHandle=0xFFFFC002)
0xD222 SaveMedia             UINT16  место сохранения
0xD22C FocusArea             UINT16  1=Wide,2=Zone,3=Center,4=Tracking,5=FlexSpot
0xD22D FocusMagnifyPhase     UINT16
0xD231 View                  UINT16  режим отображения
0xD235 MF_Status             UINT16
0xD242 MovieQuality          UINT16
0xD25A PositionKey           UINT16
0xD25F ZoomSetting           UINT16
0xD26A LiveViewMode          UINT16  1=Finder,2=Display
0xD262 WirelessFlash         UINT16

BUTTONS (SDIO_ControlDevice, все PTP2):
0xD2C1 S1_Button             UINT16  Shutter half-press (AF trigger)
0xD2C2 S2_Button             UINT16  Shutter full-press
0xD2C3 AEL_Button            UINT16  AE Lock
0xD2C8 MovieRecButton        UINT16  REC toggle (Hold mode)
0xD2C9 AFL_Button            UINT16  AF Lock
0xD2CB FocusMagnifyRequest   UINT16  Enable magnification
0xD2CC FocusMagnifyReset     UINT16  Disable magnification
0xD2CD FocusMagnifyMoveUp    UINT16  Pan up
0xD2CE FocusMagnifyMoveDown  UINT16  Pan down
0xD2CF FocusMagnifyMoveLeft  UINT16  Pan left
0xD2D0 FocusMagnifyMoveRight UINT16  Pan right
0xD2D1 NearFar               INT16   Notch -7..+7 (MF focus)
0xD2D2 FocusModeToggle       UINT16  AF/MF toggle
0xD2D4 Normal                UINT16
0xD2D9 AWB_Lock              UINT16
```

### PTP3 Extensions (0xD3xx+) — только PTP3 v1.0+
```
FOCUS POSITION (v1.0):
0xD380 FocusPositionSetting      UINT32  absolute position
0xD381 FocusPositionCurrentValue UINT32  current position

HDMI (v1.0):
0xD3A0 MonitoringOutputHDMI      UINT16
0xD3A1 HDMI_ResolutionStill      UINT16
0xD3A3 HDMI_ResolutionMovie      UINT16
0xD3A4 HDMI_4K_Movie             UINT16
0xD3A5 HDMI_RAW_Movie            UINT16
0xD3A7 HDMI_Timecode             UINT16
0xD3A8 HDMI_RecControl           UINT16  запись по HDMI сигналу

LENS INFO (v1.0):
0xD3B0 LensModelName             STRING  "SEL1635GM"
0xD3B1 LensSerialNumber          STRING
0xD3B2 LensVersionNumber         STRING

MEDIA SLOTS (v1.0):
0xD3C0 Slot1WritingState         UINT16
0xD3C1 Slot2WritingState         UINT16
0xD3C3 Slot3RemainingShots       UINT32
0xD3C4 Slot3RemainingTime        UINT32

AF (v1.0):
0xD3D0 AF_Button                 UINT16  Real-time AF
0xD3D1 FEL_Button                UINT16  Focus Expand Lock
0xD3D2 AWBL_Button               UINT16  AWB Lock

ISO AUTO (v1.0):
0xD430 ISOAutoMinShutterMode     UINT16
0xD433 ISOAutoRangeLimitMin      UINT32
0xD434 ISOAutoRangeLimitMax      UINT32

COLOR/GAMMA (v1.0):
0xD420 FlickerLessShooting       UINT16
0xD421 HighISO_NR                UINT16
0xD422 LongExposureNR            UINT16
0xD423 ColorSpaceStill           UINT16  1=sRGB,2=AdobeRGB

ZOOM (v1.0):
0xD410 ZoomPositionSetting       UINT16
0xD411 ZoomPositionCurrent       UINT16

STREAMING (v1.2):
0xD450 StreamingLicense          UINT16
0xD451 VideoStreamSelect         UINT16
0xD452 VideoStreamCodec          UINT16  1=H.264,2=H.265,3=VP9
0xD453 VideoStreamResolution     UINT16
0xD45B StreamStatus              UINT16
0xD511 LiveViewURL               STRING  URL для стриминга потока

FTP (v1.2):
0xD471 FTP_TransferTarget        UINT16
0xD474 ND_FilterSetting          UINT16
0xD475 ND_FilterDensity          UINT32

PAN-TILT-ZOOM (v1.3) — FX30, PTZ камеры:
0xD504 PanPosition               INT32   текущая позиция пана
0xD505 PanStatus                 UINT16
0xD506 TiltPosition              INT32   текущая позиция тилта
0xD507 TiltStatus                UINT16
0xD508 PanLimitMin               INT32
0xD509 PanLimitMax               INT32
0xD50A TiltLimitMin              INT32
0xD50B TiltLimitMax              INT32
0xD513 RedTallyLamp              UINT16  1=On,0=Off
0xD514 GreenTallyLamp            UINT16
0xD515 YellowTallyLamp           UINT16
```

---

## Enum значения (полная версия из SDK)

### WhiteBalance (0x5005)
```
0x0001 Auto WB
0x0002 Daylight      (5500K)
0x0003 Cloudy        (6500K)
0x0004 Shade         (8000K)
0x0005 Tungsten      (3200K)
0x0006 Fluorescent
0x0007 Flash
0x8010 ColorTemp     → задаётся через 0xD20F (Kelvin)
0x8011 Custom1
0x8012 Custom2
0x8013 Custom3
```

### ExposureMode (0x500E)
```
0x0001 P (Program Auto)
0x0003 A (Aperture Priority)
0x0004 S (Shutter Priority)
0x0005 M (Manual)
```

### DRO_HDR (0xD201)
```
0x0000 Off
0x0001 DRO Weak
0x0002 DRO Standard
0x0003 DRO Strong
0x0100 HDR Auto
0x0101 HDR Manual 1EV
0x0102 HDR Manual 2EV
0x0103 HDR Manual 3EV
```

### AspectRatio (0xD211)
```
0x0001 3:2
0x0002 16:9
0x0003 1:1
0x0004 4:3
```

### AF_Status (0xD213)
```
0x0000 Succeeded
0x0001 Failed
0x0002 Inconclusive (сложная сцена)
```

### MovieRecordingStatus (0xD21D)
```
0x0000 Idle (не записывает)
0x0001 Recording (записывает)
```

### PictureEffects (0xD21B)
```
0x0000 Off
0x0001 Posterize
0x0002 Sepia
0x0003 B&W
0x0004 Retro Photo
0x0005 High Contrast
0x0006 Toy Camera
0x0007 Watercolor
0x0008 Illustration
```

---

## Object Handles (специальные)
```
0xFFFFC001 = последнее снятое фото (GetObject после D215 bit0=1)
0xFFFFC002 = live view stream (GetObject для превью)
```

---

## ISO шкала (реальные значения FX30/ZV-E10)
```
80,100,125,160,200,250,320,400,500,640,800,1000,1250,1600,2000,2500,
3200,4000,5000,6400,8000,10000,12800,16000,20000,25600
Extended (FX30): +51200, 102400
```

## Shutter шкала (реальные значения из SDK)
```
Знаменатели 1/x:
25,30,40,48,50,60,80,100,120,125,160,200,250,320,400,500,640,800,
1000,1250,1600,2000,2500,3200,4000,5000,6400,8000
Длинные выдержки (num/den): 1s, 2s, 4s, 5s, 8s, 10s, 25s, 30s
Bulb: 0x00000000 или 0xFFFFFFFF (зависит от модели)
```

## FNumber шкала (из DevicePropItemList.h)
```
100,114,125,140,160,180,200,220,240,250,280,320,360,400,450,510,
560,630,710,800,900,1000,1100,1300,1400,1600,1800,2000,2200
(все ×100, т.е. 100=f/1.0, 280=f/2.8)
```

---

## PTP3 — как определить версию
```
SDIOGetExtDeviceInfo(0xC8) возвращает:
- Bytes 0-1: 0xC8, 0x00 = PTP2 (version = 0xC800 LE)
- Если список команд содержит 0xD380 → v1.0
- Если содержит 0xD451 → v1.2 (streaming)
- Если содержит 0xD504 → v1.3 (PTZ)

На практике: проверяй наличие propCode в ответе SDIO_GetAllExtDevicePropInfo.
Если propCode встречается → поддерживается.
```

---

## Известные особенности конкретных моделей

**ZV-E10 mk1:** PTP2, нет HDMI контроля через PTP, нет streaming
**ZV-E10 II:** PTP3 v1.2, streaming, FTP, нет PTZ
**FX30:** PTP3 v1.0-v1.3 (в зависимости от fw), поддержка HDMI out control, tally
**Alpha A7 IV (ILCE-7M4):** PTP3 v1.0+
**Alpha 7S III:** PTP3 v1.0+

**Общее для всех:** polling через 0x9209 каждые 200ms — основной способ получения состояния.
