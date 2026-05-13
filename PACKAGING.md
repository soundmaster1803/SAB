# SAB — Сборка и раздача тестерам

---

## Разово: установить зависимости

```bash
npm install
npm run install:ui
```

---

## Стандартный цикл выпуска

### 1. Поднять версию

В `package.json` поменяй `"version"`:
```json
"version": "1.0.2-beta"
```
То же значение автоматически подхватывается electron-builder и окошком лаунчера.
Файл `VERSION` обновить отдельно (используется backend'ом):
```bash
echo "1.0.2-beta" > VERSION
```

### 2. Собрать

```bash
npm run build       # TypeScript → dist/bridge.cjs
npm run build:ui    # React → public/
```

### 3. Упаковать

```bash
# Mac — универсальный (arm64 + Intel в одном DMG, ~185 MB)
npm run app:pack:mac

# Windows — NSIS-установщик + ZIP (~87 MB)
npm run app:pack:win

# Всё сразу
npm run app:pack
```

### 4. Собрать клинеры

```bash
npm run app:cleaners
```

Создаёт `release/SAB-Cleaner.app` и `release/SAB-Cleaner.exe`.
Тестер запускает клинер перед установкой новой версии поверх старой.

### 5. Собрать папку релиза

```bash
npm run app:collect
```

Копирует установщики и клинеры в `releases/v<version>/`:

```
releases/
  v1.0.1-beta/
    SAB-1.0.1-beta-universal.dmg   ← Mac (M1–M4 + Intel)
    SAB Setup 1.0.1-beta.exe       ← Windows
    SAB-Cleaner.app                ← запустить до установки (Mac)
    SAB-Cleaner.exe                ← запустить до установки (Win)
```

Папка `releases/` не входит в git — только на локальной машине разработчика.

---

## Проверить до раздачи

```bash
npm run app:dev
```

Запускает Electron-лаунчер без упаковки. Ожидаемое поведение:
- иконка SAB появляется в menu bar (top right)
- окно лаунчера открывается автоматически
- статус переходит в **Running** через ~2 сек
- кнопка **Open UI** открывает браузер с интерфейсом
- **Hide** скрывает окно, иконка в menu bar остаётся
- клик по иконке в menu bar → окно возвращается
- **Quit** закрывает всё

---

## macOS: «Неизвестный разработчик»

Без подписи macOS блокирует первый запуск. Обходится один раз:

> Правый клик по SAB.app (или SAB-Cleaner.app) → **Открыть** → **Всё равно открыть**

После этого запускается нормально.

---

## Конфиг тестера не затрагивается при обновлении

Конфиг хранится отдельно от `.app` и **не входит в установщик**:

- Mac: `~/Library/Application Support/SAB/config.json`
- Windows: `%APPDATA%\SAB\config.json`

При первом запуске создаётся пустой конфиг. При обновлении существующий не трогается.

---

## Иконка в menu bar — как пересобрать

Если обновился логотип:

```bash
node scripts/make-icons.js путь/к/логотипу.png
# пересоздаёт electron/assets/icon.icns, icon.ico

sips -s format png electron/assets/icon.icns \
     --out electron/assets/tray.png -Z 32
# пересоздаёт tray.png для menu bar
```

---

## Когда первая сборка долгая

При первом `npm run app:pack` electron-builder скачивает Electron (~110 MB) и Wine/NSIS (~25 MB для Windows). Потом кешируется — повторные сборки быстрые.
