# How to Work With SAB AI

Короткая инструкция для повседневной работы.

## Главный принцип
Не давать ИИ весь проект. Сначала дать тип задачи, потом нужные docs, потом нужные файлы.

## Как выбирать инструмент

### Локальная LLM
Брать для:
- понять задачу
- разложить по доменам
- сделать summary
- предложить стартовые файлы
- UI/CSS/simple text work

### Codex
Брать для:
- точечных code changes
- UI + API glue
- type/build fixes
- небольших multi-file задач

### Claude
Брать для:
- architecture
- bridge
- Sony/ATEM risky logic
- сложных multi-file решений
- research + implementation

### NotebookLM / PDF research
Брать для:
- Sony API
- ATEM API
- больших PDF
- точного поиска по протоколам

## Как работать с задачей
1. определить тип задачи
2. взять шаблон из `AI_PROMPT_TEMPLATES.md`
3. дать `PROJECT_MAP.md`
4. дать `AI_TASK_PROTOCOL.md`
5. дать нужный domain doc
6. дать только связанные файлы
7. после ответа прогнать проверку
8. посмотреть diff

## Если задача про UI
Дать:
- `PROJECT_MAP.md`
- `AI_TASK_PROTOCOL.md`
- `docs/domains/ui.md`
- нужные файлы из `frontend/src/`

Проверка:
- `npm run build:ui`

## Если задача про API
Дать:
- `PROJECT_MAP.md`
- `AI_TASK_PROTOCOL.md`
- `docs/domains/api.md`
- нужные файлы из `src/api/`

Проверка:
- `npm run typecheck`
- при необходимости `npm run build`

## Если задача про Sony / ATEM / Bridge
Сначала дать:
- `PROJECT_MAP.md`
- `AI_TASK_PROTOCOL.md`
- нужный `docs/domains/*.md`

Если нужен протокол или команды:
- сначала искать через NotebookLM / protocol notes
- потом передавать краткую выжимку в coding AI

Проверка:
- `npm run typecheck`
- `npm run build`

## Что не давать в контекст без причины
- `node_modules/`
- `frontend/node_modules/`
- `dist/`
- `public/`
- `.claude/`
- весь `CHANGELOG.md`
- весь проект сразу

## Что важно помнить
- source UI: `frontend/src/`
- built UI: `public/`
- source backend: `src/`
- build backend: `dist/`

Если увиделся старый UI, почти всегда проблема в том, что не обновлён `public/`.

## Идеальный поток
Иван → local router → нужные knowledge sources → нужный coding AI → validation → git
