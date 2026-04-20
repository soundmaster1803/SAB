# SAB Backlog

Актуальный список задач по уборке, оптимизации и сборке нового AI workflow.

## Уже сделано
- удалён тяжёлый дубль `.claude/worktrees/...`
- добавлены `PROJECT_MAP.md`, `AI_TASK_PROTOCOL.md`, `RUNBOOK.md`, `WORKFLOW.md`
- добавлены domain docs в `docs/domains/`
- `CLAUDE.md` сокращён до короткой рабочей версии
- добавлены `AI_PROMPT_TEMPLATES.md` и `WORKFLOW_NEXT_STEPS.md`
- проверены `npm run typecheck` и `npm run build`

## Остаётся сделать

### 1. Task router architecture
- описать `TASK_ROUTER_SPEC.md`
- определить input/output router-а
- определить типы задач
- определить типы knowledge sources
- определить, когда звать локальную LLM
- определить, когда звать NotebookLM / PDF research
- определить, когда звать Claude/Codex

### 2. Human-facing instructions
- сделать `HOW_TO_WORK_WITH_SAB_AI.md`
- сделать очень понятный сценарий работы для Ивана
- зафиксировать, какой инструмент брать под какой тип задачи

### 3. Cleanup / optimization follow-up
- проверить, нужен ли дальнейший cleanup внутри `.claude/`
- проверить корневые лог-файлы и политику их хранения
- проверить, нет ли других лишних дублей / generated artifacts, которые стоит игнорировать
- подумать о safe cleanup checklist

### 4. Router implementation prep
- определить минимальный формат prompt packet
- определить минимальный формат context packet
- подготовить основу под `scripts/task-router.*`
- подготовить идею `scripts/check-changed-files.*`

### 5. VS Code workflow layer
- описать будущие VS Code tasks
- описать удобный запуск backend/frontend/checks
- связать это с prompt templates

## Приоритет
1. `TASK_ROUTER_SPEC.md`
2. `HOW_TO_WORK_WITH_SAB_AI.md`
3. cleanup checklist
4. automation prep scripts
