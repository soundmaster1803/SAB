# Research Packet Spec

## Цель
Стандартизировать запрос router-а в research layer.

## Packet format

```json
{
  "query": "What Sony PTP property controls focus mode on model X?",
  "source": "open-notebooklm",
  "domain": "sony",
  "expectedFormat": "short-summary-with-excerpts",
  "maxChars": 4000,
  "needExactNames": true
}
```

## Поля
- `query` — что именно ищем
- `source` — `local-notes`, `notebooklm`, `open-notebooklm`
- `domain` — `sony`, `atem`, `bridge`, `api`, `ui`
- `expectedFormat` — краткий формат ответа
- `maxChars` — лимит длины
- `needExactNames` — нужны ли точные property/command names

## Ожидаемый ответ
Research layer должен возвращать:
- summary
- relevant docs/sections
- exact names if found
- warnings/ambiguities
- short excerpts

## Главный принцип
Возвращать сжатую полезную справку, а не целые документы.
