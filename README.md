# Sol ☀️

A DIY sunrise alarm clock using Kasa smart bulbs. Wake up gently with science-backed dawn simulation.

## Features

- **Science-backed sunrise profiles** - 3-phase light progression mimicking natural dawn (2500K→4000K)
- **Multiple wake profiles** - Quick (20min), Standard (30min), Gentle (45min)
- **Scheduled alarms** - Set wake time, light completes sunrise at that moment
- **Demo mode** - 35-second light show for testing
- **Ablation testing** - 3-day experiment profiles to find your optimal settings
- **MCP Server** - Control bulbs directly from Claude Code

## Quick Start

```bash
# Install dependencies
uv sync

# Discover your bulb
uv run python main.py discover

# Run a quick test (1-minute sunrise)
uv run python main.py now -p quick

# Schedule 6:30 AM wake-up
uv run python main.py at 06:30

# Fun demo
uv run python main.py demo
```

## Commands

| Command | Description |
|---------|-------------|
| `discover` | Find Kasa bulbs on network |
| `now` | Start sunrise immediately |
| `at HH:MM` | Schedule sunrise for specific wake time |
| `demo` | 35-second light show |
| `profiles` | List available sunrise profiles |
| `ablation HH:MM` | Show 3-day test schedule |
| `off` | Turn off the bulb |

## Profiles

- **standard** - 30 min, research-backed default
- **quick** - 20 min, for light sleepers
- **gentle** - 45 min, extended for deep sleepers
- **ablation_day1/2/3** - Experimental profiles for A/B testing

## The Science

Based on sleep research:
- **Duration**: 20-30 minutes optimal for most people
- **Color progression**: Start warm (2500K) → end neutral (4000K)
- **Brightness curve**: Slow initial ramp, faster final phase
- **Circadian impact**: Light suppresses melatonin, raises cortisol naturally

Sources:
- [PMC Study on Dawn Simulation](https://pmc.ncbi.nlm.nih.gov/articles/PMC270037/)
- [Nature: Dynamic Lighting Effects](https://www.nature.com/articles/s41598-022-10161-8)
- [UW 2024: Blue-Yellow Light Research](https://newsroom.uw.edu/news-releases/scientists-mix-skys-splendid-hues-to-reset-circadian-clocks)

## Hardware

- **Kasa KL125** color smart bulb (or similar)
- Any lamp with standard socket
- Computer/Raspberry Pi on same WiFi network

## MCP Server (for Claude Code)

The `kasa-mcp/` directory contains an MCP server for controlling bulbs directly from Claude Code.

Add to your `.mcp.json`:
```json
{
  "mcpServers": {
    "kasa": {
      "command": "uv",
      "args": ["run", "--directory", "path/to/sol/kasa-mcp", "python", "server.py"]
    }
  }
}
```

## Project Structure

```
sol/
├── main.py           # CLI for sunrise alarm
├── kasa-mcp/         # MCP server for Claude Code integration
│   ├── server.py     # MCP tool definitions
│   └── pyproject.toml
├── pyproject.toml    # Project dependencies
└── README.md
```

## License

MIT
