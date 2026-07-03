# SAB — Code Review & Roadmap

Дата ревью: 2026-07-04
Версия сборки: 1.0.1-beta
Охват: полный разбор backend-ядра (`src/`) + ключевой frontend (`frontend/src/`).
Статус проверок: `npm run typecheck` — чисто.

Цель заказчика: **полное управление камерами из веба, оптовая настройка всех камер разом,
максимальный проброс в ATEM, затем Companion-модуль.** Превью не делаем.

---

## Часть 1. Ревью — состояние сборки

### Что сделано хорошо (не ломать)
- Чистое разделение доменов Sony / ATEM / Bridge / API / UI, границы соблюдены.
- **Runtime-обнаружение возможностей** из живых PTP-данных (`runtime/builder.ts`) — сильнее статических спеков.
- Последовательная командная очередь с жёсткой нумерацией transactionId (`ptp-client.ts` `queue()`).
- Anti-loop cooldown + per-prop throttle реально подключены (`atem-sync.ts:64` вызывает `enterCooldown`).
- Аккуратный graceful disconnect (CloseSession) и reconnect с guard-проверкой удаления (`manager.ts:48`).
- Crash guards, ротация логов, батчинг WS-логов.

### P1 — Активные баги в шиппнутой сборке
1. **Кнопки экспозиции Auto/Manual не работают.** `setMode()` шлёт `POST /api/cameras/:id/mode`
   (`CameraCard.tsx:468`, кнопки на 612/613/632/633/657/658/702/703), но **такого роута в backend нет** → 404.
   Не работает Auto/Manual для ISO, Shutter, Iris, WB.
2. **Прямой ввод выдержки не работает.** `commitShutter()` шлёт `POST /api/cameras/:id/shutter-set`
   (`CameraCard.tsx:471`, поле+кнопка 679/686), роута нет → 404.

### P2 — Латентный / мёртвый код
3. `setFocusArea()` (`ptp-client.ts:936`) есть в транспорте и в реестре действий, но **нет роута** → недостижим из UI.
4. `getFocusDistanceRange()` (`ptp-client.ts:945`) — не используется нигде.
5. `parseModelName()` (`ptp-client.ts:1229`) — помечен deprecated, не используется.
6. `lowPriorityPollLoop()` (`ptp-client.ts:342`) — пустая заглушка «Phase 8», крутит таймер вхолостую.
7. `SONY_PRESETS = []` + applier не реализован (`sony/presets/index.ts`) — пресеты только скелет.

### P3 — Надёжность / полировка
8. **Нет авторизации** ни на одном мутирующем/управляющем роуте. `/api/shutdown` (`server.ts:63`)
   даёт любому в LAN убить приложение. Критично учесть при расширении веб-управления и Companion.
9. Broadcaster сериализует полный state в JSON каждые 500 мс даже при 0 клиентов (`broadcaster.ts:89`).
10. `awaitCameraConnection` хардкодит «15s» в тексте таймаута независимо от `timeoutMs`
    и дублирует детект (event + poll) — `services/cameras.ts:50`.
11. Персист конфигурации: `updateCameraGuid` пишет на диск напрямую, полагаясь на общий объект-референс
    с in-memory `appConfig` — работает, но хрупко (`config.ts:81` + `manager.ts:31`).
12. atem-decoder: ND-фильтр (cat1/param15) и Auto WB декодируются, но `sonyMethod:'none'` — не пробрасываются.
    Обратный sync (Sony→ATEM) покрыт частично.

---

## Часть 2. План исправлений

### Stage 0 — Стабилизация (чинит P1/P2, без новых фич)
- Реализовать `POST /api/cameras/:id/mode` (Auto/Manual для iso/shutter/iris/wb).
  ISO Auto = сентинел `0x00FFFFFF`; для shutter/iris/wb — уточнить Sony-проп (нужен sony-research-agent).
- Реализовать `POST /api/cameras/:id/shutter-set` — парсинг «1/100» → Sony-энкодинг, ближайший шаг.
- Подключить `setFocusArea` роутом **или** убрать ожидание из UI (решить по приоритету).
- Убрать/добить мёртвый код: `getFocusDistanceRange`, `parseModelName`, решить судьбу `lowPriorityPollLoop`.
- Критерий готовности: все кнопки в `CameraCard` дают 2xx; нет 404 в логах при клике.

---

## Часть 3. План нововведений (под цели заказчика)

### Stage 1 — Полный веб-контрол одной камеры (паритет)
Довести панель до полного набора: focus area, exposure mode, ND (если проброс есть), gain-таблицы.
Файлы: `api/routes/cameras.ts`, `sony/ptp-client.ts`, `CameraCard.tsx`.

### Stage 2 — Выбор группы + оптовая настройка (главная цель)
- UI: чекбоксы/«выбрать все»/группа по ATEM-input в `CameraGrid`.
- Backend: `POST /api/cameras/bulk/adjust`, `/bulk/set`, `/bulk/mode` — принимают `ids[]` + операцию.
- Использовать существующий паттерн `startAllRecording` в `manager.ts` как основу для групповых операций.
- Правильная обработка partial-failure (как `Promise.all` + сбор ошибок).

### Stage 3 — Пресеты и copy/paste
- Дописать applier поверх скелета `sony/presets/index.ts` (валидация по capabilities, порядок ISO→shutter, partial-fail).
- REST: сохранить состояние камеры как пресет, применить пресет на группу.
- Copy/Paste = частный случай: «снять с cam A → налить на выбранные».

### Stage 4 — Максимальный мост в ATEM
- Пройти все категории BMD Camera Control в `atem-decoder.ts`, замапить всё, что Sony умеет
  (ND, exp mode, focus area где применимо).
- Добить обратный sync `sync/atem-sync.ts` до полного покрытия состояния.

### Stage 5 — Абстракция `CameraDriver` (задел под мультибренд)
- Ввести интерфейс драйвера камеры; `SonyPTPClient` — первая (пока единственная) реализация.
- `CameraManager`, роуты и bridge работают через интерфейс, а не напрямую с Sony.
- Ничего не ломает; открывает путь к Canon/BM/VISCA позже.

### Stage 6 — Companion-модуль
- Отдельный пакет `companion-module-sab-*` (формат Bitfocus Companion, Node).
- Работает поверх готовых REST/WS — ядро не трогаем.
- Требует Stage 2/3 (bulk+пресеты), т.к. модуль их и вызывает.

### Stage 7 — Хардненинг веб-управления
- Токен/ключ на мутирующие и управляющие роуты (по образцу `key=` у MiddleControl).
- Защитить `/api/shutdown`. Обязательно до широкого доступа/Companion.

---

## Порядок исполнения
0 (стабилизация) → 1 → 2 → 3 → 4 → 5 → 6, с 7 параллельно перед выходом наружу.
Приоритет заказчика (bulk + ATEM bridge) закрывается на Stage 2 и Stage 4.

---

## Work Log

### Stage 0 — в работе (начато 2026-07-04)
- **[done]** `ptp-client.ts`: добавлен метод `setPropNearest(propCode, targetRaw)` — абсолютная
  установка пропа в ближайшее значение enum-списка (переиспользуется под bulk/пресеты).
- **[done]** `ptp-client.ts`: удалён мёртвый код — `parseModelName()` и `getFocusDistanceRange()`.
- **[done]** `api/routes/cameras.ts`: добавлен `POST /api/cameras/:id/shutter-set` (P1 — чинит прямой
  ввод выдержки, `commitShutter` в UI). Парсит «1/100»/«100» → ближайшая выдержка через `setPropNearest`.
- **[done]** `api/routes/cameras.ts`: добавлен `POST /api/cameras/:id/focus-area` (P2 — подключает
  `client.setFocusArea`, ранее недостижимый). UI-кнопок пока нет — роут готов на будущее.
- **[done]** `ptp-client.ts`: методы `setWhiteBalanceMode(auto)` (0x5005: AWB 0x0002 / CT 0x8006)
  и `setIsoAuto()` (0xD21E ← 0x00FFFFFF). Значения подтверждены sony-research.
- **[done]** `api/routes/cameras.ts`: добавлен `POST /api/cameras/:id/mode` (P1). Работают: WB Auto/Manual
  (обе стороны), ISO→Auto. Возвращают честный **501 pending** до подтверждения на железе:
  iris/shutter Auto/Manual и «ISO Manual из Auto».
- typecheck после каждого шага — чисто; смоук-тест: все новые роуты зарегистрированы (JSON-ответы).

**Итог Stage 0:** P1-баг прямого ввода выдержки исправлен; кнопки WB Auto/Manual и ISO→Auto работают;
focus-area подключён; мёртвый код убран. **Осталось для полного Auto/Manual** (не входит в Stage 0,
требует железа Ивана): iris/shutter toggle + ISO Manual из Auto — см. Research-заметки ниже.

### Stage 2 — оптовая настройка группы камер (сделано 2026-07-04)
Backend:
- **[done]** `api/routes/cameras.ts`: `POST /api/cameras/bulk` — `{ ids: string[]|"all", op, params }`.
  Ops: adjust, color-temp, shutter-set, mode, focus-mode, focus-area, af, record.
  `Promise.all` + per-camera результаты (`{id,ok,error}`) → partial-failure виден, batch не падает.
- **[done]** общий хелпер `applyOp()` (зеркалит одиночные роуты), `FOCUS_MODE_MAP` вынесен в модуль-скоуп
  (убран дубль в одиночном `/focus-mode`), `asStep()` для валидации delta/direction.

Frontend:
- **[done]** `stores/selection.ts` — стор выбранных камер (Set id).
- **[done]** `lib/api.ts` — общий `post()` + `bulk(op, params, ids)`.
- **[done]** `panels/cameras/BulkBar.tsx` (+css) — панель: счётчик, Select all/Clear, группы кнопок
  ISO/IRIS/SHUT/WB(K)/WB Auto-Man/FOCUS(AF-C·MF·AF)/REC(●■), строка результата «N/M ok».
- **[done]** чекбокс выбора в шапке `CameraCard`; `BulkBar` подключён в `App` над гридом.
- backend typecheck + `npm run build:ui` — чисто; UI отдаётся, бандл содержит bulk-код.

Возможные доработки Stage 2 (не блокеры): фильтр «выбрать по ATEM-input», подсветка выбранной карточки,
bulk shutter-set/focus-area из UI (эндпоинты уже готовы).

### Заметки sony-research (2026-07-04) — что нужно железо
- **Два механизма:** PASM-режим `0x500E` (ZV-E10 II, FX30 в P/A/S/M) vs per-parameter cinema-тоглы
  (FX6/Z200/FX30 Cine): iris `0xD001` UINT8 (0x01 Manual/0x02 Auto), gain `0xD01C` UINT8.
- **Противоречия в наших данных (не хардкодить без лога):** enum `0x500E` (catalog: 1=M,2=P,3=A,4=S;
  ref-cameras: 1=P,3=A,4=S,5=M) и enum `0x5005` (взяли catalog-версию 0x0002/0x8006).
- **Нет подтверждённого пропа авто-выдержки** для cinema-камер — только AE/AGC, нужен дамп.
- **UINT8-паковка:** `0xD001`/`0xD01C` не в poll-блобе → `packPropValueDynamic` уйдёт в дефолт (4 байта)
  и рискует 0x2005; паковать 1 байтом явно при реализации.
