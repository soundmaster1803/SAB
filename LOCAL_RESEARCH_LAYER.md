# Local Research Layer

Цель: не тратить дорогие токены на поиск по большим библиотекам, PDF и reference docs.

## Источники
- local SAB docs
- local code search
- NotebookLM
- Open NotebookLM / local notebook-style research tools
- локальные выжимки из Sony / ATEM manuals

## Идея слоя
Task router сначала решает, нужен ли research.
Если да, он не зовёт coding model сразу, а сначала идёт в research source.

Поток:

```text
Task
  ↓
Router
  ↓
Need protocol knowledge?
  ↓ yes
Research source
  ↓
Short structured summary
  ↓
Coding model
```

## Что должен возвращать research layer
- краткий ответ по вопросу
- список relevant sections / docs
- точные property/command names, если нужны
- warnings / ambiguities
- короткие excerpts, а не весь документ

## Что можно сделать локально
- держать extracted notes по Sony/ATEM
- хранить markdown summaries по большим PDF
- подключить Open NotebookLM как локальный search/summarization слой
- дать router-у простой интерфейс: `research(query, sourceType)`

## Следующий практический шаг
Сделать простой `research packet` формат:
- query
- source type
- expected answer format
- max length

И потом уже выбрать конкретную local tool binding.
