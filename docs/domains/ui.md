# UI Domain

## Что это
UI это операторский web-интерфейс SAB.

## Главные каталоги
- `frontend/src/panels/` — крупные панели интерфейса
- `frontend/src/components/` — общие UI-компоненты
- `frontend/src/stores/` — состояние UI и WebSocket stores
- `frontend/src/types/` — типы frontend-side данных
- `frontend/src/styles/` — токены и глобальные стили

## Главная логика
UI не должен содержать протокольную логику Sony или ATEM.
UI должен:
- читать состояние из stores
- вызывать API
- показывать view-model данные

## Что обычно трогают
- панели камер
- панель ATEM
- layout
- стили
- WS type shapes на frontend side

## Откуда UI получает данные
- HTTP API из `src/api/routes/`
- WebSocket broadcaster из `src/api/ws/broadcaster.ts`

## Важное правило
Исходник UI лежит в `frontend/src/`, но backend раздаёт собранную версию из `public/`.
Поэтому правки делают в `frontend/src/`, затем собирают `public/` через `npm run build:ui`.

## Проверка
- локальная разработка: `npm run dev:ui`
- production-like сборка: `npm run build:ui`
