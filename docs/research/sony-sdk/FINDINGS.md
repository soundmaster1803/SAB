# Sony CrSDK v2.02.00 — findings for SAB

Источник: `CrSDK_v2/` — полный Sony Camera Remote SDK v2.02.00
(заголовки `SimpleCli/app/CRSDK/*.h`, HTML API-reference `html/`, исходники примеров).

## ⚠️ Главный вывод: SDK-значения enum ≠ raw-PTP значения на проводе

SAB общается **напрямую по PTP/IP**, минуя CrSDK. CrSDK — это абстракция поверх
протокола, и он **перенумеровывает** значения. Доказательство (FocusMode):

| Режим | CrSDK `CrFocusMode` | SAB raw-PTP (подтв. на железе) |
|-------|--------------------:|-------------------------------:|
| MF    | 0x0001 | 0x0001 ✅ |
| AF-S  | 0x0002 | 0x0002 ✅ |
| AF-C  | **0x0003** | **0x8004** ❌ |
| AF-A  | 0x0004 | 0x8005 ❌ |
| DMF   | 0x0006 | 0x8006 ❌ |
| PF    | 0x0007 | 0x8009 ❌ |

Низкие значения иногда совпадают, но в общем случае — нет. **Нельзя хардкодить
wire-значения из SDK.** SDK-коды пропов тоже свои (`CrDevicePropertyCode` с 0x0100),
не raw-PTP (0x5007/0xD001/…).

## Что SDK даёт достоверно (и это ценно)
1. **Полный каталог свойств и возможностей** — сотни пропов, имена, типы, семантика.
2. **Смысл enum'ов и структура** (какие режимы существуют, зависимости).
3. **Поведенческие правила** (что от чего зависит, порядок).

### Подтверждённая семантика (значения — SDK-уровня, НЕ обязательно wire)
- `CrExposureProgram` (0x500E-семантика): M=0x01, P=0x02, A=0x03, S=0x04; **movie-режимы
  отдельно**: Movie_P=0x8050, Movie_A=0x8051, Movie_S=0x8052, Movie_M=0x8053,
  Movie_Auto=0x8054, Movie_F=0x8055. → для FX6/FX30 в видео режим экспозиции это
  Movie_*, а не stills M/P/A/S. **Это разрешает спор с ref-cameras: catalog (1=M,2=P,3=A,4=S) прав по порядку.**
- `CrExposureCtrlType`: PASMMode=0x01, FlexibleExposureMode=0x02 — определяет, применимы ли
  PASM-режимы или flexible (cine) на данном теле.
- `CrIrisModeSetting`: **Automatic=0x01, Manual=0x02** (research ошибался в направлении).
- `CrShutterModeSetting`: **Automatic=0x01, Manual=0x02**.
- `CrGainControlSetting`: Automatic=0x01, Manual=0x02.
- `CrWhiteBalanceSetting`: AWB=0x0000, ColorTemp=0x0100 (SDK-уровень; **отличается** и от
  catalog 0x0002/0x8006, и от ref-cameras 0x0001/0x8010 → все три расходятся, значит
  wire-значение WB надо брать с камеры, не хардкодить).

## Как это применяем в SAB (правильная архитектура)
- **Offline (без железа):** майним SDK → расширяем `knowledge/sony/*.json` и `constants.ts`
  (каталог пропов, семантика, зависимости, movie-vs-stills). Прямой вклад в «управление всем».
- **Wire-значения — из runtime-discovery:** SAB уже парсит все vendor-пропы из poll-блоба
  (`scanAllProps`) с текущим значением и списком кандидатов. Для mode-тоглов (iris/shutter/gain,
  WB) читаем живой список кандидатов у камеры и пишем нужный — **без хардкода**.
- **Подтверждение — через существующий `/api/cameras/:id/debug`** на камерах Ивана
  (ручной packet-capture не нужен: SAB сам выкладывает сканированные пропы).

## ⚠️ Требует ревизии в текущем коде
`ptp-client.setWhiteBalanceMode()` сейчас хардкодит 0x0002 (AWB) / 0x8006 (CT) из catalog.
Это **не подтверждено** против провода (три источника расходятся). Пометить как unverified,
подтвердить по poll-блобу камеры перед тем, как считать WB Auto/Manual готовым.

---

## Reconciliation: SAB constants ↔ CrSDK (аудит «сверить существующее», 2026-07-04)

Помним каветат: SDK-значения ≠ wire. Поэтому «расхождение значения» ≠ «ошибка SAB» —
это либо wire-значение SAB (верно), либо неподтверждённая догадка (проверить на камере).

| Что | SAB | CrSDK | Вердикт |
|-----|-----|-------|---------|
| ISO auto sentinel | 0x00FFFFFF | `CrISO_AUTO = 0xFFFFFF` | ✅ **подтверждено** (setIsoAuto верен) |
| ColorTemp encoding | Kelvin 2500–9900, шаг 100 | «value = color temp (K) step 100» | ✅ подтверждено |
| FocusMode MF / AF-S | 0x0001 / 0x0002 | 0x0001 / 0x0002 | ✅ совпадает |
| FocusMode AF-C/AF-A/DMF/PF | 0x8004/0x8005/0x8006/0x8009 | 0x0003/0x0004/0x0006/0x0007 | ⚠️ wire≠SDK; SAB hw-подтв. (коммент) → оставить |
| FocusMode **AF-D** | — (нет) | `CrFocus_AF_D = 0x0005` | ❌ **пробел**: SAB не знает AF-D (wire-значение неизв.) |
| FocusArea Wide/Zone/Center | 0x0001/0x0002/0x0003 | 0x0001/0x0002/0x0003 | ✅ совпадает |
| FocusArea Flexible S/M/L/XS/XL | 0x0101–0x0105 | 0x0004–0x0006, 0x0019/0x001A | ⚠️ **не подтверждено**, схема иная — проверить (я уже зашипил `/focus-area` с этими) |
| FocusArea Lock-on | 0x0202 | Tracking_* c 0x0011 | ⚠️ не подтверждено |
| WB Auto/Manual | 0x0002 / 0x8006 | AWB 0x0000 / CT 0x0100 (или ModeSetting 0x01/0x02) | ⚠️ **3 источника расходятся** — проверить |
| Iris/Shutter/Gain mode | 501 pending | Auto=0x01, Manual=0x02 (semantics) | семантика подтв.; wire code/value — с камеры |
| Exposure program | не используется | M=1/P=2/A=3/S=4; Movie_*=0x8050+ | для видео-камер режим = Movie_*, не stills |

### Action items из аудита
1. **Проверить на камере через `/api/cameras/:id/debug`** (когда Иван подключит): реальные wire-значения
   FocusArea flexible/lock-on и WB-mode. Это шипнуто/планируется с неподтверждёнными значениями.
2. **FocusArea сейчас с неподтверждёнными значениями** — `/focus-area` (Stage 0) может слать не тот код.
   UI его пока не дёргает → риск низкий, но пометить.
3. **AF-D** — добавить в FocusMode после подтверждения wire-значения.
4. Перевести mode-тоглы (iris/shutter/gain, WB, focus-area) на **runtime-discovery**: читать живой список
   кандидатов из poll-блоба и писать нужный — это снимает зависимость от догадок по значениям.
