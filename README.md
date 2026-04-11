# SAB — Sony ATEM Bridge

A modular camera control platform connecting Sony cameras, Blackmagic ATEM switchers, and an operator web console.

## What it does

- Connects to Sony cameras via PTP/IP and polls live state (ISO, shutter, iris, focus, battery, recording)
- Connects to a Blackmagic ATEM switcher and receives camera-control commands
- Translates ATEM camera-control into Sony PTP commands with throttle and anti-loop protection
- Syncs Sony camera state back to ATEM
- Provides a live operator web console (HTTP + WebSocket)

## Architecture

SAB is organized into four permanent domains:

| Domain | Responsibility |
|--------|---------------|
| Sony | PTP/IP transport, camera state, actions, presets |
| ATEM | Switcher connectivity, tally, camera-control relay |
| Bridge | Intent normalization, conversion, policy, sync |
| UI | Operator console, view models, notifications |

See `docs/architecture/` for the full architecture documentation.

## Requirements

- Node.js 20+
- Sony camera with PTP/IP (PC Remote) enabled
- Blackmagic ATEM switcher on the same network

## Configuration

Copy or create `config.json` at the project root:

```json
{
  "atemIp": "192.168.x.x",
  "cameras": [
    { "id": "cam1", "name": "Camera 1", "ip": "192.168.x.x", "input": 1 }
  ]
}
```

## Running

```
node dist/bridge.cjs
```

Then open the operator console at `http://localhost:3000` (or configured port).

## Development

See `CLAUDE.md` for the full operating manual, domain boundaries, migration phases, and edit rules.

## Docs

- `docs/architecture/` — modular architecture design, target structure, edit rules
- `docs/research/` — Sony PTP/IP protocol reference, ATEM library reference, mapping tables
- `knowledge/` — structured capability evidence, model specs, known-good patterns

## License

MIT
