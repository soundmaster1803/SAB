# End-to-End Workflow

## Цель
Собрать простой рабочий конвейер:
- task
- router
- optional research
- execution packet
- coding model
- validation

## Базовый поток

```text
User task
  ↓
node scripts/task-router.js "..."
  ↓
If protocol knowledge needed:
node scripts/research-packet.js "..."
  ↓
(optional) local research tool / Open NotebookLM
  ↓
node scripts/execution-packet.js "..."
  ↓
Send packet to coding model
  ↓
Run validation
  ↓
Check changed files
```

## Минимальные команды

### Router
```bash
npm run router -- "task"
```

### Research packet
```bash
npm run research:packet -- "research query"
```

### Execution packet
```bash
npm run execution:packet -- "task"
```

### Validation
```bash
npm run typecheck
npm run build
npm run build:ui
npm run check:changed
```
