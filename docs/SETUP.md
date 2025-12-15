# Setup Guide

## Requirements

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) package manager
- Kasa smart bulb (KL125 or similar) on 2.4GHz WiFi
- Computer on same network

## Installation

```bash
git clone git@github.com:JackSwitzer/sol.git
cd sol
uv sync
```

## Find Your Bulb

```bash
uv run python main.py discover
```

If your bulb IP differs from `192.168.1.77`, update `DEFAULT_BULB_IP` in `main.py:19`.

## Commands Reference

| Command | Description |
|---------|-------------|
| `discover` | Find Kasa bulbs on network |
| `now` | Start sunrise immediately |
| `now -p quick` | Start with specific profile |
| `at HH:MM` | Schedule sunrise for wake time |
| `at 07:00 -p gentle` | Schedule with profile |
| `demo` | 35-second light show |
| `profiles` | List available profiles |
| `ablation HH:MM` | Show 3-day test schedule |
| `off` | Turn off the bulb |

## Profiles

| Profile | Duration | Use Case |
|---------|----------|----------|
| `standard` | 30 min | Research-backed default |
| `quick` | 20 min | Light sleepers |
| `gentle` | 45 min | Deep sleepers |
| `ablation_day1` | 20 min | Test: Quick + cool end temp |
| `ablation_day2` | 30 min | Test: Standard + warm end |
| `ablation_day3` | 40 min | Test: Long + oscillating |

## The Science

Based on peer-reviewed research:

- **Duration**: 20-30 minutes optimal ([PMC Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC270037/))
- **Color temp**: 2500K→4000K mimics natural dawn ([Nature](https://www.nature.com/articles/s41598-022-10161-8))
- **Circadian impact**: Blue-yellow shifts enhance response ([UW 2024](https://newsroom.uw.edu/news-releases/scientists-mix-skys-splendid-hues-to-reset-circadian-clocks))

### 3-Phase Sunrise

1. **Pre-dawn (40%)** — 1→20% brightness, 2500K→2700K
2. **Golden hour (35%)** — 20→60% brightness, 2700K→3200K
3. **Full wake (25%)** — 60→100% brightness, 3200K→4000K

## MCP Server (Claude Code)

Control bulbs directly from Claude Code.

Add to `.mcp.json`:
```json
{
  "mcpServers": {
    "kasa": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/sol/kasa-mcp", "python", "server.py"]
    }
  }
}
```

Available tools:
- `kasa_discover` — Find devices
- `kasa_on` / `kasa_off` — Power control
- `kasa_brightness` — Set brightness (1-100)
- `kasa_color_temp` — Set color temp (2500-6500K)
- `kasa_color` — Set HSV color
- `kasa_status` — Get current state
- `kasa_sunrise` — Run sunrise simulation

## Running on Raspberry Pi

For always-on alarm:

```bash
# Clone and install
git clone git@github.com:JackSwitzer/sol.git
cd sol
uv sync

# Run with nohup
nohup uv run python main.py at 06:30 &

# Or create a systemd service for persistence
```

## Project Structure

```
sol/
├── main.py           # CLI for sunrise alarm
├── demo.py           # Standalone demo script
├── kasa-mcp/         # MCP server for Claude Code
│   ├── server.py
│   └── pyproject.toml
├── docs/
│   └── SETUP.md      # This file
├── pyproject.toml
└── README.md
```
