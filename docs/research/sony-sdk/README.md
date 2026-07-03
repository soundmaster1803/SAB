# Sony SDK / API source docs — drop folder

Сюда Иван кладёт **оригиналы Sony API/SDK** (PDF, спеки, таблицы). Claude читает их
напрямую (PDF поддерживается постранично) и извлекает подтверждённые факты в код и в
`knowledge/sony/*.json`.

## Как класть
- Файлы в эту папку: `docs/research/sony-sdk/<любое-имя>.pdf`
- Осмысленные имена приветствуются (напр. `sony-remote-sdk-api-reference.pdf`,
  `ptp-ext-device-props.pdf`).
- Большие PDF — это нормально, читаю по частям.

## Что Claude вытащит (приоритет — закрыть текущие дыры)
1. **iris/shutter Auto/Manual** — подтвердить пропы и значения (сейчас backend отдаёт 501).
   Кандидаты из research: iris cinema `0xD001` UINT8 (0x01 Man/0x02 Auto), gain `0xD01C` UINT8,
   PASM `0x500E` UINT16.
2. **Разрешить противоречия enum** `0x500E` (P/A/S/M) и `0x5005` (WB Auto/CT) — сейчас источники
   расходятся, взяли catalog-версию; нужен первоисточник.
3. **Проп авто-выдержки для cinema-камер** (FX6/Z200) — не подтверждён.
4. **Новые пропы/опкоды** для полного управления (то, чего ещё нет в `constants.ts` и
   `atem-decoder.ts`).

## Что Claude сделает после чтения
- Обновит `src/sony/constants.ts` (пропы/enum) и `knowledge/sony/*.json` (с пометкой источника).
- Реализует отложенные ветки `/mode` (iris/shutter) и bulk-эквиваленты.
- Отметит в `CODE_REVIEW_AND_ROADMAP.md`, что подтверждено документом, а что всё ещё требует железа.

> Примечание: NotebookLM не отдаёт исходники по API — поэтому кладём сюда оригиналы
> (те же файлы, что заливались в NotebookLM).
