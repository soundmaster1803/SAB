# Sony Camera Control PTP/IP Protocol

Источник: Camera Control PTP 2 Reference (SDK v2.00.02), изучен полностью (98 страниц).

---

## Обзор

Sony использует расширение стандартного PTP (Picture Transfer Protocol) поверх TCP/IP — PTP-IP.

- **Транспорт:** TCP/IP
- **Порт:** 15740 (фиксированный)
- **Два сокета:** Command channel + Event channel (два отдельных TCP соединения)
- **Byte order:** Little-endian (все мультибайтовые поля)

---

## Структура пакета PTP-IP

Каждый пакет имеет формат:

```
[Length: 4 bytes LE] [Type: 4 bytes LE] [Payload...]
```

### Типы пакетов инициализации (Init channel)

| Type | Hex    | Название              |
|------|--------|-----------------------|
| 1    | 0x0001 | InitCommandRequest    |
| 2    | 0x0002 | InitCommandAck        |
| 3    | 0x0003 | InitEventRequest      |
| 4    | 0x0004 | InitEventAck          |
| 5    | 0x0005 | InitFail              |

### Типы пакетов операций (Command channel)

| Type | Hex    | Название              |
|------|--------|-----------------------|
| 6    | 0x0006 | OperationRequest      |
| 7    | 0x0007 | OperationResponse     |
| 8    | 0x0008 | Event                 |
| 9    | 0x0009 | StartData             |
| 10   | 0x000A | Data                  |
| 11   | 0x000B | Cancel                |
| 12   | 0x000C | EndData               |
| 13   | 0x000D | Probe                 |
| 14   | 0x000E | ProbeResponse         |

---

## Последовательность подключения

### Шаг 1 — Handshake Command Channel (TCP port 15740)

```
Client → Camera: InitCommandRequest
  [Length=16+len(name)][Type=0x0001][GUID: 16 bytes][Name: UTF-16LE][Version: 0x00010000]

Camera → Client: InitCommandAck
  [Length=16][Type=0x0002][SessionId: 4 bytes][GUID: 16 bytes][Name: UTF-16LE][Version]
```

### Шаг 2 — Handshake Event Channel (same TCP port 15740, новое соединение)

```
Client → Camera: InitEventRequest
  [Length=12][Type=0x0003][SessionId: 4 bytes (полученный из CommandAck)]

Camera → Client: InitEventAck
  [Length=12][Type=0x0004] или InitFail (0x0005) с кодом ошибки
```

### Шаг 3 — OpenSession (0x1002)

```
OperationRequest: opcode=0x1002, param1=sessionId (1), transactionId=0
OperationResponse: responseCode=0x2001 (OK)
```

### Шаг 4 — SDIO_Connect (0x9201)

**Обязательно вызывать 3 раза** с разными параметрами:

```
1й вызов:  param1=0x01, param2=0x00, param3=0x00  → ответ содержит версию протокола
2й вызов:  param1=0x01, param2=0x01, param3=0x00
3й вызов:  param1=0x02, param2=0x01, param3=0x00  → финальное подтверждение
```

После этого камера готова принимать команды.

### Шаг 5 — SDIO_GetExtDeviceInfo (0x9202)

```
OperationRequest: opcode=0x9202, param1=0xC8 (SDI_Extension_Version)
```

Камера отвечает списком поддерживаемых команд. Используется для проверки доступных функций.

---

## Операции (Opcodes)

### Стандартные PTP

| Opcode | Hex    | Описание                            |
|--------|--------|-------------------------------------|
| GetDeviceInfo | 0x1001 | Информация об устройстве     |
| OpenSession   | 0x1002 | Открыть PTP сессию           |
| CloseSession  | 0x1003 | Закрыть PTP сессию           |

### Sony SDIO расширения

| Opcode | Hex    | Описание                                          | Направление |
|--------|--------|---------------------------------------------------|-------------|
| SDIO_Connect             | 0x9201 | Инициализация Sony-расширений   | → Camera    |
| SDIO_GetExtDeviceInfo    | 0x9202 | Список поддерживаемых команд    | ← Camera    |
| SDIO_SetExtDevicePropValue | 0x9205 | Установить абсолютное значение свойства | → Camera |
| SDIO_ControlDevice       | 0x9207 | Кнопка / шаговый контроль (Notch/Button) | → Camera |
| SDIO_GetAllExtDevicePropInfo | 0x9209 | Получить ВСЕ текущие значения свойств | ← Camera |

---

## Polling состояния камеры

**КРИТИЧЕСКИ ВАЖНО:** Sony SDK явно рекомендует использовать **polling** вместо событий:

> "It is highly recommended to use SDIO_GetAllExtDevicePropInfo to obtain current camera-setting values via polling"

Событие `SDIE_DevicePropChanged (0xC203)` ненадёжно. Используй **polling каждые ~200ms**.

```
OperationRequest: opcode=0x9209, params=[] (нет параметров)
← Data: бинарный поток со значениями всех свойств
← OperationResponse: 0x2001 (OK)
```

Ответ содержит массив записей DevicePropInfo, каждая:
```
[PropertyCode: 2 bytes][DataType: 2 bytes][GetSet: 1 byte]
[DefaultValue: N bytes][CurrentValue: N bytes][FormFlag: 1 byte][Form data...]
```

---

## SDIO_ControlDevice (0x9207) — главная команда управления

Используется для **Button** и **Notch** (шаговых) контролов.

### Формат запроса

```
OperationRequest:
  opcode = 0x9207
  param1 = DevicePropCode (property code камеры)

Data phase (WRITE):
  [SDIControlType: 1 byte][Value: 1-2 bytes]
```

### SDIControlType значения

| Тип    | Hex  | Описание                                |
|--------|------|-----------------------------------------|
| Button | 0x81 | Кнопка (нажать/отпустить)               |
| Notch  | 0x82 | Шаговый контроль (дифференциальный)     |
| Lock   | 0x83 | Блокировка параметра                    |

### Button (0x81) — формат данных

```
Data: UINT16 LE
  0x0001 = Up   (кнопка отпущена / release)
  0x0002 = Down (кнопка нажата  / press)
```

**Важно для Movie Rec (0xD2C8):** В отличие от физической кнопки, этот контроль работает как **удержание**: Down = начало записи, Up = остановка. Нельзя просто послать Down — нужно потом послать Up.

### Notch (0x82) — формат данных

```
Data: INT8 (шаг)
  range: -127 ... +127
  step:  1 (для большинства параметров)
```

**Важно:** Notch — это **дифференциальный** контроль, не абсолютный. Ты посылаешь _сколько шагов_ пройти, а не абсолютное значение.

Пример: послать `+1` → камера увеличит ISO на одну ступень, `+3` → на три ступени.

---

## SDIO_SetExtDevicePropValue (0x9205) — абсолютные значения

Используется для свойств, которые поддерживают установку абсолютного значения (не у всех свойств).

```
OperationRequest:
  opcode = 0x9205
  param1 = DevicePropCode

Data phase (WRITE):
  [Value: N bytes, тип зависит от свойства]
```

---

## Коды событий (Events)

Только 3 события определены в Sony PTP 2:

| Code   | Hex    | Описание                              |
|--------|--------|---------------------------------------|
| SDIE_ObjectAdded    | 0xC201 | Новый файл создан (фото/видео) |
| SDIE_ObjectRemoved  | 0xC202 | Файл удалён                    |
| SDIE_DevicePropChanged | 0xC203 | Значение свойства изменилось  |

`SDIE_DevicePropChanged` ненадёжно — используй polling.

---

## Таблица PropertyCode (Device Properties)

### Параметры экспозиции / съёмки

| PropertyCode | Hex    | Тип данных | Описание                 | Команда         |
|--------------|--------|------------|--------------------------|-----------------|
| FNumber      | 0x5007 | UINT16     | Диафрагма (текущее)      | SDIO_ControlDevice (Notch) |
| ExposureBiasCompensation | 0x5010 | INT16 | Компенсация экспозиции | SDIO_ControlDevice (Notch) |
| ShutterSpeed | 0xD20D | UINT32     | Скорость затвора         | SDIO_ControlDevice (Notch) |
| ISOSensitivity | 0xD21E | UINT32   | ISO чувствительность     | SDIO_ControlDevice (Notch) |
| ExposureMode | 0x500E | UINT16     | Режим экспозиции (M/A/S/P) | SDIO_SetExtDevicePropValue |
| FlashCompensation | 0xD200 | INT16 | Компенсация вспышки    | SDIO_ControlDevice (Notch) |

### Запись видео

| PropertyCode | Hex    | Тип данных | Описание                 | Команда         |
|--------------|--------|------------|--------------------------|-----------------|
| MovieRecButton | 0xD2C8 | UINT16   | Кнопка записи (Hold mode) | SDIO_ControlDevice (Button) |
| RecState     | 0xD21D | UINT8      | Состояние записи (read-only) | Polling only |

**MovieRecButton (0xD2C8):** Симулирует **удержание** физической кнопки.
```
Начать запись: Down (0x0002) → подождать 100ms → Up (0x0001)
Остановить:   Down (0x0002) → подождать 100ms → Up (0x0001)
```
Камера сама переключает состояние записи при каждом "нажатии".

### Батарея и состояние

| PropertyCode | Hex    | Тип данных | Описание               |
|--------------|--------|------------|------------------------|
| BatteryRemain | 0xD218 | UINT8     | Уровень батареи 0-100  |
| BatteryLevel  | 0xD20E | UINT8     | Уровень (дубль)        |
| RecState      | 0xD21D | UINT8     | 0=не записывает, 1=запись |
| AFStatus      | 0xD213 | UINT8     | Статус автофокуса      |
| AELockIndication | 0xD217 | UINT8  | AE заблокирован?       |

### Фокус

| PropertyCode | Hex    | SDIControlType | Тип данных | Описание              |
|--------------|--------|----------------|------------|-----------------------|
| NearFar      | 0xD2D1 | 0x82 Notch     | INT16      | Фокус Near/Far, range -7..+7, step 1 |
| FocusMode    | 0x500A | —              | UINT16     | AF/MF режим           |
| AFLButton    | 0xD2C4 | 0x81 Button    | UINT16     | AFL кнопка            |
| AF_MF_Hold   | 0xD2D2 | 0x81 Button    | UINT16     | Удержать AF/MF        |
| FocusStepNear | 0xD2D7 | 0x81 Button   | UINT16     | Шаг фокуса ближе      |
| FocusStepFar  | 0xD2D8 | 0x81 Button   | UINT16     | Шаг фокуса дальше     |

### Кнопки управления

| PropertyCode | Hex    | SDIControlType | Описание                     |
|--------------|--------|----------------|------------------------------|
| ShutterHalfS1 | 0xD2C1 | 0x81 Button  | Полунажатие затвора (AF)     |
| ShutterS2    | 0xD2C2 | 0x81 Button    | Полное нажатие затвора       |
| AELButton    | 0xD2C3 | 0x81 Button    | AE Lock кнопка               |
| AFLButton    | 0xD2C4 | 0x81 Button    | AF Lock кнопка               |
| ReleaseLock  | 0xD2C5 | 0x83 Lock      | 0x0001=Unlock, 0x0002=Lock   |
| MovieRecButton | 0xD2C8 | 0x81 Button  | Запись видео (Hold mode)     |
| FELButton    | 0xD2C9 | 0x81 Button    | Flash Exposure Lock          |
| AWBLButton   | 0xD2D9 | 0x81 Button    | Auto White Balance Lock      |
| FocusMagnifier | 0xD2CB | 0x81 Button  | Увеличение для фокуса        |
| FocusMagnifierCancel | 0xD2CC | 0x81 Button | Отмена увеличения        |
| RemoteKeyUp   | 0xD2CD | 0x81 Button  | Виртуальная кнопка ↑         |
| RemoteKeyDown | 0xD2CE | 0x81 Button  | Виртуальная кнопка ↓         |
| RemoteKeyLeft | 0xD2CF | 0x81 Button  | Виртуальная кнопка ←         |
| RemoteKeyRight | 0xD2D0 | 0x81 Button | Виртуальная кнопка →         |
| HFRStandby   | 0xD2D5 | 0x81 Button    | HFR режим готовности         |
| HFRRecCancel  | 0xD2D6 | 0x81 Button   | Отмена HFR записи            |

### Прочие свойства

| PropertyCode | Hex    | Описание                          |
|--------------|--------|-----------------------------------|
| LiveviewMode  | 0xD26A | Режим Liveview                   |
| WhiteBalance  | 0x5005 | Баланс белого (preset)            |
| ColorTemp    | 0xD20F | Цветовая температура (Kelvin)     |
| WhiteBalanceAB | 0xD21C | WB смещение A/B                 |
| WhiteBalanceGM | 0xD210 | WB смещение G/M                 |
| MovieFormat  | 0xD219 | Формат видео                      |
| MovieQuality | 0xD242 | Качество видео                    |
| AspectRatio  | 0xD211 | Соотношение сторон                |
| FocusArea    | 0xD22C | Зона фокуса                       |
| DRO_HDR      | 0xD201 | DRO/HDR режим                     |
| PictureEffects | 0xD21B | Художественные фильтры          |

---

## Декодирование значений при polling

Значения из `SDIO_GetAllExtDevicePropInfo` хранятся в сыром виде и требуют декодирования.

### ShutterSpeed (0xD20D)

Значение — это числитель и знаменатель дроби, закодированные в UINT32:
```
value = (numerator << 16) | denominator
shutter = numerator / denominator  # секунды
```
Примеры: `0x00010064` = 1/100s, `0x00010019` = 1/25s

### ISO (0xD21E)

Прямое числовое значение ISO:
```
value = 80  → ISO 80
value = 100 → ISO 100
value = 400 → ISO 400
```

### FNumber (0x5007)

F-число умножено на 100:
```
value = 180 → f/1.8
value = 280 → f/2.8
value = 400 → f/4.0
```

### ExposureBiasCompensation (0x5010)

Значение в 1/1000 EV:
```
value = +1000 → +1.0 EV
value = -1000 → -1.0 EV
value = 0     → 0 EV
```

### RecState (0xD21D)

```
0 = не записывает
1 = записывает
```

### BatteryRemain (0xD218)

Процент заряда: `0` до `100`.

---

## Примеры команд

### Начать запись видео

```typescript
// 1. Нажать кнопку (Down)
await sendSDIOControlDevice(0xD2C8, 0x0002);
// 2. Подождать
await delay(100);
// 3. Отпустить кнопку (Up)
await sendSDIOControlDevice(0xD2C8, 0x0001);
```

### Увеличить ISO на один шаг

```typescript
await sendSDIOControlDevice(0xD21E, +1);  // Notch +1 step
```

### Уменьшить диафрагму (открыть) на 2 шага

```typescript
await sendSDIOControlDevice(0x5007, -2);  // Notch -2 steps
```

---

## Константы TypeScript (для sony/constants.ts)

```typescript
// Opcodes
export const OPCODES = {
  GET_DEVICE_INFO: 0x1001,
  OPEN_SESSION: 0x1002,
  CLOSE_SESSION: 0x1003,
  SDIO_CONNECT: 0x9201,
  SDIO_GET_EXT_DEVICE_INFO: 0x9202,
  SDIO_SET_EXT_DEVICE_PROP_VALUE: 0x9205,
  SDIO_CONTROL_DEVICE: 0x9207,
  SDIO_GET_ALL_EXT_DEVICE_PROP_INFO: 0x9209,
} as const;

// Property Codes
export const PROP_CODES = {
  FNUMBER: 0x5007,
  EXP_COMP: 0x5010,
  FOCUS_MODE: 0x500A,
  EXPOSURE_MODE: 0x500E,
  WHITE_BALANCE: 0x5005,
  FLASH_COMP: 0xD200,
  SHUTTER_SPEED: 0xD20D,
  ISO: 0xD21E,
  BATTERY_REMAIN: 0xD218,
  BATTERY_LEVEL: 0xD20E,
  REC_STATE: 0xD21D,
  MOVIE_REC_BUTTON: 0xD2C8,
  NEAR_FAR: 0xD2D1,
  COLOR_TEMP: 0xD20F,
  WB_AB: 0xD21C,
  WB_GM: 0xD210,
  AF_STATUS: 0xD213,
  S1_BUTTON: 0xD2C1,
  S2_BUTTON: 0xD2C2,
  AEL_BUTTON: 0xD2C3,
  AFL_BUTTON: 0xD2C4,
  FOCUS_MAGNIFIER: 0xD2CB,
  FOCUS_MAGNIFIER_CANCEL: 0xD2CC,
} as const;

// SDIControlType
export const SDI_CONTROL_TYPE = {
  BUTTON: 0x81,
  NOTCH: 0x82,
  LOCK: 0x83,
} as const;

// Button values
export const BUTTON = {
  UP: 0x0001,
  DOWN: 0x0002,
} as const;

// SDI Extension Version
export const SDI_EXTENSION_VERSION = 0xC8;
```

---

## Важные замечания

1. **Polling обязателен.** События (SDIE_DevicePropChanged) ненадёжны. Опрашивай камеру каждые 200ms через SDIO_GetAllExtDevicePropInfo.

2. **Notch — не абсолютный.** ISO/Shutter/FNumber принимают только дифференциальный шаг. Для управления от ATEM нужно вычислять дельту между текущим и желаемым значением.

3. **Movie Rec — "Hold" mode.** Это не обычная кнопка, а симуляция удержания. Всегда: Down → 100ms → Up.

4. **SDIO_Connect — 3 вызова.** Инициализация Sony-расширений требует трёх последовательных вызовов SDIO_Connect с разными параметрами.

5. **Transaction ID.** Инкрементируется с каждой операцией. При OpenSession начинается с 0, после — с 1.
