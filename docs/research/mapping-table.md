# ATEM Camera Control → Sony PTP Mapping Table

---

## Как ATEM передаёт Camera Control

ATEM посылает Camera Control данные по SDI (Blackmagic Video Device Embedded Control Protocol).
В TypeScript это перехватывается через `atem-connection`:

```typescript
import { Atem } from 'atem-connection'

const atem = new Atem()
atem.connect('192.168.x.x')

atem.on('receivedCommands', (commands) => {
  for (const cmd of commands) {
    if (cmd instanceof Commands.CameraControlUpdateCommand) {
      // cmd.cameraId  — номер входа ATEM (0-indexed), соответствует Camera 1-20
      // cmd содержит данные управления: iris, focus, gain, shutter, rec...
    }
  }
})
```

### Структура ATEM Camera Control Protocol

ATEM Camera Control (Blackmagic Camera Control Protocol) организован по:
- **Category** — категория параметра
- **Parameter** — конкретный параметр внутри категории
- **DataType** — тип данных (signed 8/16/32/64 bit, float 16-bit fixed point)

Ключевые категории для CineLink Bridge:

| Category | Название                |
|----------|-------------------------|
| 0        | Lens                    |
| 1        | Video                   |
| 2        | Audio (не нужен)        |
| 8        | Extended / Output       |

---

## Таблица маппинга: ATEM → Sony PTP

### Диафрагма (Aperture / Iris)

| ATEM Event | Category | Parameter | DataType | ATEM значение | Sony PTP команда |
|------------|----------|-----------|----------|---------------|-----------------|
| Iris / Aperture | 0 (Lens) | 2 | Fixed16 (0.0–1.0) | Нормализованное 0.0–1.0 | `SDIO_ControlDevice(0x5007, Notch)` |

**Логика конвертации:**
- ATEM присылает нормализованное значение (0.0 = полностью открыто, 1.0 = полностью закрыто)
- Sony принимает только Notch (шаг). Не существует прямого преобразования значения в шаги.
- **Стратегия:** Сравни желаемое значение f-number с текущим (из polling). Если текущее > желаемого → посылай Notch -1 итеративно. Если < → Notch +1.
- В реальной практике: при изменении ATEM iris вычисли разницу шагов и пошли соответствующий Notch.

```typescript
// Пример логики для mapper.ts
function irisATEMtoSonyNotch(atemValue: number, currentFNumber: number): number {
  // atemValue: 0.0–1.0 (нормализованное)
  // Approximation: одна ступень f-number ≈ один шаг Notch
  // Нужно знать текущее состояние камеры через polling
  const targetFNumber = atemNormalizedToFNumber(atemValue);
  const delta = calculateFNumberDelta(currentFNumber, targetFNumber); // в шагах
  return Math.max(-127, Math.min(127, delta));
}
```

---

### ISO / Gain

| ATEM Event | Category | Parameter | DataType | ATEM значение | Sony PTP команда |
|------------|----------|-----------|----------|---------------|-----------------|
| Gain (dB)  | 1 (Video) | 1 | Signed 8-bit | dB значение (-12 до +36) | `SDIO_ControlDevice(0xD21E, Notch)` |
| ISO (numeric) | 1 (Video) | 14 | Signed 16-bit | Числовое ISO (100, 400...) | `SDIO_ControlDevice(0xD21E, Notch)` |

**Логика конвертации:**
- ATEM старые модели используют Gain в dB, новые (ATEM Mini, Constellation) поддерживают ISO напрямую
- Sony принимает Notch (шаг ISO)
- Одна ступень Notch ≈ один шаг ISO по шкале камеры (например 100→125→160→200...)
- **Стратегия:** Сравни желаемый ISO с текущим, вычисли количество шагов

```typescript
// ISO шкала Sony FX30 (приблизительно):
// 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600...
// Каждый шаг Notch = один шаг по этой шкале
function isoToNotchSteps(currentISO: number, targetISO: number): number {
  const scale = [100,125,160,200,250,320,400,500,640,800,1000,1250,1600,2000,
                 2500,3200,4000,5000,6400,8000,10000,12800,25600,51200,102400];
  const currentIdx = scale.findIndex(v => v >= currentISO);
  const targetIdx = scale.findIndex(v => v >= targetISO);
  return Math.max(-127, Math.min(127, targetIdx - currentIdx));
}
```

---

### Выдержка (Shutter Speed / Shutter Angle)

| ATEM Event | Category | Parameter | DataType | ATEM значение | Sony PTP команда |
|------------|----------|-----------|----------|---------------|-----------------|
| Shutter Speed | 1 (Video) | 12 | Signed 32-bit | Угол в 100x (e.g. 18000 = 180°) | `SDIO_ControlDevice(0xD20D, Notch)` |
| Shutter Speed | 1 (Video) | 13 | Signed 32-bit | Выдержка 1/x (e.g. 50 = 1/50s) | `SDIO_ControlDevice(0xD20D, Notch)` |

**Логика конвертации:**
- ATEM может прислать угол затвора (для 180° правило) или 1/x выдержку
- Sony принимает Notch (шаг по шкале выдержек)
- Шкала выдержек Sony: 1/30, 1/40, 1/50, 1/60, 1/80, 1/100, 1/120, 1/160, 1/200...
- **Стратегия:** Конвертируй желаемую выдержку → найди позицию в шкале → вычисли дельту

```typescript
// Примерная шкала выдержек Sony FX30 (числители 1/x):
const SHUTTER_SCALE = [25, 30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 320,
                        400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000];
```

---

### Компенсация экспозиции (Exposure Compensation)

| ATEM Event | Category | Parameter | DataType | ATEM значение | Sony PTP команда |
|------------|----------|-----------|----------|---------------|-----------------|
| Exposure Comp | 1 (Video) | 5 | Fixed16 | EV offset (-2.0 до +2.0) | `SDIO_ControlDevice(0x5010, Notch)` |

**Логика конвертации:**
- ATEM присылает дробное значение EV
- Sony PropertyCode 0x5010 хранит значение в 1/1000 EV (например 1000 = +1.0 EV)
- Шаг Notch для 0x5010: один шаг = 1/3 EV (≈ 333ms)
- **Стратегия:** `notchSteps = round((targetEV - currentEV) / 0.333)`

---

### Запись видео (Record)

| ATEM Event | Category | Parameter | DataType | ATEM значение | Sony PTP команда |
|------------|----------|-----------|----------|---------------|-----------------|
| Record Start | 1 (Video) | — | — | Сигнал начала записи | `SDIO_ControlDevice(0xD2C8, 0x0002)` → wait 100ms → `SDIO_ControlDevice(0xD2C8, 0x0001)` |
| Record Stop  | 1 (Video) | — | — | Сигнал конца записи  | `SDIO_ControlDevice(0xD2C8, 0x0002)` → wait 100ms → `SDIO_ControlDevice(0xD2C8, 0x0001)` |

**Важно:**
- `0xD2C8` — Movie Rec Button в **Hold mode**. Работает как физическая кнопка записи.
- Камера сама определяет что делать (начать или остановить запись) при каждом нажатии.
- Всегда посылай пару Down (0x0002) → Up (0x0001) с паузой 100ms.
- Не нужно отслеживать текущее состояние записи для этой команды.

```typescript
async function toggleRecording(camera: SonyPTPClient): Promise<void> {
  await camera.sdioControlDevice(PROP_CODES.MOVIE_REC_BUTTON, BUTTON.DOWN);
  await delay(100);
  await camera.sdioControlDevice(PROP_CODES.MOVIE_REC_BUTTON, BUTTON.UP);
}
```

---

### Фокус (Focus)

| ATEM Event | Category | Parameter | DataType | ATEM значение | Sony PTP команда |
|------------|----------|-----------|----------|---------------|-----------------|
| Focus       | 0 (Lens) | 0 | Fixed16 | 0.0–1.0 нормализованное | `SDIO_ControlDevice(0xD2D1, Notch INT16)` |
| AutoFocus   | 0 (Lens) | 1 | Boolean | true/false | `SDIO_ControlDevice(0xD2C1, DOWN)` (S1 button) |

**NearFar (0xD2D1):**
- Специальный Notch с типом данных **INT16** (не INT8!)
- Диапазон: -7 до +7
- Отрицательное значение = фокус ближе (Near), положительное = дальше (Far)

```typescript
// Шаг фокуса от ATEM normalized position
function focusATEMtoSonyNearFar(atemValue: number, currentNorm: number): number {
  const delta = atemValue - currentNorm; // -1.0 до +1.0
  // Маппим дельту на диапазон -7..+7
  return Math.round(delta * 7);
}
```

---

## Конфигурация маппинга ATEM слот → камера

Хранится в `config.json`:

```json
{
  "atemIp": "192.168.1.100",
  "cameras": [
    {
      "id": "cam1",
      "name": "Camera 1 FX30",
      "ip": "192.168.1.10",
      "atemInput": 1
    },
    {
      "id": "cam2",
      "name": "Camera 2 FX30",
      "ip": "192.168.1.11",
      "atemInput": 2
    }
  ]
}
```

- `atemInput` — номер входа ATEM (Camera 1 = atemInput 1, соответствует cameraId=0 в atem-connection)
- Маппинг: `cameraId` из ATEM команды → найти камеру по `atemInput === cameraId + 1`

---

## Схема потока данных

```
ATEM Software Control / Hardware Panel
        ↓ (оператор крутит ручку)
ATEM Switcher (по SDI посылает Camera Control данные)
        ↓ (UDP 9910, atem-connection)
CineLink Bridge — atem/listener.ts
        ↓ (event: cameraISOChanged(cameraId=0, value=400))
Bridge Mapper — bridge/mapper.ts
        ↓ (находит камеру по atemInput=1, вычисляет delta notch)
Sony PTP Client — sony/ptp-client.ts
        ↓ (TCP 15740)
Sony FX30 (IP: 192.168.1.10)
```

---

## atem-connection — что реально приходит

### Пример кода для listener.ts

```typescript
import { Atem, Commands } from 'atem-connection'
import { EventEmitter } from 'events'

export class ATEMListener extends EventEmitter {
  private atem: Atem

  constructor(ip: string) {
    super()
    this.atem = new Atem()
    this.atem.connect(ip)

    this.atem.on('receivedCommands', (commands) => {
      for (const cmd of commands) {
        if (cmd instanceof Commands.CameraControlUpdateCommand) {
          this.handleCameraControl(cmd)
        }
      }
    })
  }

  private handleCameraControl(cmd: Commands.CameraControlUpdateCommand): void {
    const cameraId = cmd.cameraId  // 0-indexed

    // Проверяй тип через cmd.dataType и cmd.category/parameter
    // Или через @atem-connection/camera-control для высокоуровневого API
    this.emit('cameraControl', { cameraId, cmd })
  }
}
```

### @atem-connection/camera-control (рекомендуемый подход)

```typescript
import { AtemCameraControlStateBuilder } from '@atem-connection/camera-control'

// Этот пакет предоставляет типизированный state builder
// который парсит CameraControlUpdateCommand в понятные свойства:
// state.iris, state.gain, state.shutterSpeed, etc.
```

---

## Особые случаи и известные проблемы

### Проблема: Notch только дифференциальный

Sony не принимает абсолютные значения для ISO/Shutter/Aperture через SDIO_ControlDevice.
Нужно знать текущее значение и вычислять дельту.

**Решение:** Всегда держи актуальный CameraState через polling (200ms интервал).
При получении команды от ATEM:
1. Прочитай текущее значение из CameraState
2. Преобразуй ATEM значение в целевое значение Sony
3. Вычисли количество шагов Notch
4. Пошли SDIO_ControlDevice с вычисленным шагом

### Проблема: гонка команд

Если оператор быстро крутит ручку, может прийти несколько команд подряд.
Используй очередь команд с дебаунсом или берни только последнее значение.

### Проблема: ATEM не знает о состоянии камеры

ATEM посылает абсолютные значения (ISO 400), но не знает что сейчас на камере.
**Решение:** CineLink Bridge — единственный источник правды о состоянии камеры. Храни CameraState и используй его для вычисления дельт.

### Проблема: Movie Rec через ATEM

ATEM Camera Control не имеет стандартного параметра для record start/stop на сторонних камерах.
Запись управляется только через UI CineLink Bridge (кнопка в веб-интерфейсе).

---

## Полная таблица маппинга (сводная)

| ATEM Действие | ATEM Category | ATEM Parameter | Sony PropertyCode | Команда Sony | Тип |
|---------------|---------------|----------------|-------------------|--------------|-----|
| Aperture/Iris | 0 (Lens) | 2 | 0x5007 (FNumber) | SDIO_ControlDevice | Notch INT8 |
| Focus | 0 (Lens) | 0 | 0xD2D1 (NearFar) | SDIO_ControlDevice | Notch INT16 |
| AutoFocus trigger | 0 (Lens) | 1 | 0xD2C1 (S1Button) | SDIO_ControlDevice | Button |
| Gain (dB) | 1 (Video) | 1 | 0xD21E (ISO) | SDIO_ControlDevice | Notch INT8 |
| Shutter Speed | 1 (Video) | 13 | 0xD20D (ShutterSpeed) | SDIO_ControlDevice | Notch INT8 |
| Shutter Angle | 1 (Video) | 12 | 0xD20D (ShutterSpeed) | SDIO_ControlDevice | Notch INT8 |
| ISO | 1 (Video) | 14 | 0xD21E (ISO) | SDIO_ControlDevice | Notch INT8 |
| Exposure Comp | 1 (Video) | 5 | 0x5010 (ExpComp) | SDIO_ControlDevice | Notch INT8 |
| Record Start/Stop | UI only | — | 0xD2C8 (MovieRec) | SDIO_ControlDevice | Button Hold |
