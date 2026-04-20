# SAB Task Router Spec

## Цель
Task router это промежуточный слой между Иваном и coding/research AI.
Его задача: не решать всё самому, а дешёво и локально собирать правильный пакет для следующего шага.

## Главная идея
В дорогие токены должен уходить не поиск и не раскопки, а уже подготовленная задача.

Поток:

```text
User task
  ↓
Task Router
  ↓
classify task
  ↓
collect only needed knowledge
  ↓
build prompt/context packet
  ↓
send to best execution model
  ↓
validate result
```

## Роли

### 1. Local router
Делает:
- классификацию задачи
- выбор домена
- выбор knowledge sources
- выбор стартовых файлов
- выбор модели-исполнителя
- сбор prompt packet

Не делает по умолчанию:
- глубокую реализацию risky logic
- чтение всего проекта
- исследование всех PDF вручную

### 2. Local LLM
Используется для:
- task classification
- summarization
- дешёвого file discovery draft
- UI/CSS/simple tasks
- draft research compression

### 3. External research layer
Примеры:
- NotebookLM
- локальные заметки по Sony/ATEM API
- извлечённые выжимки из PDF

Используется для:
- поиска по большим PDF
- извлечения протокольных деталей
- возврата коротких структурированных справок

### 4. Strong coding model
Примеры:
- Claude
- Codex

Используется для:
- сложной реализации
- architecture reasoning
- bridge / Sony / ATEM risky changes
- multi-file coding tasks

## Типы задач
- `ui`
- `ui_api_glue`
- `api`
- `sony`
- `atem`
- `bridge`
- `research`
- `cleanup`
- `docs`
- `architecture`

Router может присвоить:
- один тип
- несколько типов, если задача смешанная

## Источники знаний

### Project knowledge
- `PROJECT_MAP.md`
- `AI_TASK_PROTOCOL.md`
- `RUNBOOK.md`
- `WORKFLOW.md`
- `docs/domains/*`
- `docs/architecture/current-system.md`

### Code knowledge
- file search
- imports
- routes
- stores
- handlers
- related configs

### Protocol knowledge
- Sony API references
- ATEM API references
- NotebookLM summaries
- local extracted notes / protocol snippets

### Execution knowledge
- validation commands
- git rules
- do-not-touch folders

## Router input
Минимальный вход:
- raw task text
- optional user intent hints
- current repo root

Опционально:
- preferred tool
- preferred speed/cost mode
- allowed risk level

## Router output
Router должен возвращать packet примерно такого вида:

```json
{
  "taskType": ["atem", "ui_api_glue"],
  "recommendedExecutor": "codex",
  "readFirst": [
    "PROJECT_MAP.md",
    "AI_TASK_PROTOCOL.md",
    "docs/domains/atem.md",
    "docs/domains/api.md"
  ],
  "knowledgeSources": [
    "project_docs",
    "code_search"
  ],
  "candidateFiles": [
    "src/api/routes/atem.ts",
    "src/atem/discovery.ts",
    "frontend/src/panels/atem/AtemBar.tsx"
  ],
  "constraints": [
    "Do not edit dist/ as source",
    "Do not edit public/ as source"
  ],
  "validation": [
    "npm run typecheck",
    "npm run build",
    "npm run build:ui"
  ]
}
```

## Decision rules

### When to use only local LLM
- task is small
- UI/CSS/simple formatting
- draft explanation
- file discovery / summarization
- no risky runtime logic

### When to call NotebookLM / PDF research
- question depends on large Sony/ATEM manuals
- protocol details are needed
- command/property lookup is needed
- code change depends on exact external API behavior

### When to call Codex
- targeted code changes
- UI + API glue
- type/build fixes
- small multi-file tasks

### When to call Claude
- architecture
- risky bridge logic
- Sony/ATEM behavior reasoning
- research + implementation across multiple domains

## Context minimization rules
- never pass whole repo by default
- never pass `node_modules/`
- never pass `dist/`
- never pass `public/`
- never pass `.claude/`
- never pass full changelog for a simple task
- prefer summaries and excerpts over giant source dumps

## Fallback rules
If executor says context is not enough:
1. add adjacent domain doc
2. add 1-3 neighboring code files
3. add protocol excerpt if needed
4. retry with expanded packet

Do not jump from tiny context to whole repo immediately.

## Validation layer
После реализации router должен просить:
- нужные проверки
- краткий diff summary
- список изменённых файлов
- описание риска

## Future implementation idea
Минимальная первая версия router-а может быть rule-based script:
- keywords
- domain mapping
- file hints
- prompt packet assembly

Потом можно добавить local LLM как улучшенный классификатор поверх rule-based ядра.
