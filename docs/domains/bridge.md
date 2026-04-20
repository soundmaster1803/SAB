# Bridge Domain

## Что это
Bridge это мозг перевода между ATEM и Sony.

## Главные каталоги
- `src/bridge/runtime.ts`
- `src/bridge/intents/`
- `src/bridge/policies/`
- `src/bridge/executors/`
- `src/bridge/sync/`
- `src/bridge/mapper.ts`
- `src/bridge/atem-decoder.ts`

## Что здесь живёт
- нормализация intent
- mapping ATEM values -> Sony values
- anti-loop и throttle
- orchestration между listener и camera manager
- reverse sync в сторону ATEM

## Что здесь не должно жить
- raw Sony transport
- raw ATEM transport
- UI rendering

## Это рискованная зона
Любые изменения здесь могут ломать:
- реакцию на tally/camera-control
- sync состояния
- защиту от loop
- частоту команд

## Как работать
- сначала читать `runtime.ts`
- потом `intents/` и `policies/`
- потом только нужный executor / sync файл
- не делать широкие рефакторинги без необходимости

## Проверка
- `npm run typecheck`
- `npm run build`
- по возможности smoke-test с runtime
