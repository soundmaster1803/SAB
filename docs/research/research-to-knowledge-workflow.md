# Research To Knowledge Workflow

Версия: 2026-04-12

## Зачем это нужно

Исследование не должно заканчиваться только длинным текстом или markdown-заметкой.

Каждый полезный research pass обязан производить артефакты двух типов:

1. `extract` для человека
2. `staging` для программы

Если после исследования не появился машинно-читаемый staging-файл, значит исследование ещё не доведено до полезного состояния.

## Обязательный результат каждого большого прохода

Для каждого большого блока Claude должен создавать **оба** файла:

1. `docs/research/extract/<topic>-analysis.md`
2. `knowledge/sony/staging/<topic>-facts.json`

Примеры:

- `docs/research/extract/ptp-device-properties-full-catalog-analysis.md`
- `knowledge/sony/staging/ptp-device-properties-block-01-02-facts.json`

- `docs/research/extract/ptp-controls-full-catalog-analysis.md`
- `knowledge/sony/staging/ptp-controls-block-01-facts.json`

## Что хранится в extract

`extract` нужен для чтения человеком.

Он содержит:

- scope
- source docs
- page references
- summary of findings
- contradictions
- ambiguities
- warnings

## Что хранится в staging

`staging` нужен для последующего переноса в рабочие knowledge-файлы программы.

Он должен быть:

- JSON
- плоским и предсказуемым
- пригодным для diff
- разбитым на manageable blocks

Каждая запись должна иметь минимум:

- `code`
- `name`
- `kind`: `property` / `control` / `command` / `event`
- `protocol`
- `confidence`
- `source`
- `status`

Рекомендуемые поля:

- `category`
- `rw`
- `form`
- `domain`
- `encoding`
- `notes`
- `needsVerification`
- `conflicts`

## Статусы записей

Каждая staging-запись должна иметь `status`:

- `verified` — можно переносить в рабочие knowledge-файлы
- `provisional` — полезно, но нужен review
- `ambiguous` — есть конфликт или сомнение
- `blocked` — запись нельзя переносить без повторной проверки

## Правило переноса в рабочие файлы

Перенос в:

- `knowledge/sony/capability-catalog.json`
- `knowledge/sony/control-catalog.json`
- `knowledge/sony/command-catalog.json`
- `knowledge/sony/models/*.json`

разрешён только из staging, а не напрямую из prose extract.

То есть pipeline такой:

1. Claude исследует блок
2. Claude пишет `extract`
3. Claude пишет `staging json`
4. Codex читает staging
5. Codex переносит verified facts в рабочие knowledge-файлы
6. Codex отдельно разбирает `ambiguous` / `provisional`

## Минимальный done definition для исследования

Research task считается полезно завершённой только если есть:

- `extract` файл
- `staging json` файл
- short note, что именно уже можно переносить в программу

Если есть только markdown-summary, задача считается исследовательски незавершённой.

## Приоритет следующей работы

Сначала надо собирать staging по самым полезным блокам:

1. standard PTP properties
2. exposure / shutter / ISO / WB
3. recording / media / status
4. focus / lens / ND
5. controls
6. events

## Рекомендованный размер staging-файлов

Не делать один гигантский JSON на 700+ строк за раз.

Лучше:

- по блокам
- по диапазонам кодов
- по категориям

Примеры:

- `ptp-device-properties-block-01-02-facts.json`
- `ptp-device-properties-block-03-04-facts.json`
- `ptp-device-properties-status-facts.json`

Это уменьшает ошибки и упрощает review.
