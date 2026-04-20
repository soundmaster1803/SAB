# SAB Project Map

Короткая карта проекта для людей и агентов.

## Что это
SAB (Sony ATEM Bridge) это мост между Sony-камерами, ATEM-свитчером и web UI.

Поток в целом такой:

```text
Sony cameras / ATEM / user actions
            ↓
        backend runtime
            ↓
       API + WebSocket
            ↓
            UI
```

## Source of truth
Это основные исходники. Правки по умолчанию делаются здесь.

- `src/` — backend runtime
- `frontend/src/` — исходники UI
- `docs/` — документация по архитектуре и исследованиям
- `knowledge/` — справочники и каталоги возможностей Sony
- `config.json` — локальная конфигурация камер и ATEM
- `package.json` — команды проекта и backend dependencies
- `frontend/package.json` — команды и dependencies UI

## Generated / build artifacts
Это производные файлы. Их не правят руками, если нет очень особой причины.

- `dist/` — собранный backend
- `public/` — собранный frontend, который реально отдаёт express server

Критично:

- UI правится в `frontend/src/`
- После этого UI нужно пересобрать в `public/`
- Если править `frontend/src/`, но не пересобрать, можно увидеть старый интерфейс из `public/`

## Service / heavy folders
Это не source of truth.

- `node_modules/` — зависимости backend
- `frontend/node_modules/` — зависимости frontend
- `.claude/` — локальные артефакты Claude Code
- `.git/` — git metadata
- `logs.txt` — runtime logs

## Главные домены

### `src/sony/`
Логика Sony камер:
- PTP/IP
- polling
- state
- camera actions
- model capabilities

### `src/atem/`
Логика ATEM:
- connection
- discovery
- state
- ATEM actions / feedbacks / variables

### `src/bridge/`
Связующая логика между ATEM и Sony:
- decoding intents
- mapping
- anti-loop / throttle policies
- command execution
- sync

### `src/api/`
Связь backend с UI:
- HTTP routes
- WebSocket broadcaster
- view models
- API services

### `frontend/src/`
UI:
- panels
- reusable components
- stores
- styles
- ws types

## Точки запуска

### Backend dev
```bash
npm run dev
```
Запускает `src/index.ts` через `tsx`.

### Frontend dev
```bash
npm run dev:ui
```
Запускает Vite dev server в `frontend/`.

### Backend build
```bash
npm run build
```
Собирает backend в `dist/`.

### Frontend build
```bash
npm run build:ui
```
Собирает frontend в `public/`.

### Production-like start
```bash
npm start
```
Запускает `dist/bridge.cjs`.

## Важное правило для UI
Есть две версии UI:

1. `frontend/src/` — живой исходник
2. `public/` — собранный результат

Express-server раздаёт именно `public/`.

Поэтому старый UI почти всегда означает одно из двух:
- frontend не был пересобран
- был запущен не тот build / не тот процесс

## Что не трогать без причины
- `dist/`
- `public/`
- `node_modules/`
- `frontend/node_modules/`
- `.claude/worktrees/` если они снова появятся

## Что проверять при странном поведении
1. Какой процесс реально запущен
2. Откуда раздаётся UI (`public/`)
3. Пересобран ли frontend
4. Нет ли дубля проекта или worktree
5. Что показывает `git status`
