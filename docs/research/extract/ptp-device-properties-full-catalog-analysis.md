# Sony Device Properties Full Catalog Analysis

Источник исследования:
- `Camera Control PTP 3 Reference.pdf`
- `Camera Control PTP 2 Reference.pdf`

Дата фиксации: 2026-04-12
Статус: research extract

## Scope

Этот файл фиксирует результаты большого прохода по полному блоку `Device Properties`.

Цель:
- собрать полный property catalog для Sony capability-platform;
- отделить подтверждённые high-level факты от сырого длинного вывода;
- зафиксировать, что можно переносить в knowledge позже, а что требует дополнительной верификации.

## High-level findings

- v3 command list содержит примерно `733` device properties.
- v2 содержит `41` properties.
- отдельно зафиксирован `1` v2-only property: `0x5004` (`Compression Setting`).
- рабочий диапазон кодов в исследовании: `0x5004` → `0xE112`.
- v2 по структуре значительно уже v3; для современной платформы v3 — основной источник.

## Delivered structure from the large pass

Большой проход был собран в шесть логических частей:

- `Part A` — block map по функциональным группам
- `Part B` — dedup / overlap notes между v2 и v3
- `Part C` — normalized property catalog
- `Part D` — semantic notes по encoding / unit / behavior
- `Part E` — contradictions / ambiguities
- `Part F` — JSON-ready fact records для high-priority properties

Итог большого прохода:

- `14` high-level blocks / groups
- `~733` v3 properties
- `41` v2 properties
- `26` semantic-note candidates
- `13` contradictions / ambiguities
- `44` JSON-ready top-priority fact records

## Main subblocks identified

- exposure / aperture
- shutter
- gain / ISO / EI
- ND filter
- white balance
- focus mode / focus area
- focus position / zoom position
- AF tracking / subject recognition
- picture profile / paint / creative look / scene file
- recording movie / recording still / sequenced shooting
- media status
- audio
- HDMI output
- streaming
- FTP
- PTZ / PTZF / eframing / tally
- battery / power / camera status
- UI / display / system / file settings

## Priority grouping from the research pass

High-priority operational groups for capability-platform:

- exposure / aperture
- shutter
- gain / ISO
- ND filter
- white balance
- focus mode / focus area / focus position
- movie / still recording
- media status
- lens info
- battery / power
- camera status

Medium-priority groups:

- subject recognition / AF tracking
- picture profile / paint / creative look / base look / scene file
- audio
- HDMI output
- PTZ / PTZF / eframing / tally
- time code

Lower-priority or model-specific groups:

- streaming
- FTP
- assignable buttons
- playback / UI / display extras
- license / SceneFile / custom grid / system utility fields

## Strong confirmed findings

### v2 shared core properties remain important

Confirmed shared / overlapping core properties include:

- `0x5005` White Balance
- `0x5007` F-Number
- `0x500A` Focus Mode
- `0x500B` Exposure Metering Mode
- `0x500C` Flash Mode
- `0x500E` Exposure Program Mode
- `0x5010` Exposure Bias Compensation
- `0x5013` Still Capture Mode
- `0xD20D` Shutter Speed
- `0xD20E` Battery Level Indicator
- `0xD20F` Color Temperature
- `0xD210` WB G-M fine-tune
- `0xD218` Battery Remaining
- `0xD21C` WB A-B fine-tune
- `0xD21D` Movie Recording State
- `0xD21E` ISO Sensitivity
- `0xD22C` Focus Area
- `0xD231` Live View Display Effect
- `0xD235` Near/Far Enable Status
- `0xD23F` Picture Profile
- `0xD241` File Format (Movie)
- `0xD242` Recording Setting (Movie)
- `0xD248` / `0xD249` / `0xD24A` media SLOT1 status / remaining
- `0xD24E` AWBLock indication
- `0xD24F` / `0xD250` interval still recording mode / status

### v3 strongly expands the platform

Large v3-only growth areas:

- shutter modes / angle / ECS / extended shutter
- gain / dB / EI / base ISO / ISO auto ranges
- ND filter properties
- detailed white-balance sub-properties and custom WB workflow
- advanced focus / AF tracking / subject recognition
- picture profile internals
- creative look / paint / base look / scene file
- streaming
- FTP
- PTZ / PTZF / tally / eframing
- assignable buttons
- richer battery, media, status and system properties

### Important semantic changes between v2 and v3

Research flagged the following as key behavior changes:

- `0x5007` F-Number: v2 effectively get-only, v3 get/set
- `0x5010` Exposure Bias: v2 effectively get-only, v3 get/set
- `0xD20D` Shutter Speed: v2 effectively get-only, v3 get/set
- `0xD21E` ISO: v2 effectively get-only, v3 get/set
- `0x5004` Compression Setting: v2-only, not part of v3 property surface

### Strong domain split observed in the corpus

The large pass also makes the product-line split much clearer:

- legacy / still-photo-oriented surface remains visible in v2 and overlap properties
- video-oriented controls dominate the v3 expansion
- PTZ / broadcast-specific controls are almost entirely v3-only

In practice this means future normalization should not assume a single flat camera model; it should preserve domain tags such as:

- `photo`
- `video`
- `ptz`
- `system`
- `mixed`

## Good candidates for future deep dives

These properties / groups were correctly identified as needing separate detail-page analysis:

- shutter encodings: `0xD016`, `0xD017`, `0xD20D`
- ISO / gain / EI relations: `0xD01C`–`0xD023`, `0xD21E`
- focus position families: `0xD24C`, `0xE042`, `0xE043`, `0xE088`, `0xE089`
- battery / AC / power-source edge cases
- string / complex payload fields
- PTZF version and enable-status compounds

## Reliability warnings

The raw research output is very useful, but it is **not yet safe** to import directly into `knowledge/sony/*`.

Reasons:

- several rows are duplicated in the raw output
- a few codes appear with conflicting names
- some inferred facts are mixed into confirmed ones
- some semantic notes cite codes that likely do not match the names
- parts of the long dump appear to have been compacted and resumed mid-stream

## Explicitly flagged verification targets

These require a second pass before knowledge import:

- `0xD2B0` possible code-name ambiguity / collision
- exact meaning and layout of `0xD023`
- exact code assignments for some semantic-note examples
- inferred battery sentinel behavior such as `255 = AC`
- exact mappings for PTZ / eframing compounds
- any duplicated codes or duplicated names that appeared in the compacted long dump
- final verification of page references for the tail block around `0xE100`–`0xE112`

## What this extract is good for now

- planning the complete Sony property catalog structure
- deciding category groupings for future JSON catalogs
- identifying which ranges need separate deep dives
- estimating scale of the full Sony capability-platform

## What should happen next

1. Run a verification pass over only the suspicious / ambiguous codes.
2. Extract high-confidence property facts into intermediate JSON records.
3. Only after that compile:
   - `knowledge/sony/capability-catalog.json`
   - `knowledge/sony/models/*.json`
   - future full property catalog files

## Recommended next research pass

Do **not** continue with another 700-property prose dump.

Next pass should be narrow and mechanical:

- verify ambiguous codes
- verify all semantic-note encodings
- verify string / complex payload fields
- verify compound status/version fields

This should produce a smaller, cleaner `fact record` set ready for normalization.

## Suggested normalization strategy

Best next intermediate artifact is **not** a monolithic final catalog.

Prefer this order:

1. build `verified-facts.json` only for high-confidence rows;
2. build `ambiguous-facts.json` for anything with collisions or inferred encoding;
3. only then merge into larger `knowledge/sony` catalogs with explicit provenance.

## Materialized artifacts

The research from this session is no longer only in chat. It has been persisted into project files:

- `knowledge/sony/staging/ptp-device-properties-block-01-02-facts.json`
- `knowledge/sony/staging/ptp-device-properties-priority-facts.json`
- `knowledge/sony/staging/ptp-device-properties-semantic-notes.json`

Working-catalog sync has also started in:

- `knowledge/sony/capability-catalog.json`

Import rule used for this sync:

- only `confirmed` rows with no known collision were promoted into working catalogs;
- ambiguous items such as `0xD2B0` stay in staging until a detail-page verification pass confirms the final mapping.
