# Router State

## Текущий этап
Собирается локальный orchestration layer для SAB и бытовых задач, чтобы экономить облачные токены.

## Что уже сделано
- очищен и уплотнён SAB context
- добавлены project/workflow/instruction docs
- поднят Ollama локально
- скачана модель `qwen2.5:7b-instruct`
- сделаны scripts:
  - `task-router.js`
  - `local-llm-router.js`
  - `research-packet.js`
  - `execution-packet.js`
  - `check-changed-files.js`
  - `research-open-notebooklm.js` (stub)
- добавлены VS Code tasks / launch configs
- добавлен router config

## Где стоим сейчас
1. Локальная модель уже отвечает через Ollama.
2. Локальный router уже может принимать задачу и пытаться её классифицировать.
3. Но ответ local LLM ещё нужно нормализовать и ограничить schema-based правилами.

## Ближайшие задачи
1. Сделать normalizer для local router output.
2. Сделать fallback: local-llm -> rule-based router.
3. Разделить задачи на:
   - local-simple
   - local-tool
   - cloud-complex
4. Добавить простой decision layer для бытовых задач:
   - перевод
   - календарь
   - простые локальные действия
5. Добавить model/source footer policy для финальных ответов.

## Целевая схема
voice/local text input
-> local transcription
-> local router (Ollama)
-> decision layer
   - local model for simple tasks
   - local tools for calendar/translation/simple ops
   - Codex/Claude for complex tasks
-> final response with source/model footer

## Идея footer
В конце ответа добавлять короткую строку формата:
- `Источник: Ollama (локально)`
- `Источник: Codex (облако)`
- `Источник: Claude (облако)`

Если платформа/рантайм умеет показать usage, можно расширить до:
- `Источник: Codex, токены: used/limit`

## Ограничение
Точные token counts доступны не всегда и зависят от runtime/provider. Для локальной Ollama обычно уместнее писать просто источник/модель, без псевдоточных токенов.
