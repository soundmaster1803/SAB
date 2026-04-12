# Sony PTP Handshake / Session Analysis

Источник исследования:
- `Camera Control PTP 3 Reference.pdf`
- `Camera Control PTP 2 Reference.pdf`

Дата фиксации: 2026-04-12
Статус: research extract

## Scope

Этот файл фиксирует только handshake / session setup выводы, полезные для runtime Sony module.

## Confirmed flow

Для базового remote-control сценария подтверждён следующий порядок:

1. TCP connect to port `15740`
2. `OpenSession` (`0x1002`)
3. `SDIO_Connect` phase 1 (`0x9201`, `PhaseType=0x01`)
4. `SDIO_Connect` phase 2 (`0x9201`, `PhaseType=0x02`)
5. `SDIO_GetExtDeviceInfo` (`0x9202`)
6. `SDIO_Connect` phase 3 (`0x9201`, `PhaseType=0x03`)
7. First property fetch via `SDIO_GetAllExtDevicePropInfo` (`0x9209`)

## Confirmed notes

- `SDIO_GetExtDeviceInfo` must succeed before sending `SDIO_Connect` phase 3.
- If `SDIO_GetExtDeviceInfo` returns zero-length data, it must be retried.
- `SDIO_OpenSession` (`0x9210`) is not part of the basic FX30 remote-control sequence.
- `SDIO_OpenSession` appears to be related to special PTP3 function modes such as content transfer.

## Version notes

- v2 uses `InitiatorVersion=0x00C8`.
- v3 uses `InitiatorVersion=0x012C`.
- v3 adds a second flag parameter to `SDIO_GetExtDeviceInfo`.

## Ambiguities

- `SDIO_Connect` documents a returned `UINT64`, but its meaning is not explained.
- `SDIO_OpenSession` sequencing is not fully clear for non-basic modes.

## Runtime recommendation

- Keep current basic handshake path.
- Do not add `SDIO_OpenSession` to the default runtime path yet.
- Treat advanced function-mode flows as separate research.
