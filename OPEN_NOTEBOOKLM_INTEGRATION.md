# Open NotebookLM Integration Notes

## Цель
Использовать Open NotebookLM или похожий локальный research tool как внешний слой поиска по большим reference docs.

## Роль в системе
Он не пишет код SAB.
Он возвращает сжатую исследовательскую справку для router-а и coding model.

## Желаемый поток
1. Router понимает, что нужна внешняя протокольная справка
2. Создаётся research packet
3. Packet отправляется в Open NotebookLM / local notebook tool
4. Возвращается:
   - summary
   - relevant sections
   - exact names / commands / props
   - short excerpts
5. Только потом coding AI получает задачу

## Что подготовлено уже сейчас
- `LOCAL_RESEARCH_LAYER.md`
- `RESEARCH_PACKET_SPEC.md`
- `scripts/research-packet.js`
- `knowledge/protocol/sony/`
- `knowledge/protocol/atem/`

## Следующий технический шаг
Когда будет понятен конкретный local tool interface, добавить binding script, например:
- `scripts/research-open-notebooklm.js`

Он должен:
- принимать research packet
- отправлять query в local tool
- возвращать сжатый результат в едином формате
