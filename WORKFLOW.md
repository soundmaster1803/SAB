# SAB Workflow

Цель: минимальный контекст, локальная работа там, где это возможно, сильные модели только там, где они действительно нужны.

## Главный принцип
Не давать модели весь проект. Сначала давать карту, потом домен, потом узкий набор файлов.

## Последовательность для любой задачи
1. Прочитать `PROJECT_MAP.md`
2. Классифицировать задачу
3. Выбрать домен
4. Найти затронутые файлы
5. Прочитать только связанные файлы и справочники
6. Сделать минимальную правку
7. Выполнить проверку
8. Посмотреть `git diff`
9. Потом commit

## Маршрутизация задач

### Локальные модели
Использовать для:
- разборки задачи
- summarization
- подготовительного file discovery
- UI/CSS
- boilerplate
- простых текстовых преобразований

### Codex / быстрый code agent
Использовать для:
- точечных multi-file changes
- route + UI glue
- исправлений type/build
- поиска и правки по конкретной цепочке файлов

### Claude / сильная модель
Использовать для:
- архитектурных решений
- сложной bridge logic
- Sony/ATEM reasoning
- рискованных multi-file изменений
- исследования и планирования

## Домены

### UI
Ищи сначала:
- `frontend/src/panels/`
- `frontend/src/components/`
- `frontend/src/stores/`
- `frontend/src/types/`

### API
Ищи сначала:
- `src/api/routes/`
- `src/api/services/`
- `src/api/viewmodels/`
- `src/api/ws/`

### ATEM
Ищи сначала:
- `src/atem/`
- `src/api/routes/atem.ts`
- `frontend/src/panels/atem/`

### Sony
Ищи сначала:
- `src/sony/`
- `src/api/routes/cameras.ts`
- `frontend/src/panels/cameras/`

### Bridge
Ищи сначала:
- `src/bridge/`
- связанные Sony/ATEM runtime части

## Правила экономии токенов
- Не читать `CHANGELOG.md` полностью для обычной задачи
- Не читать `CLAUDE.md` полностью для простой задачи
- Не включать `node_modules/`, `dist/`, `public/`, `.claude/worktrees/` в рабочий контекст
- Сначала искать, потом читать
- Читать только соседние по задаче файлы

## Минимальная валидация
- Backend: `npm run typecheck`
- UI после изменения интерфейса: `npm run build:ui`
- Если менялась backend-логика: `npm run build`

## Перед коммитом
- Убедиться, что diff маленький и тематический
- Убедиться, что не зацепились generated files
- Убедиться, что нет случайных правок в unrelated folders
