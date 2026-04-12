# Claude Sony Research Rules

Версия: 2026-04-12

## Файлы исследования

- [Camera Control PTP 2 Reference.pdf](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/Camera%20Control%20PTP%202%20Reference.pdf)
- [Camera Control PTP 3 Reference.pdf](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/Camera%20Control%20PTP%203%20Reference.pdf)
- [Claude Prompts For Sony API Research](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/docs/research/claude-sony-research-prompts.md)
- [Sony API Research Plan](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/docs/research/sony-api-research-plan.md)

## Цель Claude

Claude не должен "читать весь PDF и пересказывать".
Claude должен поэтапно собирать полную Sony capability-platform knowledge base:

1. построить карту документов;
2. выделить разделы;
3. найти повторы и дубли;
4. сократить объём обязательного чтения;
5. исследовать только один большой блок за раз;
6. выдавать нормализованные facts, а не длинный summary;
7. помочь собрать полный каталог функций всех камер, а не только минимальный runtime для одной модели.

## Жёсткие правила

### 0. Большой результат нужно писать в файл
- Claude не должен выгружать длинные research tables прямо в чат, если результат большой.
- Для каждого существенного прохода Claude должен создать или обновить итоговый временный файл в `docs/research/extract/`.
- Для каждого существенного прохода Claude должен также создать или обновить машинно-читаемый staging-файл в `knowledge/sony/staging/`, если из исследования получаются конкретные facts.
- Формат:
  - `.md` для section maps, block maps, contradictions, notes, summaries of findings
  - `.json` для fact records или нормализованных структур, если явно нужен JSON
- В чат Claude должен вернуть только короткое подтверждение:
  - какой файл создан или обновлён;
  - какой staging-файл создан или обновлён;
  - что именно в нём лежит;
  - какие места требуют дополнительной проверки.

### 1. Нельзя анализировать оба PDF целиком в одном проходе
- не делать total summary;
- не читать подряд весь текст;
- не пытаться сразу извлечь все prop codes, controls и compatibility.

### 2. Сначала только структура
Первый этап всегда:
- оглавление;
- section map;
- overlap/dedup between v2 and v3;
- must-read vs skip-for-now.

### 3. Один запрос = один тип задачи
Разрешены только такие типы задач:
- manifest
- section map
- dedup map
- scope reduction
- handshake block
- properties block
- controls block
- compatibility block
- contradiction pass
- fact normalization

### 4. Не смешивать блоки
Запрещено в одном запросе одновременно глубоко исследовать:
- protocol и properties
- controls и compatibility
- events и все остальные блоки сразу

### 5. Сначала версия 3, потом версия 2 только для сверки
Если разделы дублируются:
- основной источник сначала `Camera Control PTP 3 Reference.pdf`
- `Camera Control PTP 2 Reference.pdf` использовать для сравнения, legacy и проверки различий

Исключение:
- если в v3 раздел неполный или неоднозначный, тогда смотреть v2 отдельно.

### 6. На каждом этапе нужен компактный структурированный output
Предпочтительные форматы:
- таблица
- короткий список
- JSON records

Нежелательные форматы:
- длинное эссе
- пересказ нескольких разделов подряд
- обзор "всего документа"

### 7. Каждый факт должен иметь источник
Если Claude утверждает что-то конкретное, надо указывать:
- document
- section title
- по возможности page/heading

Если факт не подтверждён явно:
- пометить `not explicitly specified`
- не додумывать

### 8. Цель исследования
Нас интересуют знания, полезные для полной Sony capability-platform:
- handshake / session
- opcode catalog
- полный каталог device properties
- полный каталог controls
- полный каталог events
- compatibility matrices
- data formats
- model-family synthesis
- runtime capability rules

Сейчас не приоритет:
- legal
- marketing text
- broad tips без protocol facts
- длинные прикладные workflow, если они не добавляют новых operation/property/control facts

## Порядок работы

1. Section map для v3
2. Section map для v2
3. Dedup map между v3 и v2
4. Scope reduction
5. Handshake/session research
6. Full operations catalog
7. Full properties catalog
8. Full controls catalog
9. Full events catalog
10. Data formats
11. Compatibility research
12. Contradiction pass
13. Fact normalization

## Правило остановки

Если Claude начинает:
- пересказывать весь документ;
- уходить в общую теорию;
- перечислять всё подряд без фильтрации;
- смешивать несколько больших блоков;

это считается неверным направлением. Нужно остановиться и вернуться к section map / scope reduction / одному блоку.

## Правило для больших блоков

Если исследуется большой блок вроде:
- all device properties
- all controls
- all events
- all operations

то Claude должен:

1. сначала построить внутреннюю карту этого блока;
2. разбить его на логические подблоки;
3. выявить повторы между v3 и v2;
4. только потом извлекать нормализованную таблицу.

Нельзя сразу пересказывать 200+ свойств сплошным текстом.

## Целевой output для больших блоков

Для больших блоков предпочтителен порядок:

1. block map
2. dedup / overlap notes
3. normalized table
4. contradictions
5. JSON-ready fact records

## Именование выходных файлов

Рекомендуемый шаблон имён:

- `docs/research/extract/sony-research-manifest.md`
- `docs/research/extract/ptp-section-map-v3.md`
- `docs/research/extract/ptp-section-map-v2.md`
- `docs/research/extract/ptp-dedup-map-v2-v3.md`
- `docs/research/extract/ptp-handshake-session-analysis.md`
- `docs/research/extract/ptp-device-properties-full-catalog-analysis.md`
- `docs/research/extract/ptp-device-properties-verified-facts.json`
- `docs/research/extract/ptp-controls-full-catalog-analysis.md`
- `docs/research/extract/ptp-events-full-catalog-analysis.md`

Рекомендуемые staging-файлы:

- `knowledge/sony/staging/ptp-device-properties-block-01-02-facts.json`
- `knowledge/sony/staging/ptp-device-properties-block-03-04-facts.json`
- `knowledge/sony/staging/ptp-controls-block-01-facts.json`
- `knowledge/sony/staging/ptp-commands-facts.json`
- `knowledge/sony/staging/ptp-events-facts.json`

Если запрос узкий, имя файла должно прямо отражать блок:

- `<topic>-analysis.md`
- `<topic>-contradictions.md`
- `<topic>-facts.json`

## Главный принцип платформы

Цель не "сделать одну камеру".
Цель:

- знать все функции Sony API;
- уметь определять поддержку на конкретной камере;
- строить capability gating по модели, версии протокола и живым prop/control lists;
- безопасно включать только реально поддерживаемое.
