# Sony Domain

## Что это
Sony domain управляет Sony-камерами по PTP/IP.

## Главные каталоги
- `src/sony/ptp-client.ts`
- `src/sony/manager.ts`
- `src/sony/protocol/`
- `src/sony/runtime/`
- `src/sony/state/`
- `src/sony/polling/`
- `src/sony/models/`
- `src/sony/constants.ts`
- `src/sony/packet-builder.ts`

## Что здесь живёт
- handshake и transport
- polling
- property parsing
- runtime capability model
- camera state
- команды камере

## Самые чувствительные файлы
- `src/sony/ptp-client.ts`
- `src/sony/manager.ts`
- `src/sony/constants.ts`
- `src/sony/packet-builder.ts`

Эти файлы не трогать без реальной причины.

## Как думать про Sony
Это protocol-first зона.
Сначала смотреть observed props / runtime model / polling strategy, а не гадать по названию камеры.

## Какие файлы читать для типичной задачи
- transport issue -> `ptp-client.ts`, `manager.ts`
- capability issue -> `runtime/builder.ts`, `protocol/prop-knowledge.ts`
- state issue -> `state/raw.ts`, `state/derived.ts`, `state/alerts.ts`
- polling issue -> `polling/strategy.ts`

## Проверка
- `npm run typecheck`
- `npm run build`
- желательно проверка на живой камере, если задача затрагивает transport/control
