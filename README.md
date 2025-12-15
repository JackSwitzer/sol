# Sol ☀️

*Let there be Light*

Wake up gently with science-backed sunrise simulation using Kasa smart bulbs.

![Sol Sunrise Animation](assets/sunrise.gif)

## Quick Start

```bash
uv sync
uv run python main.py discover
uv run python main.py at 06:30
```

## Commands

```
sol now              # Start sunrise now
sol at 06:30         # Schedule for 6:30 AM
sol demo             # 35-second light show
sol off              # Turn off
```

## How It Works

3-phase sunrise over 30 minutes:
1. **Pre-dawn** — Dim warm glow (2500K)
2. **Golden hour** — Gradual warmup
3. **Full wake** — Bright neutral light (4000K)

Light suppresses melatonin and raises cortisol naturally. No jarring alarms.

## Setup

See [docs/SETUP.md](docs/SETUP.md) for detailed setup, profiles, and MCP server config.

## Roadmap

- [ ] Logo improvements (glow/pulse effect, animated rays)
- [ ] Weather integration (clouds, rain effects)
- [ ] Multiple bulb support
- [ ] Web UI for scheduling
- [ ] Raspberry Pi systemd service

## License

MIT
