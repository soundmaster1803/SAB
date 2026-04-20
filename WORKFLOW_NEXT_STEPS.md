# SAB Workflow Next Steps

Что делать дальше, чтобы собрать рабочий AI workflow без лишних токенов.

## Шаг 1. Зафиксировать главный путь работы
Главный хаб:
- VS Code

Основные инструменты:
- локальная модель / Ollama — дешёвые задачи, summaries, UI/CSS, file discovery draft
- Codex — точечные правки и быстрые multi-file fixes
- Claude — архитектура, risky domains, research

## Шаг 2. Для каждой задачи идти по одному протоколу
1. выбрать тип задачи
2. выбрать шаблон из `AI_PROMPT_TEMPLATES.md`
3. дать модели только короткие docs
4. дать модели только нужные файлы
5. запустить проверку
6. посмотреть diff
7. потом commit

## Шаг 3. Не давать модели весь проект
По умолчанию не включать в контекст:
- `node_modules/`
- `frontend/node_modules/`
- `dist/`
- `public/`
- `.claude/`
- `CHANGELOG.md` целиком
- `CLAUDE.md` целиком, если задача простая

## Шаг 4. Ввести типы задач
- UI styling / layout
- UI + API glue
- camera control bug
- ATEM connectivity/discovery
- bridge mapping/policy
- architecture / research
- docs / cleanup

## Шаг 5. Сделать потом task router
В будущем можно сделать простой локальный task-router script, который:
- принимает текст задачи
- определяет домен
- предлагает нужный prompt template
- предлагает список стартовых файлов
- предлагает команды проверки

## Шаг 6. Git discipline
Перед коммитом всегда:
- `git status`
- `git diff --stat`
- проверить, что нет generated files и мусора

## Шаг 7. Следующий практический этап
После документации сделать:
1. короткий `scripts/task-router.*`
2. короткий `scripts/check-changed-files.*`
3. стандартные команды запуска из VS Code tasks

Это будет уже следующий слой автоматизации.
