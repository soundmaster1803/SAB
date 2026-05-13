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
"version": "0.19.0"
```

### 2. Собрать

```bash
npm run build       # TypeScript → dist/bridge.cjs
npm run build:ui    # React → public/
```

### 3. Упаковать

```bash
# только Mac (быстро, ~3 мин)
npm run app:pack:mac

# только Windows (можно с мака, ~5 мин)
npm run app:pack:win

# всё сразу
npm run app:pack
```

### 4. Забрать файлы из `release/`

| Файл | Для кого |
|---|---|
| `SAB-X.X.X-arm64.dmg` | Mac M-серия (M1–M4) |
| `SAB-X.X.X.dmg` | Mac Intel |
| `SAB Setup X.X.X.exe` | Windows |
| `SAB-X.X.X-win.zip` | Windows portable (без установки) |

Просто скинь нужный файл тестеру. Никакого Node.js устанавливать не нужно — всё внутри.

---

## Проверить до раздачи

```bash
npm run app:dev   # запустить лаунчер локально без упаковки
```

Окошко появилось → статус перешёл в **Running** → кнопка **Open UI** открывает браузер → всё ок.

---

## macOS: «Неизвестный разработчик»

Без подписи macOS покажет предупреждение. Тестеры обходят так:

> Правый клик по SAB.app → **Открыть** → **Всё равно открыть**

Один раз — потом запускается нормально.

---

## Конфиг тестера сохраняется здесь

После первого запуска конфиг живёт отдельно от .app — при обновлении не сбрасывается:

- Mac: `~/Library/Application Support/SAB/config.json`
- Windows: `%APPDATA%\SAB\config.json`

---

## Когда первая сборка долгая

При первом запуске `npm run app:pack` electron-builder скачивает Electron (~110 MB) и Wine/NSIS (~25 MB для Windows). Потом всё кешируется — повторные сборки быстрые.
