# SAB Runbook

Короткий operational guide для человека и агентов.

## Что является настоящим исходником
- Backend: `src/`
- Frontend: `frontend/src/`
- Docs: `docs/`
- Knowledge: `knowledge/`

## Что является сборкой
- Backend build: `dist/`
- Frontend build: `public/`

Никогда не считать `dist/` и `public/` основным местом правок.

## Базовые команды

### Установить backend dependencies
```bash
npm install
```

### Установить frontend dependencies
```bash
npm run install:ui
```

### Запустить backend в dev
```bash
npm run dev
```

### Запустить frontend dev server
```bash
npm run dev:ui
```

### Проверить типы
```bash
npm run typecheck
```

### Собрать backend
```bash
npm run build
```

### Собрать frontend
```bash
npm run build:ui
```

### Запустить production-like backend
```bash
npm start
```

## Как не поймать старый UI
Если UI выглядит старым:

1. Проверить, какой процесс реально запущен
2. Помнить, что express server раздаёт `public/`
3. Если были изменения в `frontend/src/`, выполнить:
```bash
npm run build:ui
```
4. Перезапустить backend, если нужно
5. Проверить, что нет второго процесса или старого дубля проекта

## Рекомендуемый цикл изменений

### Для backend-изменений
1. Править `src/`
2. Запустить `npm run typecheck`
3. При необходимости запустить `npm run build`
4. Проверить `git diff`

### Для UI-изменений
1. Править `frontend/src/`
2. Для локальной разработки использовать `npm run dev:ui`
3. Для production-like проверки выполнить `npm run build:ui`
4. Проверить `git diff`

### Для полных изменений
1. Править только source folders
2. `npm run typecheck`
3. `npm run build`
4. `npm run build:ui`
5. Проверить diff

## Что не коммитить
- `dist/`
- `public/assets/`
- `public/index.html`
- `.claude/` local state
- `logs.txt`
- `node_modules/`
- `frontend/node_modules/`

## Что делать при странном поведении
- `git status`
- проверить, не правился ли build вместо source
- проверить, нет ли лишнего процесса
- проверить, не живёт ли где-то отдельный старый запуск
- проверить актуальность `config.json`
