# Confirmed raw-PTP wire values (Camera Control PTP 3 Reference v2.02)

Источник: `CameraRemoteCommand-2.02.00/Camera Control PTP 3 Reference.pdf` (740 стр., глава
"Device Properties"). Это **авторитетные wire-значения** для raw PTP/IP, на котором работает SAB
(в отличие от CrSDK, который абстрагирует). Извлечено 2026-07-04.

## Exposure / focus core

### White Balance — prop `0x5005`, UINT16, Enumeration
| value | meaning |
|------|---------|
| 0x0001 | Manual |
| **0x0002** | **AWB (Auto)** |
| 0x0003 | One-push Automatic |
| 0x0004 | Daylight |
| 0x0005 | Fluorescent |
| 0x0006 | Tungsten |
| 0x0007 | Flash |
| **0x8012** | **C.Temp. (Color Temperature)** |
| 0x8010 | Cloudy · 0x8011 Shade · 0x8020–0x8023 Custom · 0x8030 Underwater |
→ WB Auto = `0x0002`; ручной color-temp режим = **`0x8012`** (перед записью Kelvin в 0xD20F).
**Прежнее значение 0x8006 в SAB было НЕВЕРНЫМ** (0x8006 = Tungsten? нет — его нет в таблице WB).

### Focus Mode — prop `0x500A`, UINT16, Enumeration
| value | meaning |
|------|---------|
| 0x0001 | Manual (MF) |
| 0x0002 | Automatic (AF-S) |
| 0x0003 | Automatic Macro |
| 0x8004 | Continuous AF (AF-C) |
| 0x8005 | Auto (AF-A) |
| 0x8006 | Direct Manual Focus (DMF) |
| 0x8007 | Manual Focus Reverse (MF-R) |
| **0x8008** | **AF-D** |
| 0x8009 | Preset Focus (PF) |
→ Совпадает с SAB точь-в-точь; **добавить AF-D = 0x8008**.

### Focus Area — prop `0xD22C`, UINT16, Enumeration
| value | meaning |
|------|---------|
| 0x0001 | Wide · 0x0002 Zone · 0x0003 Center |
| 0x0101 | Flexible Spot S · 0x0102 M · 0x0103 L |
| 0x0104 | Expand Flexible Spot |
| 0x0105 | Flexible Spot (generic) |
| **0x0106** | **Flexible Spot XS** |
| **0x0107** | **Flexible Spot XL** |
| 0x0201 | Lock on AF Wide · 0x0202 Zone · 0x0203 Center |
| 0x0204–0x020A | Lock on AF Flexible S/M/L/Expand/Spot/XS/XL |
→ SAB ошибки: XS должно быть 0x0106 (было 0x0104), XL = 0x0107 (было 0x0105),
Lock-on generic = 0x0201 (было 0x0202 = это Zone).

### Exposure Mode — prop `0x500E`, **UINT32**, Enumeration
| value | meaning |
|------|---------|
| 0x00000001 | Manual (M) |
| 0x00010002 | Automatic (P) |
| 0x00020003 | Aperture Priority (A) |
| 0x00030004 | Shutter Priority (S) |
| 0x00078050 | Movie Recording (P) |
| 0x00078051 | Movie Recording (A) |
| 0x00078052 | Movie Recording (S) *(pattern)* |
| 0x00078053 | Movie Recording (M) *(pattern; verify)* |
→ Значение 32-битное: писать полный UINT32. M=0x01 работает (подтв. sample-скриптом),
но P/A/S требуют полного значения (0x00010002 и т.д.). Видео-камеры используют Movie_* (0x0007805x).

## Cinema mode toggles (Auto/Manual) — UINT8, 0x01 Automatic / 0x02 Manual
| prop | meaning |
|------|---------|
| **0xD001** | Iris Mode Setting (0x01 Auto / 0x02 Manual) |
| **0xD013** | Shutter Mode Setting (0x01 Auto / 0x02 Manual) |
| **0xD01C** | Gain Control Setting (0x01 Auto / 0x02 Manual) |
| 0xD01D | Gain Unit (0x01 dB / 0x02 ISO) |
| **0xD099** | Exposure Control Type (0x01 P/A/S/M / 0x02 Flexible Exp.) |
| 0xD002 | Iris Close (0x01 OFF / 0x02 ON) |
→ Только cinema-тела (FX6/FX30/Z200) экспонируют эти пропы. Mirrorless (ZV-E10 II) — через 0x500E PASM.
Пропы **не всегда в poll-блобе** → паковать UINT8 (1 байт) явно.

## ISO Auto
`CrISO_AUTO = 0x00FFFFFF` (0xD21E). SAB верно.

## Прочие подтверждённые коды (из PTPDef.h примера v3)
0x5005 WB · 0x5007 F-Number · 0x500A FocusMode · 0x500E ExposureMode · 0x5010 ExpComp ·
0xD20D Shutter · 0xD20F ColorTemp · 0xD21E ISO · 0xD22C FocusArea · 0xD2C8 MovieRec ·
0xD2CA MediaFormat · 0xD2D1 Near/Far · 0xD25A PositionKey(Dial→Host=0x01). Все совпадают с SAB.
