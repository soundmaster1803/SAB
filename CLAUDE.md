# CineLink Bridge — Claude Code Instructions

## Проект
Мост Sony PTP/IP ↔ ATEM Camera Control. Node.js + TypeScript backend, React + Vite frontend.

## Структура src/
```
src/index.ts              ← entry point
src/config.ts             ← loadConfig/saveConfig/addCamera/removeCamera
src/sony/constants.ts     ← ВСЕ Sony константы (OPCODES, PROP_CODES, SDI_CONTROL_TYPE, BUTTON)
src/sony/ptp-client.ts    ← SonyPTPClient class (TCP, handshake, polling, commands)
src/sony/manager.ts       ← CameraManager (Map<id, SonyPTPClient> + command routing)
src/atem/listener.ts      ← ATEMListener extends EventEmitter
src/bridge/mapper.ts      ← ATEM event → Sony PTP translation
src/api/http.ts           ← Express REST (add/remove camera, update config)
src/api/websocket.ts      ← WS server (push state to UI every 200ms)
frontend/src/App.tsx      ← React UI
```

## Зависимости
```json
"atem-connection": "^4.0.0",
"express": "^4.18.2",
"ws": "^8.16.0"
```

## Порты
| Сервис | Порт/протокол |
|--------|--------------|
| Sony PTP/IP | TCP 15740 (фиксированный) |
| ATEM | UDP 9910 (atem-connection) |
| WebSocket | 8765 |
| HTTP API | 3000 |
| Frontend dev | 5173 |

## Правила (нарушать нельзя)
1. **Sony константы** — только в `sony/constants.ts`. Нигде не дублировать.
2. **config.json** — единственное хранилище. Никаких БД.
3. **Polling 200ms** — события Sony ненадёжны. Только SDIO_GetAllExtDevicePropInfo.
4. **Notch ≠ абсолютное.** ISO/Shutter/FNumber принимают только дифференциальный шаг.
5. **MovieRec = Hold mode.** Всегда: Down → delay(100) → Up.
6. **SDIO_Connect:** SDIOConnect(1,0,0) → SDIOConnect(2,0,0) → GetExtDeviceInfo(0xC8) → SDIOConnect(3,0,0) → sleep(200ms)
7. Не смешивать async/await и callback в одном модуле.
8. Не менять маппинг в mapper.ts без явного указания.

## UI стиль (Apple Dark)
```css
background: #0a0a0a
accent: #007AFF
font: system-ui
cards: backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.08)
```

## Запуск
```bash
npm install && npm run dev    # backend
cd frontend && npm run dev    # frontend
```

## Справочники (читать по задаче)
- `docs/ref-sony.md`     — PTP/IP пакеты, опкоды, handshake, decode
- `docs/ref-cameras.md`  — ВСЕ PropCodes из реального SDK, модели, коррекции
- `docs/ref-atem.md`     — atem-connection API, структура команд
- `docs/ref-map.md`      — Таблица маппинга ATEM→Sony + конвертация
- `docs/ref-patterns.md` — Готовые паттерны: polling, queue, packet builder

## CameraState тип
```typescript
interface CameraState {
  id: string;          // "cam1"
  ip: string;
  name: string;
  connected: boolean;
  iso: number;         // 400
  shutter: string;     // "1/100"
  fnumber: number;     // 280 (f/2.8 × 100)
  expComp: number;     // 1000 (+1.0EV × 1000)
  recState: number;    // 0=idle, 1=recording
  battery: number;     // 0-100
  lastUpdate: number;  // Date.now()
}
```
