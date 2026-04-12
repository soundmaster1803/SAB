# Claude Prompts For Sony API Research

Версия: 2026-04-12

## Цель

Этот документ нужен для работы с очень большим Sony SDK / PDF / header / source-кодом без
бессмысленного "прочитай всё подряд". Задача Claude не читать весь массив текста целиком, а
поэтапно собирать структурированные знания.

Главная идея:

1. Сначала подготовить corpus.
2. Потом сделать manifest и карту разделов.
3. Потом выявить дубли.
4. Потом исследовать только смысловые блоки.
5. Потом собирать facts, а не summary.

---

## Как подготовить файлы до исследования

Если у вас есть:
- PDF reference docs
- `.h` файлы
- `.cpp` / sample code
- release notes
- compatibility tables

их надо разложить не по папкам "как было", а по смыслу.

### Рекомендуемая структура

```text
sony-sdk-source/
  pdf/
  headers/
  samples/
  compatibility/
  release-notes/
```

### Что лучше сделать заранее

1. Дать файлам понятные имена:
   - `ptp-reference-v2.pdf`
   - `ptp-reference-v3.pdf`
   - `PTPDef.h`
   - `DevicePropItemList.h`
   - `CaptureDlg.cpp`

2. Если PDF огромный, извлечь из него:
   - оглавление
   - названия разделов
   - примерные диапазоны страниц по разделам

3. Если есть несколько версий одного документа:
   - хранить рядом
   - явно указывать версию в имени

4. Не смешивать:
   - protocol reference
   - sample code
   - compatibility tables
   - firmware notes

---

## Самый важный принцип для Claude

Никогда не давать Claude задачу:

- "изучи весь SDK"
- "прочитай весь PDF"
- "сделай полную сводку"

Нужно всегда давать Claude одну из этих задач:

- построить manifest
- извлечь оглавление и карту разделов
- найти дубли
- исследовать один смысловой блок
- собрать facts по одной категории
- сравнить два конкретных источника

И почти всегда сразу задавать output contract:

- в какой файл сохранить результат;
- в какой staging-файл сохранить machine-readable facts;
- в каком формате сохранить результат;
- что в чат не нужно дублировать весь dump.

### Базовая приписка к любому research prompt

Добавляй в конец любого большого промпта такой блок:

```text
Сохрани результат в файл:
`docs/research/extract/<target-file-name>`

И, если в результате появляются конкретные property/control/command facts, сохрани их также в файл:
`knowledge/sony/staging/<target-facts-file>.json`

Требования к выводу:
- если результат аналитический или табличный, сохрани как Markdown;
- если результат состоит из records, сохрани как JSON;
- не вставляй в чат полный результат;
- в чате верни только:
  1. путь к файлу,
  2. путь к staging json, если он был создан,
  3. что в эти файлы записано,
  4. какие места требуют дополнительной проверки.
```

---

## Этап 1. Построение manifest

### Что просить

Claude должен сначала только описать corpus и ничего не анализировать глубоко.

### Промпт 1: manifest

```text
У меня есть набор исходных файлов Sony API / SDK.

Твоя задача сейчас НЕ изучать содержимое целиком и НЕ делать summary по всему SDK.

Сначала сделай только research manifest:

1. Перечисли все файлы.
2. Для каждого файла определи:
   - file_name
   - probable type:
     - protocol-reference
     - header-definitions
     - sample-code
     - compatibility-matrix
     - release-notes
     - unknown
   - version if visible
   - likely topics
   - priority: high / medium / low
3. Отдельно укажи:
   - какие файлы выглядят основными источниками истины
   - какие файлы вероятно дублируют друг друга
   - какие файлы, скорее всего, устаревшие

Верни результат как компактную таблицу.

Важно:
- не пересказывай документы
- не пытайся извлечь все prop codes
- не пытайся анализировать весь текст
- цель только в том, чтобы составить карту источников

Сохрани результат в файл:
`docs/research/extract/sony-research-manifest.md`

В чат верни только короткое подтверждение, путь к файлу и главные выводы.
```

---

## Этап 2. Извлечение оглавления и карты разделов

На этом этапе Claude должен не читать весь текст подряд, а выделить смысловые блоки.

### Промпт 2: table of contents map

```text
Для выбранного документа сделай только section map.

Нужно:
1. Извлечь оглавление или восстановить его по заголовкам.
2. Построить список разделов и подразделов.
3. Для каждого раздела указать:
   - section_id
   - title
   - short purpose
   - likely relevance:
     - protocol
     - properties
     - controls
     - events
     - compatibility
     - data-format
     - examples
     - tips
   - likely overlap with other sections

Отдельно отметь:
- какие разделы обязательно исследовать первыми
- какие можно отложить
- какие похожи на дубли или повторения

Важно:
- не делай summary всего документа
- не извлекай пока детали протокола
- задача только сегментировать документ на смысловые блоки

Сохрани результат в файл:
`docs/research/extract/ptp-section-map-<doc-version>.md`

В чат верни только путь к файлу и короткий список must-read sections.
```

### Что должен вернуть Claude

На выходе вам нужна таблица вида:

| section_id | title | purpose | category | overlap | priority |
|---|---|---|---|---|---|

---

## Этап 3. Найти дубли и повторы между версиями

Это один из самых важных этапов, чтобы не жечь токены на повторяющийся материал.

### Промпт 3: dedup map

```text
Сравни два документа или две версии документа на уровне разделов.

Твоя задача:
1. Найти разделы, которые по смыслу повторяют друг друга.
2. Найти разделы, которые есть только в одной версии.
3. Найти разделы, которые похожи по названию, но, вероятно, отличаются по содержанию.

Верни результат в 3 таблицах:

Таблица A: probable duplicates
- section in doc A
- matching section in doc B
- overlap estimate: high / medium / low
- comment

Таблица B: unique to doc A

Таблица C: unique to doc B

В конце отдельно перечисли:
- какие разделы достаточно исследовать только в новой версии
- какие разделы надо исследовать в обеих версиях

Важно:
- не пытайся глубоко пересказывать содержимое
- работай на уровне структуры, названий разделов и явных hints

Сохрани результат в файл:
`docs/research/extract/ptp-dedup-map-v2-v3.md`

В чат верни только путь к файлу и 3-5 главных overlap findings.
```

---

## Этап 4. Выбрать минимальный набор разделов для исследования

После manifest + TOC map + dedup map Claude должен помочь сократить объём.

### Промпт 4: research scope reduction

```text
На основе manifest и section maps выбери минимальный набор разделов, который нужен для построения Sony knowledge base для runtime control.

Нас интересуют только:
- handshake / session
- opcode catalog
- property codes
- control codes
- events
- compatibility by model
- data formats for important values

Нас сейчас НЕ интересуют, если они не критичны:
- маркетинговые описания
- юридические разделы
- длинные tips без новых protocol facts
- still-photo-only функции, если они не влияют на runtime control

Верни:
1. must-read sections
2. should-read sections
3. skip-for-now sections
4. why

Важно:
- цель уменьшить объём исследования
- не начинать пока извлекать факты

Сохрани результат в файл:
`docs/research/extract/ptp-scope-reduction.md`

В чат верни только путь к файлу и итоговый must-read shortlist.
```

---

## Этап 5. Исследование только одного блока

Только после предыдущих этапов можно давать Claude содержательную задачу.

### Разрешённые блоки исследования

- handshake/session
- operations
- device properties
- controls
- events
- compatibility
- data formats

Нельзя давать все сразу.

---

## Промпты для глубокого исследования по блокам

### Промпт 5A: handshake/session block

```text
Исследуй только блок handshake / session setup.

Используй только разделы, связанные с:
- OpenSession
- SDIO_Connect
- SDIO_GetExtDeviceInfo
- SDIO_OpenSession
- event connection
- session initialization

Не исследуй остальные части документа.

Верни результат в структуре:
1. ordered steps
2. parameters per step
3. expected responses
4. retry/wait rules
5. differences between versions
6. ambiguities
7. exact source sections

Важно:
- не делать обзор документа целиком
- не расписывать unrelated operations
- если что-то не указано явно, помечать как not explicitly specified
```

### Промпт 5B: properties block

```text
Исследуй только блок device properties.

Используй только разделы и файлы, относящиеся к:
- Device Properties
- PropCode definitions
- property data formats
- enum/range values

Не анализируй controls, events, tips и примеры, если они не содержат новых property facts.

Верни таблицу:
code | name | data_type | category | readable | writable | enum_or_range | raw_format | protocol_version | model_limits | exact_source | confidence

В конце отдельно выдели:
- core runtime properties
- likely still-photo-only properties
- properties needing live verification
```

### Промпт 5C: controls block

```text
Исследуй только блок controls / remote buttons.

Верни таблицу:
code | name | control_type | payload_format | sequence | category | protocol_version | safe_or_dangerous | exact_source | confidence

Отдельно выдели:
- recording controls
- focus controls
- navigation controls
- dangerous controls
- controls with unclear transport differences
```

### Промпт 5D: compatibility block

```text
Исследуй только compatibility information.

Верни таблицу:
model_id | family | protocol_version | supported_features | excluded_features | exact_source | confidence

Отдельно укажи:
- PTP2 only models
- PTP3 v1.0+ models
- PTP3 v1.2+ models
- PTP3 v1.3+ / PTZ-related models
```

---

## Этап 6. Преобразование исследований в facts

Когда Claude уже исследовал один блок, следующий шаг не summary, а нормализованные записи.

### Промпт 6: convert to fact records

```text
Преобразуй предыдущее исследование в нормализованные fact records.

Правила:
- один факт = одна запись
- каждая запись должна быть короткой
- каждая запись должна содержать evidence
- не объединяй разные свойства в одну запись

Верни JSON-массив.

Формат записи:
{
  "id": "...",
  "kind": "property | control | opcode | capability | model",
  "code": "...",
  "name": "...",
  "summary": "...",
  "protocol": [],
  "confidence": "confirmed | likely | unclear",
  "evidence": [
    {
      "source": "...",
      "section": "...",
      "note": "..."
    }
  ]
}
```

---

## Этап 7. Выявление противоречий

Иногда PDF, header и sample code расходятся.

### Промпт 7: contradiction pass

```text
Сравни результаты из:
- protocol reference
- header definitions
- sample code

Найди только реальные противоречия по:
- opcode parameters
- property data types
- control payload formats
- sequence order
- model compatibility

Верни таблицу:
topic | source_a | source_b | contradiction | likely resolution | confidence

Важно:
- не включай просто разные формулировки
- включай только то, что реально влияет на реализацию
```

---

## Хорошая стратегия распределения работы между Claude и NotebookLM

### NotebookLM хорошо подходит для
- PDF lookup
- section locating
- finding exact tables
- answering "где это в документе"

### Claude хорошо подходит для
- manifest
- dedup map
- scope reduction
- block-by-block extraction
- normalization into facts
- contradiction analysis
- compilation into project JSON

---

## Самая безопасная последовательность работы

### Шаг 1
Дать Claude только corpus и попросить manifest.

### Шаг 2
Дать Claude 1-2 ключевых PDF и попросить section map.

### Шаг 3
Попросить dedup map между v2 и v3.

### Шаг 4
Попросить scope reduction: что читать обязательно, что пропустить.

### Шаг 5
Исследовать только handshake block.

### Шаг 6
Исследовать только properties block.

### Шаг 7
Исследовать только controls block.

### Шаг 8
Исследовать только compatibility block.

### Шаг 9
Преобразовать всё в facts.

### Шаг 10
Только после этого переносить в проект.

---

## Чего нельзя делать

- Нельзя давать все документы сразу без manifest.
- Нельзя просить полную summary по версии 2 и 3.
- Нельзя сразу просить "подготовь поддержку всех камер".
- Нельзя смешивать protocol extraction и model compatibility в одном запросе.
- Нельзя копить огромные markdown-конспекты вместо fact records.

---

## Минимальный стартовый пакет задач для Claude

Если начинать прямо сейчас, лучший старт такой:

1. `manifest`
2. `section map` для `ptp-reference-v2.pdf`
3. `section map` для `ptp-reference-v3.pdf`
4. `dedup map` между v2 и v3
5. `scope reduction`
6. `handshake/session block`

Этого достаточно, чтобы не потратить токены впустую и быстро получить первую действительно полезную порцию знаний.
