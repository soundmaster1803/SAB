# Sony Staging Knowledge

Эта папка хранит промежуточные машинно-читаемые результаты исследования Sony API.

Смысл:

- `docs/research/extract/` — человекочитаемый анализ
- `knowledge/sony/staging/` — JSON staging для последующего переноса в рабочие knowledge-файлы
- `knowledge/sony/*.json` — рабочие каталоги программы

## Правила

- сюда складываются результаты новых research passes;
- записи должны иметь `status` и `confidence`;
- неоднозначные записи не переносятся напрямую в рабочие каталоги;
- staging-файлы должны быть небольшими и тематически разбитыми.

## Типичный pipeline

1. Claude создаёт `extract` markdown
2. Claude создаёт `staging` json
3. Codex переносит `verified` записи в рабочие knowledge-файлы
4. `ambiguous` и `provisional` остаются в staging до разбора
