# ATEM Domain

## Что это
ATEM domain отвечает за связь со свитчером и связанные состояния/события.

## Главные каталоги
- `src/atem/listener.ts`
- `src/atem/discovery.ts`
- `src/atem/state/`
- `src/atem/actions/`
- `src/atem/feedbacks/`
- `src/atem/variables/`
- `src/atem/models/`

## Что здесь живёт
- connect/disconnect
- tally state
- camera-control event intake
- discovery устройств
- derived ATEM state

## Что не должно здесь жить
- Sony transport logic
- UI rendering
- bridge policy decisions

## Какие файлы читать для типичной задачи
- connection/discovery -> `listener.ts`, `discovery.ts`
- state issue -> `state/raw.ts`, `state/derived.ts`
- API entry -> `src/api/routes/atem.ts`
- UI side -> `frontend/src/panels/atem/`

## Риск
Изменения в ATEM части могут ломать:
- подключение к свитчеру
- tally
- dispatch событий в bridge

## Проверка
- `npm run typecheck`
- `npm run build`
- по возможности проверка connect/discover на реальном ATEM

## Discovery Workflow

### mDNS Discovery
- Использует протокол Bonjour (mDNS) для поиска ATEM switchers в локальной сети
- Прослушивает сервисы: `_switcher_ctrl._udp.local.` и `_blackmagic._tcp.local.`
- Парсит TXT records для извлечения model, unique_id, firmware
- Таймаут по умолчанию 3 секунды (настраивается 0.5-10 сек)

### API Endpoints
- `GET /api/atem/discover?timeout=<ms>` — сканирование сети
- `GET /api/atem/favorites` — список избранных устройств
- `POST /api/atem/favorites` — добавить в избранное
- `DELETE /api/atem/favorites/:ip` — удалить из избранного

### UI Features
- Кнопка сканирования с dropdown списком найденных устройств
- Отображение IP, model, firmware
- Добавление/удаление из favorites
- Сообщения об ошибках при неудаче сканирования

### Troubleshooting mDNS Issues
- **Firewall блокирует**: Проверьте, что mDNS (порт 5353 UDP) разрешен
- **Нет устройств**: Убедитесь, что ATEM включен и в той же подсети
- **Старая прошивка**: Некоторые модели могут не анонсировать себя
- **Multi-homed системы**: Выберите правильный сетевой интерфейс

### Model-Specific Notes
- **ATEM Mini Family**: Полная поддержка всех capabilities
- **ATEM 2 M/E Family**: Поддержка до 20 входов
- **ATEM Constellation Family**: Высокопроизводительные модели с расширенными возможностями

### Capability Gating
- Используется `getATEMModelSpec()` для определения поддерживаемых функций
- Gating применяется в `src/bridge/runtime.ts` для camera control и sync
- Все текущие модели поддерживают одинаковый набор capabilities
