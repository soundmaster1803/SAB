# Sony PTP Section Map Analysis

Источники:
- `Camera Control PTP 3 Reference.pdf` — 2020 models or later
- `Camera Control PTP 2 Reference.pdf` — models earlier than 2020

Дата фиксации: 2026-04-12
Статус: research extract

## Scope

Этот файл фиксирует section-level карту обеих Sony PTP references:

- структуру разделов `v3`
- структуру разделов `v2`
- overlap / subset relationship
- приоритет чтения для runtime implementation

## Key structural finding

`v2` — строгий поднабор `v3` на уровне структуры разделов.

Практический вывод:

- для runtime-модуля под камеры `2020+` (`FX30`, `FX6`, `Z200`, `FR7`) authoritative source = `v3`
- `v2` нужен в основном как:
  - cross-check для pre-2020 behavior
  - подтверждение edge cases по overlap-свойствам
  - fallback-источник для legacy PTP2 support

## v3 Section Map

Главные разделы `v3`:

- `v3.1` Overview / session flow
- `v3.2` Operations command list
- `v3.3` Device properties command list
- `v3.4` Controls command list
- `v3.5` Events command list
- `v3.6` Vendor response codes
- `v3.7` Object formats
- `v3.8`–`v3.11` compatibility matrices
- `v3.12` operation detail pages
- `v3.13` device property detail pages
- `v3.14` control detail pages
- `v3.15` event detail pages
- `v3.16` data-format chapter
- `v3.17`–`v3.23` tips / special workflows
- `v3.24` legal

Most important `v3.1.x` subsections:

- `v3.1.1` PTP-IP connection flow
- `v3.1.2` Connect
- `v3.1.3` Get Property
- `v3.1.4` Set Property
- `v3.1.5` Send Control Command
- `v3.1.6` About Events
- `v3.1.8` Live View
- `v3.1.10` Movie Recording
- `v3.1.13` Disconnect

## v2 Section Map

Главные разделы `v2`:

- `v2.1` Overview / session flow
- `v2.2` Operations command list
- `v2.3` Device properties command list
- `v2.4` Controls command list
- `v2.5` Events command list
- `v2.6` Vendor response codes
- `v2.7` Object formats
- `v2.8`–`v2.11` compatibility matrices
- `v2.12` operation detail pages
- `v2.13` property detail pages
- `v2.14` control detail pages
- `v2.15` event detail pages
- `v2.16` legal

## Overlap Map

High-overlap areas:

- overview / handshake flow
- PTP-IP setup
- connect / disconnect
- get/set property flow
- control-dispatch flow
- image retrieval flow
- live view setup
- movie recording flow
- command-list chapter structure
- compatibility chapter structure

Medium-overlap areas:

- operation detail pages
- property detail pages
- control detail pages

Low-overlap or v3-expanded areas:

- events
- PTZ-specific live view
- transfer mode
- video-only acquisition flow
- data-format chapter
- tips chapter

## v3-only structural additions

Sections only in `v3`:

- `v3.1.6` About Events
- `v3.1.9` Live View for Pan/Tilt Type Cameras
- `v3.1.11` Content Transfer Mode
- `v3.1.12` Acquiring Content from Video Only Models
- `v3.16` Data Format
- `v3.17`–`v3.23` Tips chapter

And large surface growth in command/detail chapters:

- roughly `+45` operations
- roughly `+170` device properties
- roughly `+55` controls
- roughly `+32` events

## Read Priority

### Must-read first

These sections define the minimum runtime contract:

- `v3.1.1` For Connections Using PTP-IP
- `v3.1.2` Connect
- `v3.1.3` / `v3.1.4` Get/Set Property
- `v3.1.5` Send Control Command
- `v3.2` Operations command list
- `v3.3` Device Properties command list
- `v3.4` Controls command list
- `v3.8` Compatibility — Operations
- `v3.9` Compatibility — Device Properties
- `v3.10` Compatibility — Controls
- `v3.12` Operations detail pages for core runtime ops:
  - `SDIO_Connect`
  - `SDIO_GetExtDeviceInfo`
  - `SDIO_SetExtDevicePropValue`
  - `SDIO_ControlDevice`
  - `SDIO_GetAllExtDevicePropInfo`

### Should-read later

These sections matter for deeper runtime fidelity:

- `v3.13` Device Properties detail pages for exposure / WB / ND / focus / movie-rec / battery
- `v3.14` Controls detail pages for shutter / ISO / movie-rec / focus / AEL
- `v3.15` Event detail pages for:
  - `SDIE_DevicePropChanged`
  - `SDIE_MovieRecOperationResults`
  - `SDIE_AFStatus`
- `v3.16` Data Format
- `v3.1.6` About Events
- `v2.12` / `v2.13` as cross-check for overlap behavior and pre-2020 support
- `v3.5` Events command list

### Skip for now

Out-of-scope for current FX30/FX6-first runtime:

- `v3.17` GPS Linking
- `v3.18` LUT / Cube import
- `v3.19` Firmware update
- `v3.20`–`v3.22` PTZF tips
- `v3.23` Remote control with transfer mode
- `v3.11` Compatibility — Events
- `v3.1.9` PTZ-only live view
- `v3.1.11` transfer mode
- `v3.1.12` video-only acquisition
- `v3.7` / `v2.7` object formats
- `v3.24` / `v2.16` legal

## Implementation guidance

For current project scope:

1. Use `v3` as the main protocol reference for all 2020+ cameras.
2. Treat `v2` as a compatibility supplement, not a co-equal source.
3. Prioritize command-list and compatibility chapters before deep detail pages.
4. Use detail chapters only after command-list constants and runtime polling/writing paths are in place.

## Materialized result

This research is now persisted in:

- `docs/research/extract/ptp-section-map-analysis.md`
- `knowledge/sony/staging/ptp-section-map.json`
