#!/bin/bash
# pack.sh — создаёт папку builds/vX.Y.Z с полной рабочей сборкой
# Запуск: npm run pack
# После каждой сессии правок вызывается автоматически через: npm run pack

set -e
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
OUT="builds/v${VERSION}"

if [ -d "$OUT" ]; then
  echo "⚠️  builds/v${VERSION} уже существует — удаляю и пересоздаю"
  rm -rf "$OUT"
fi

mkdir -p "$OUT/dist" "$OUT/public"

# Собранный сервер
cp dist/bridge.cjs "$OUT/dist/bridge.cjs"

# Веб-интерфейс
cp public/index.html "$OUT/public/index.html"

# Зависимости и запуск
cp package.json        "$OUT/package.json"
cp package-lock.json   "$OUT/package-lock.json"

# Конфиг с текущими камерами (если есть — копируем, иначе default)
if [ -f "config.json" ]; then
  cp config.json "$OUT/config.json"
else
  echo '{"atemIp":"","cameras":[]}' > "$OUT/config.json"
fi

# .command скрипт — обновляем версию в баннере
sed "s/v1\.0\.0/v${VERSION}/g" "release/CineLink Bridge.command" > "$OUT/CineLink Bridge.command"
chmod +x "$OUT/CineLink Bridge.command"

# CHANGES.md — генерируем из changelog если есть запись для этой версии
CHANGELOG=".claude/CHANGELOG.md"
if [ -f "$CHANGELOG" ]; then
  cp "$CHANGELOG" "$OUT/CHANGES.md"
fi

echo ""
echo "✅  builds/v${VERSION}/ готов"
echo "   $(du -sh "$OUT" | cut -f1)  — $(ls "$OUT" | wc -l | tr -d ' ') файлов/папок"
echo ""
echo "Содержимое:"
ls -1 "$OUT"
