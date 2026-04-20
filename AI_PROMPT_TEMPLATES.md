# SAB AI Prompt Templates

Короткие шаблоны для работы с любыми AI-инструментами.

## 1. Общий шаблон задачи

```text
Ты работаешь в проекте SAB.
Сначала прочитай:
1. PROJECT_MAP.md
2. AI_TASK_PROTOCOL.md
3. нужный файл из docs/domains/

Потом:
- классифицируй задачу
- найди только связанные файлы
- не читай весь проект
- не трогай dist/ и public/ как source
- сделай минимальные правки
- запусти нужную проверку
- покажи, какие файлы изменены и почему

Задача:
<вставить задачу>
```

## 2. UI задача

```text
Ты работаешь в проекте SAB.
Это UI-задача.
Сначала прочитай:
- PROJECT_MAP.md
- AI_TASK_PROTOCOL.md
- docs/domains/ui.md

Потом найди только связанные файлы в:
- frontend/src/panels/
- frontend/src/components/
- frontend/src/stores/
- frontend/src/types/

Не трогай backend, если это не требуется.
После правок выполни:
- npm run build:ui
- покажи изменённые файлы

Задача:
<вставить UI-задачу>
```

## 3. API / glue задача

```text
Ты работаешь в проекте SAB.
Это задача на API или связку UI/backend.
Сначала прочитай:
- PROJECT_MAP.md
- AI_TASK_PROTOCOL.md
- docs/domains/api.md

Потом найди только связанные файлы в:
- src/api/routes/
- src/api/services/
- src/api/viewmodels/
- src/api/ws/
- при необходимости frontend/src/

Сначала определи цепочку данных, потом делай правки.
После правок выполни:
- npm run typecheck
- если менялся runtime/backend flow: npm run build

Задача:
<вставить задачу>
```

## 4. Sony задача

```text
Ты работаешь в проекте SAB.
Это задача в Sony domain.
Сначала прочитай:
- PROJECT_MAP.md
- AI_TASK_PROTOCOL.md
- docs/domains/sony.md

Потом найди только связанные файлы.
Будь особенно осторожен с:
- src/sony/ptp-client.ts
- src/sony/manager.ts
- src/sony/constants.ts
- src/sony/packet-builder.ts

Не делай широкий рефакторинг.
После правок выполни:
- npm run typecheck
- npm run build

Задача:
<вставить задачу>
```

## 5. ATEM задача

```text
Ты работаешь в проекте SAB.
Это задача в ATEM domain.
Сначала прочитай:
- PROJECT_MAP.md
- AI_TASK_PROTOCOL.md
- docs/domains/atem.md

Потом найди только связанные файлы.
Проверь цепочку:
- src/api/routes/atem.ts
- src/atem/*
- frontend/src/panels/atem/*

После правок выполни:
- npm run typecheck
- npm run build
- если был UI: npm run build:ui

Задача:
<вставить задачу>
```

## 6. Bridge задача

```text
Ты работаешь в проекте SAB.
Это задача в Bridge domain.
Сначала прочитай:
- PROJECT_MAP.md
- AI_TASK_PROTOCOL.md
- docs/domains/bridge.md

Потом найди только связанные файлы.
Проверь:
- intents
- mapper
- policies
- executors
- sync

Не меняй bridge широко без необходимости.
После правок выполни:
- npm run typecheck
- npm run build

Задача:
<вставить задачу>
```

## 7. Режим исследования без правок

```text
Ты работаешь в проекте SAB.
Ничего не меняй.
Сначала прочитай:
- PROJECT_MAP.md
- AI_TASK_PROTOCOL.md
- нужный domain file

Потом:
- найди связанные файлы
- объясни текущую цепочку работы
- перечисли точки риска
- предложи минимальный change set

Задача:
<вставить исследовательский вопрос>
```
