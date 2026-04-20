# SAB Cleanup Checklist

## Уже сделано
- удалён тяжёлый `.claude/worktrees` дубль
- сокращён `CLAUDE.md`
- добавлены project/workflow/docs файлы
- проверены `typecheck` и `build`

## Остаточная уборка

### Контекст
- [ ] не включать `.claude/` в рабочий контекст
- [ ] не включать `dist/` в рабочий контекст
- [ ] не включать `public/` в рабочий контекст
- [ ] не включать `node_modules/` в рабочий контекст

### Логи
- [ ] определить политику для `logs.txt`
- [ ] решить, нужен ли `logs.txt.old`

### Claude local state
- [ ] периодически проверять, не разрослась ли `.claude/`
- [ ] не возвращать worktrees без причины

### Generated files
- [ ] не править `dist/` руками
- [ ] не править `public/` руками
- [ ] не коммитить generated artifacts без причины

### Git hygiene
- [ ] проверять `git status`
- [ ] проверять `git diff --stat`
- [ ] следить, чтобы не попадал мусор

### Следующий слой автоматизации
- [ ] сделать `scripts/task-router.*`
- [ ] сделать `scripts/check-changed-files.*`
- [ ] добавить VS Code tasks
