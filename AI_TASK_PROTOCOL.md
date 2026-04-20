# AI Task Protocol

Короткий протокол работы для любых AI-инструментов в SAB.

## Цель
Работать по минимальному контексту, трогать только нужные файлы, проверять результат и не путать source с build.

## Порядок работы

1. **Понять задачу**
   - Это UI, API, bridge, Sony, ATEM, docs, bugfix, feature или refactor?

2. **Прочитать короткую карту**
   - Сначала читать `PROJECT_MAP.md`
   - Потом только нужный доменный файл или нужные исходники

3. **Ограничить зону поиска**
   - Определить 2-10 вероятно затронутых файлов
   - Не читать весь проект без необходимости

4. **Найти зависимости**
   - Через search понять, где используются типы, API, state, stores, routes, components
   - Проверить цепочку данных от source до UI / runtime

5. **Сделать минимальный change set**
   - Менять только необходимые файлы
   - Не делать широкий рефакторинг без явного запроса

6. **Не путать source и build**
   - Backend source: `src/`
   - UI source: `frontend/src/`
   - Build outputs: `dist/`, `public/`
   - Не править `dist/` и `public/` вручную

7. **Проверить результат**
   - Backend: `npm run typecheck`
   - Backend build: `npm run build`
   - UI build: `npm run build:ui`
   - При необходимости dev run / smoke check

8. **Проверить git diff**
   - Убедиться, что нет случайных правок в лишних файлах
   - Не включать мусор и generated artifacts без причины

9. **Только потом commit**
   - Коммит должен быть маленьким, понятным и тематическим

## Приоритеты по инструментам

### Локальные модели
Использовать для:
- summaries
- task classification
- file discovery draft
- UI/CSS changes
- boilerplate
- simple text transforms

### Codex / быстрый code agent
Использовать для:
- точечных multi-file changes
- grep/edit/fix
- route + UI glue
- type fixes
- validation runs

### Claude / сильная модель
Использовать для:
- architecture
- bridge logic
- Sony / ATEM protocol reasoning
- risky multi-file decisions
- research and planning

## Красные линии
- Не переписывать большие части проекта без запроса
- Не использовать весь проект как контекст по умолчанию
- Не править generated folders вручную
- Не коммитить `.claude/`, логи и случайный мусор
