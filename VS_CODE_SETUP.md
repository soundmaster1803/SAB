# VS Code Setup for SAB

## Что уже подготовлено
- `.vscode/tasks.json`
- `.vscode/launch.json`
- `npm run router`
- `npm run check:changed`

## Как работать

### Запуск backend
- VS Code Run and Debug → `SAB Backend Dev`
или task:
- `SAB: run backend dev`

### Запуск UI
- VS Code Run and Debug → `SAB UI Dev`
или task:
- `SAB: run ui dev`

### Проверка
- `SAB: typecheck`
- `SAB: build backend`
- `SAB: build ui`
- `SAB: check changed files`

## Полезный поток
1. открыть SAB в VS Code
2. запустить backend и UI
3. перед задачей прогнать router
4. после правок прогнать typecheck/build
5. прогнать changed files check
6. смотреть diff

## Router usage
Пример:
```bash
npm run router -- "добавь кнопку scan для atem discovery в ui"
```

## Changed files check
```bash
npm run check:changed
```
