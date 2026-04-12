# Sony PTP Operations Analysis: 0x9202 and 0x9209

Источник исследования:
- `Camera Control PTP 3 Reference.pdf`
- `Camera Control PTP 2 Reference.pdf`

Дата фиксации: 2026-04-12
Статус: research extract

## Scope

Этот файл фиксирует выводы только по:
- `SDIO_GetExtDeviceInfo` (`0x9202`)
- `SDIO_GetAllExtDevicePropInfo` (`0x9209`)

## 0x9202 SDIO_GetExtDeviceInfo

### Confirmed

- `opcode = 0x9202`
- v2 parameter 1: `InitiatorVersion=0x00C8`
- v3 parameter 1: `InitiatorVersion=0x012C`
- v3 parameter 2 exists and is a device-property option flag
- data direction: camera to initiator
- payload: `SDIExtDeviceInfo Dataset`
- called after `SDIO_Connect` phase 2 and before phase 3
- retry if returned data size is zero

### Confirmed dataset contents

`SDIExtDeviceInfo Dataset` contains:

1. `SDIExtensionVersion` (`UINT16`)
2. `SDIDevicePropCode Array` (`UINT16[]`)
3. `SDIControlCode Array` (`UINT16[]`)

### Important runtime meaning

- `SDIDevicePropCode Array` should become the canonical supported-property list for a connected camera.
- `SDIControlCode Array` should become the canonical supported-control list for a connected camera.
- This operation does **not** return current property values.

### Open questions

- Binary framing / array length encoding for the two arrays is not explicitly documented.
- Exact handling of extended code ranges should be kept as a research note until verified in code or capture.

## 0x9209 SDIO_GetAllExtDevicePropInfo

### Confirmed

- `opcode = 0x9209`
- v2: no parameters
- v3 parameter 1: difference-data flag
- v3 parameter 2: device-property option flag
- data direction: camera to initiator
- payload: dataset array of property records
- returns current property state records

### Confirmed per-record fields

Each property record contains at least:

1. `Device Property Code` (`UINT16`)
2. `DataType` (`UINT16`)
3. `GetSet` (`UINT8`)
4. `IsEnabled` (`UINT8`)
5. field 5: documented ambiguously as factory default vs reserved
6. `Current Value`
7. `Form Flag`

### Confirmed semantics

- `GetSet`: `0x00=read-only`, `0x01=read-write`
- `IsEnabled`: `0x00=disabled`, `0x01=enabled`, `0x02=display-only`
- `Current Value` is only meaningful when the property is enabled
- enumeration metadata is present when `Form Flag=0x02`
- range metadata exists for range-like properties, but the generic op spec is less explicit than the property examples

### Important runtime meaning

- `GetSet` should gate write attempts.
- `IsEnabled` should gate dynamic action availability.
- `Form Flag` plus enum/range payload should drive value validation and supported-list extraction.
- First poll should likely be a full fetch; difference-only polling can be considered later.

## Reliability notes

### Confirmed

- Support lists from `0x9202` are safe inputs for static-per-connection capability gating.
- Per-record fields from `0x9209` are safe inputs for dynamic-per-poll gating.

### Not yet safe to hardcode without extra verification

- exact array framing for `0x9202`
- exact first-call rule for `0x9209` difference mode
- exact formal definition of `Form Flag=0x00`
- using field 5 as a real factory default
