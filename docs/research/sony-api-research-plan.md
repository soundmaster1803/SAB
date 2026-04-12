# Sony API Research Plan

Версия: 2026-04-12

## Зачем нужен этот план

У Sony API слишком большой объём для "прочитать всё целиком и попросить LLM пересказать".
Задача должна быть не в чтении SDK как одного документа, а в поэтапной компиляции знаний в
структурированные артефакты, которые потом напрямую попадают в:

- `knowledge/sony/command-catalog.json`
- `knowledge/sony/control-catalog.json`
- `knowledge/sony/capability-catalog.json`
- `knowledge/sony/models/*.json`
- `src/sony/models/*.ts`

Главный принцип: исследуем не "файл", а "единицу знания".

---

## Что именно нужно получить из Sony API

Нам не нужен один большой конспект. Нам нужны 6 отдельных слоёв знаний.

### 1. Протокол
- handshake / session flow
- обязательные opcode
- различия PTP2 / PTP3 / подверсий
- структура пакетов
- data-phase правила
- event model
- error / response codes

### 2. Каталог свойств
- `propCode`
- имя
- тип данных
- форматы raw/decode
- диапазон / enum
- read / write / poll / event-driven
- примечания по совместимости

### 3. Каталог controls / buttons
- `controlCode`
- тип управления: absolute / step / button / toggle / lock
- формат payload
- порядок нажатий
- риски
- отличие USB vs PTP/IP

### 4. Capability layer
- какие свойства образуют одну capability
- prerequisites
- на каких поколениях камер работает
- на каких не работает
- какие признаки в `GetExtDeviceInfo` / `GetAllExtDevicePropInfo` это подтверждают

### 5. Model layer
- model id
- семейство камеры
- версия PTP
- подтверждённые capability flags
- известные unsupported / quirks
- firmware notes

### 6. Runtime integration hints
- чем опрашивать
- что лучше брать из polling, а что из events
- какие команды безопасны
- какие команды нельзя показывать в UI по умолчанию
- какие поля годятся для actions / feedbacks / presets / variables

---

## Как делить гигантский SDK

Нельзя резать по "100 страниц". Нужно резать по смыслу.

### Правильные единицы разбиения
- один PDF-раздел
- один header-файл (`PTPDef.h`, `DevicePropItemList.h`, и т.д.)
- один cpp-файл, если он описывает конкретный flow
- одна таблица enum / property list
- один модельный список

### Неправильные единицы
- "страницы 1-200"
- "весь SDK в один Notebook"
- "все камеры одним summary"

### Рекомендуемый pipeline разбиения
1. Сначала составить манифест всех исходных файлов.
2. Для каждого файла определить тип:
   - `protocol`
   - `property-definitions`
   - `control-definitions`
   - `model-compatibility`
   - `sample-code`
   - `firmware-notes`
3. Каждый файл исследовать отдельной задачей.
4. Из каждой задачи получать только структурированный output.
5. Финальный knowledge-base собирать уже из этих структурированных outputs.

---

## Кто что должен делать

### NotebookLM
Лучше всего использовать как "читателя и локатора фактов" по PDF.

Его роль:
- находить точные определения в PDF
- сопоставлять таблицы и разделы
- вытаскивать enum / диапазоны / форматы
- отвечать "где в документации это сказано"
- сравнивать похожие разделы между версиями PDF

NotebookLM не должен быть единственным источником итогового JSON.
Он должен производить промежуточные факты, а не финальную архитектуру.

### Claude / Codex
Лучше всего использовать как "компилятор знаний" для проекта.

Его роль:
- приводить факты к структуре проекта
- убирать дубли и противоречия
- превращать вывод NotebookLM в JSON/TS/MD
- строить capability-модель
- решать, что идёт в runtime, а что остаётся как reference

### Вы
Ваше участие критично в 3 местах:
- выбирать, какие реальные камеры важны в первую очередь
- подтверждать поведение на железе, если документация сомнительна
- утверждать, какие функции реально нужны в UI/bridge, а какие просто "поддерживаются в API"

---

## Целевая система исследования

Ниже схема, которая масштабируется на 200k строк без взрыва по токенам.

### Stage 1. Source Manifest

Сделать таблицу всех исходников:

| source_id | file_name | type | version | topic | priority |
|---|---|---|---|---|---|
| sony-sdk-pdf-main | CameraRemoteSDK.pdf | protocol | 2.00.02 | core protocol | high |
| sony-ptpdef | PTPDef.h | property-definitions | 2.00.02 | opcodes/propcodes | high |
| sony-deviceprops | DevicePropItemList.h | property-definitions | 2.00.02 | value formats | high |
| sony-capturedlg | CaptureDlg.cpp | sample-code | 2.00.02 | handshake/flows | high |

Результат:
- `docs/research/sony-source-manifest.md`

### Stage 2. Fact Extraction

Для каждого source-файла делается отдельная карточка:

- что это за файл
- какие сущности он определяет
- что из него можно извлечь достоверно
- какие есть сомнительные места
- какие разделы надо проверить дополнительно

Результат:
- `docs/research/extract/<source_id>.md`

### Stage 3. Normalized Fact Tables

Промежуточные таблицы, не привязанные к коду:

- `research/properties/*.json`
- `research/controls/*.json`
- `research/models/*.json`
- `research/capabilities/*.json`

Каждая запись должна содержать `evidence`.

Пример поля:

```json
{
  "id": "iso",
  "propCode": "0xD21E",
  "dataType": "uint32",
  "rawFormat": "Direct ISO value",
  "confidence": "confirmed",
  "evidence": [
    {
      "sourceId": "sony-deviceprops",
      "section": "ISO Sensitivity",
      "note": "UINT32 direct values 100..102400"
    }
  ]
}
```

### Stage 4. Project Compilation

Только после fact tables генерируются/обновляются:

- `knowledge/sony/*.json`
- `knowledge/sony/models/*.json`
- `src/sony/models/*.ts`

### Stage 5. Runtime Wiring

Когда knowledge уже достаточно зрелый:
- capability gating
- filtered actions
- filtered presets
- filtered feedbacks
- safer UI exposure

---

## Какой output просить у NotebookLM

Самая важная ошибка: нельзя просить "summarize this PDF".

Нужно всегда просить только один из 5 типов результата:

### Тип A. Entity extraction
Когда нужен список свойств, enum, команд.

### Тип B. Semantic extraction
Когда нужно понять значение поля и формат кодирования.

### Тип C. Compatibility extraction
Когда нужно понять, на каких моделях / версиях работает функция.

### Тип D. Procedure extraction
Когда нужен flow: handshake, connect, polling, record toggle.

### Тип E. Contradiction check
Когда нужно сверить PDF vs header vs sample code.

---

## Готовые вопросы для NotebookLM

Ниже набор хороших вопросов. Их лучше задавать по одному документу или по одной группе близких документов.

### 1. Для протокола и handshake

1. "Найди точную последовательность установления PTP/IP remote-control session для Sony камер. Покажи шаги по порядку, параметры вызовов, expected responses и все retry conditions."
2. "Где в документации описано различие между `OpenSession`, `SDIO_Connect`, `SDIO_GetExtDeviceInfo` и `SDIO_OpenSession`? Сошлись на разделы и объясни, когда какой вызов обязателен."
3. "Извлеки все opcode, относящиеся к session / transport / event handling. Верни таблицу: opcode, имя, параметры, data phase, safe/dangerous если это видно."
4. "Есть ли в документации отличия PTP2 и PTP3 handshake? Верни только подтверждённые различия с указанием раздела."

### 2. Для property-каталога

1. "Извлеки все `DevicePropCode` / `PropCode`, упомянутые в этом документе. Верни таблицу: hex code, name, data type, read/write, enum/range, notes."
2. "Для каждого свойства из документа покажи точный формат raw value. Особенно интересуют `UINT16`, `UINT32`, `INT16`, string и bitmask поля."
3. "Найди свойства, у которых документация даёт enum-значения. Верни только нормализованную таблицу enum."
4. "Найди свойства, которые явно указаны как movie/video related, а не still-photo only."
5. "Найди свойства, для которых есть ограничения по режиму камеры, firmware или модели."

### 3. Для controls / buttons

1. "Извлеки все control codes и button codes из документа. Для каждого укажи payload format и required press sequence."
2. "Найди все места, где описано отличие absolute set vs step/notch control."
3. "Есть ли команды, которые опасны для UI по умолчанию: format media, factory reset, network setup, streaming config? Верни отдельный список."
4. "Покажи, какие controls относятся к focus, recording, navigation, media, HDMI, streaming, PTZ."

### 4. Для capability extraction

1. "Собери признаки capabilities из документа: какие свойства или команды подтверждают наличие ND, focus position, lens info, tally, PTZ, streaming, HDMI record control."
2. "Для каждой capability верни: supporting prop codes, required protocol version, model hints, exclusions."
3. "Есть ли в документе прямые указания, что функция доступна только на камерах с физическим модулем (например ND или PTZ)?"

### 5. Для model compatibility

1. "Извлеки все model identifiers и свяжи их с protocol generation/version, если это указано."
2. "Найди таблицы совместимости камер и верни формат: model id, family, protocol version, notable features."
3. "Есть ли в документации признаки, по которым можно программно определить поколение камеры или PTP version?"
4. "Собери всё, что документ говорит про FX3 / FX6 / FX30 / ZV-E10 II / FR7 / Z200 / NX800 / Alpha 1 / Alpha 1 II."

### 6. Для sample code и cpp/h files

1. "Извлеки из sample code реальные рабочие sequence-вызовы: connect, poll, get props, set prop, trigger record."
2. "Какие структуры данных используются для описания properties в коде SDK? Верни имена структур и значения полей."
3. "Где sample code противоречит PDF? Верни только реальные противоречия."

### 7. Для сверки и contradiction checks

1. "Сравни этот PDF и этот header-файл. Где значения prop codes / enum / data types совпадают, а где расходятся?"
2. "Есть ли случаи, где PDF говорит одно, а sample code использует другой параметр или другой порядок вызовов?"
3. "Какие свойства или команды выглядят устаревшими, legacy-only или still-photo only?"

---

## Формат ответа, который нужно просить у NotebookLM

Чтобы потом было легко собирать знания, просите не prose, а жёсткую структуру.

### Шаблон для таблиц

```text
Return result as a table with columns:
code | name | data_type | category | readable | writable | control_type | enum_values | range | protocol_version | models | evidence_quote | source_section | confidence
```

### Шаблон для процедур

```text
Return result as:
1. Ordered procedure steps
2. Required parameters per step
3. Expected response per step
4. Retry / delay rules
5. Notes about PTP2/PTP3 differences
6. Exact source sections used
```

### Шаблон для contradictions

```text
Return only confirmed contradictions in a table:
topic | source_a | source_b | contradiction | likely_resolution | confidence
```

---

## Какой компактный промежуточный формат хранить

Лучше не копить огромные summary. Лучше хранить много коротких evidence-файлов.

### Рекомендуемая папка

```text
research/
  sony-api/
    manifest/
    extracts/
    facts/
      properties/
      controls/
      capabilities/
      models/
    contradictions/
```

### Один факт = одна запись

Минимальная форма:

```json
{
  "id": "movie_rec_button",
  "kind": "control",
  "code": "0xD2C8",
  "name": "Movie Rec Button",
  "summary": "REC toggle by hold-style button press",
  "protocol": ["ptp2", "ptp3"],
  "evidence": [
    {
      "sourceId": "sony-ptpdef",
      "section": "Extended Control Codes",
      "confidence": "confirmed"
    }
  ]
}
```

Это намного лучше, чем 20-страничный markdown-summary, который потом нельзя переиспользовать.

---

## Как встраивать эти знания в программу

В текущем проекте уже есть правильные места встройки.

### 1. `knowledge/sony/command-catalog.json`
Сюда складывать:
- opcode
- параметры
- sequence requirements
- safe/dangerous

### 2. `knowledge/sony/control-catalog.json`
Сюда складывать:
- controlCode
- control type
- payload format
- button/notch semantics

### 3. `knowledge/sony/capability-catalog.json`
Сюда складывать:
- capability id
- какие prop/control/opcode её подтверждают
- runtime detection rule
- protocol requirements

### 4. `knowledge/sony/models/*.json`
Сюда складывать:
- model ids
- ptp version
- confirmed capabilities
- exclusions
- notes

### 5. `src/sony/models/*.ts`
Это уже скомпилированный слой, минимальный и безопасный.
Только подтверждённые capability flags.

### 6. runtime
После накопления фактов можно включать:
- capability gating в actions/feedbacks/presets
- per-model filtering
- safer polling profiles
- отображение только реально поддерживаемых контролов

---

## Практический процесс работы по неделям

### Волна 1. Core protocol
Цель:
- handshake
- packets
- opcode catalog
- property blob parsing

### Волна 2. Exposure + recording + focus
Цель:
- ISO
- shutter
- f-number
- rec state
- movie rec button
- focus mode
- near/far

Это даст основной рабочий Sony-модуль почти для всех камер.

### Волна 3. White balance + HDMI + lens + media

### Волна 4. Streaming + tally + PTZ + advanced PTP3

### Волна 5. Model-specific verification

---

## Приоритет камер

Если хотите быстро получить практическую пользу, сначала исследовать и компилировать:

1. `ILME-FX30`
2. `ILME-FX3`
3. `ILME-FX6`
4. `ILCE-ZV-E10M2`
5. `PXW-Z200`
6. `HXR-NX800`
7. `ILME-FR7`
8. `BRC-AM7`

Это покроет:
- обычные cine/photo bodies
- новую PTP3 линейку
- camcorder branch
- PTZ branch

---

## Ключевые правила качества

### Всегда фиксировать evidence
Любой факт без источника потом ломает доверие ко всей базе.

### Не смешивать capability и model
Capability = feature across models.
Model spec = compiled matrix for one family.

### Не считать "описано в PDF" равным "точно работает"
Для runtime-фич важнее:
- документация
- sample code
- live capture

Лучший уровень уверенности возникает только при совпадении этих трёх источников.

### Не добавлять UI/control только потому что код существует
Если функция опасная, неактуальная или не подтверждена на нужных камерах, она остаётся в knowledge, но не попадает в actions/presets.

---

## Самый полезный стартовый набор задач для NotebookLM

Если начать прямо сейчас, я бы дал NotebookLM ровно эти 8 задач:

1. Извлечь весь handshake и session flow из PDF и sample code.
2. Извлечь все opcode с параметрами и разделить их по категориям.
3. Извлечь все propCode и типы данных из `PTPDef.h`.
4. Извлечь все форматы raw values и enum/range из `DevicePropItemList.h`.
5. Извлечь все button/control sequences из sample code.
6. Собрать список model ids и связать их с PTP поколением.
7. Отдельно собрать все PTP3-only функции `0xD3xx+`, `0xD4xx+`, `0xD5xx+`.
8. Сделать contradiction report: PDF vs headers vs sample code.

---

## Что делать дальше в этом проекте

Следующий практический шаг здесь:

1. Создать `source manifest` по вашим PDF / SDK файлам.
2. Подготовить шаблоны `extract` и `fact` файлов.
3. Начать с 3 источников:
   - `PTPDef.h`
   - `DevicePropItemList.h`
   - `CaptureDlg.cpp`
4. Скомпилировать первую полную волну:
   - protocol
   - properties
   - controls
   - model matrix
5. После этого уже можно автоматически расширять `knowledge/sony/*.json`.

Если захотите, следующим сообщением можно перейти из плана в практику:
- я подготовлю шаблоны файлов для исследования прямо в репозитории;
- или помогу составить первый пакет конкретных запросов для NotebookLM под ваши реальные PDF/SDK файлы.
