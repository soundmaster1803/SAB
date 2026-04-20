# API Domain

## Что это
API это слой между backend runtime и web UI.

## Главные каталоги
- `src/api/routes/` — HTTP endpoints
- `src/api/services/` — helper-логика для routes
- `src/api/viewmodels/` — подготовка данных для UI
- `src/api/ws/` — WebSocket broadcaster
- `src/api/server.ts` — bootstrap express/http, без бизнес-логики

## Что здесь живёт
- connect/disconnect endpoints
- camera management endpoints
- status endpoints
- WebSocket state broadcast
- UI-friendly payload assembly

## Что здесь не должно жить
- низкоуровневая Sony transport logic
- ATEM protocol internals
- bridge policy core

## Какие файлы смотреть первыми
### Если задача про камеры
- `src/api/routes/cameras.ts`
- `src/api/services/cameras.ts`
- `src/api/viewmodels/camera.ts`

### Если задача про ATEM
- `src/api/routes/atem.ts`
- `src/api/viewmodels/atem.ts`
- иногда `src/atem/discovery.ts`

### Если задача про live updates
- `src/api/ws/broadcaster.ts`
- frontend stores

## Проверка
- `npm run typecheck`
- если менялся backend flow: `npm run build`
