# First Prompt For Claude

Используй эти файлы:

- [Camera Control PTP 3 Reference.pdf](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/Camera%20Control%20PTP%203%20Reference.pdf)
- [Camera Control PTP 2 Reference.pdf](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/Camera%20Control%20PTP%202%20Reference.pdf)
- [Claude Sony Research Rules](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/docs/research/claude-sony-research-rules.md)
- [Claude Prompts For Sony API Research](/Users/ivankaigarodov/Desktop/ATEM-SONY%20Claude/docs/research/claude-sony-research-prompts.md)

Следуй правилам из файла `Claude Sony Research Rules`.

Твоя задача сейчас НЕ исследовать весь API и НЕ делать общий summary документов.

Сделай только первый этап исследования:

## Задача

1. Построй `section map` для `Camera Control PTP 3 Reference.pdf`.
2. Построй `section map` для `Camera Control PTP 2 Reference.pdf`.
3. Сравни их на уровне разделов и подразделов.
4. Найди:
   - разделы-дубли;
   - разделы, которые есть только в v3;
   - разделы, которые есть только в v2;
   - разделы, которые обязательно читать первыми для runtime Sony module.

## Что считать важным для runtime Sony module

- handshake / session
- operations
- device properties
- controls
- events
- compatibility
- data formats

## Что сейчас не нужно глубоко исследовать

- legal / trademarks
- длинные советы без новых protocol facts
- общие обзорные части, если они только повторяют более детальные разделы

## Формат ответа

Не выводи полный результат в чат. Сохрани его в файл:

`docs/research/extract/ptp-section-map-v2-v3.md`

В самом файле сохрани результат в 4 частях.

### Part A. Section map for v3
Таблица:
`section_id | title | purpose | category | priority`

### Part B. Section map for v2
Таблица:
`section_id | title | purpose | category | priority`

### Part C. Dedup / overlap map
Таблица:
`section in v3 | matching section in v2 | overlap high/medium/low | comment`

### Part D. Research scope recommendation
Списки:
- `must-read first`
- `should-read later`
- `skip-for-now`

Для каждого пункта дай короткую причину.

## Важно

- Не извлекай пока prop codes.
- Не извлекай пока controls.
- Не пытайся перечислить все команды.
- Не делай общий summary по двум PDF.
- Цель только разметить структуру исследования и уменьшить будущий расход токенов.
- В чат верни только:
  - путь к файлу;
  - какие 3-5 разделов нужно читать первыми;
  - есть ли явные крупные дубли между v2 и v3.
