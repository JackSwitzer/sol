#!/usr/bin/env python3
"""Sunrise Alarm CLI - Science-backed wake-up light using Kasa smart bulbs.

Based on research:
- 20-30 min duration optimal (PMC, Hatch)
- Color progression 2200K→4000K mimics natural sunrise (Nature Scientific Reports)
- Blue-yellow color shifts enhance circadian response (UW 2024 Study)
"""

import argparse
import asyncio
import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from kasa import Discover, Device, Module
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.live import Live
from rich.align import Align
from rich import print as rprint

console = Console()

# ASCII Sun art
SUN_ART = """
[yellow]        \\   |   /
         \\  |  /
      ────[bold orange1]☀[/bold orange1]────
         /  |  \\
        /   |   \\[/yellow]
"""

SUN_RISE_FRAMES = [
    # Frame 1 - just peeking
    """
[dim]━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/dim]
[orange1]        ⠀⠀⣀⣀⣀⠀⠀[/orange1]
[yellow]░░░░░░░░░░░░░░░░░░░░░░░░░░░░[/yellow]""",
    # Frame 2 - rising
    """
[orange1]          \\  |  /[/orange1]
[yellow]        ── ☀ ──[/yellow]
[yellow]░░░░░░░░░░░░░░░░░░░░░░░░░░░░[/yellow]""",
    # Frame 3 - full sun
    """
[yellow]        \\   |   /
         \\  |  /
      ────[bold orange1]☀[/bold orange1]────
         /  |  \\
        /   |   \\[/yellow]"""
]

def show_sunrise_complete():
    """Display the epic sunrise completion message."""
    console.clear()

    sun_text = Text()
    sun_text.append("        \\   |   /\n", style="yellow")
    sun_text.append("         \\  |  /\n", style="yellow")
    sun_text.append("      ────", style="yellow")
    sun_text.append("☀", style="bold orange1")
    sun_text.append("────\n", style="yellow")
    sun_text.append("         /  |  \\\n", style="yellow")
    sun_text.append("        /   |   \\\n", style="yellow")

    console.print()
    console.print(Align.center(sun_text))
    console.print()

    # Main message
    title = Text("Welcome to the Game of Today, Jack!", style="bold yellow")
    subtitle = Text("And may the discipline be ever in your favour...", style="italic orange1")

    console.print(Align.center(title))
    console.print()
    console.print(Align.center(subtitle))
    console.print()

    # Time
    now = datetime.now()
    time_text = Text(f"☀ {now.strftime('%A, %B %d')} • {now.strftime('%H:%M')}", style="dim")
    console.print(Align.center(time_text))
    console.print()


def show_progress(phase: int, total_phases: int, brightness: int, temp: int):
    """Show live progress during sunrise."""
    bar_width = 30
    filled = int((brightness / 100) * bar_width)
    bar = "█" * filled + "░" * (bar_width - filled)

    # Color based on progress
    if brightness < 30:
        color = "red"
    elif brightness < 60:
        color = "orange1"
    else:
        color = "yellow"

    console.print(f"  [{color}]{bar}[/{color}] {brightness:3d}% • {temp}K", end="\r")

# Default configuration
DEFAULT_BULB_IP = "192.168.1.77"
DEFAULT_WAKE_TIME = "06:30"
CONFIG_FILE = Path(__file__).parent / "sunrise_config.json"

# Science-backed sunrise phases (based on natural dawn progression)
# Phase 1: Pre-dawn (deep red/orange glow) - melatonin still high, very gentle
# Phase 2: Golden hour (warming up) - cortisol starting to rise
# Phase 3: Full sunrise (bright, alerting) - full wake state
SUNRISE_PROFILES = {
    "standard": {
        "name": "Standard (30 min)",
        "duration_minutes": 30,
        "description": "Research-backed 30-min sunrise. Good for most people.",
        "phases": [
            {"pct": 0.40, "start_brightness": 1,  "end_brightness": 20,  "start_temp": 2500, "end_temp": 2700},
            {"pct": 0.35, "start_brightness": 20, "end_brightness": 60,  "start_temp": 2700, "end_temp": 3200},
            {"pct": 0.25, "start_brightness": 60, "end_brightness": 100, "start_temp": 3200, "end_temp": 4000},
        ]
    },
    "quick": {
        "name": "Quick (20 min)",
        "duration_minutes": 20,
        "description": "Faster sunrise for light sleepers or when short on time.",
        "phases": [
            {"pct": 0.30, "start_brightness": 1,  "end_brightness": 25,  "start_temp": 2500, "end_temp": 2800},
            {"pct": 0.35, "start_brightness": 25, "end_brightness": 65,  "start_temp": 2800, "end_temp": 3400},
            {"pct": 0.35, "start_brightness": 65, "end_brightness": 100, "start_temp": 3400, "end_temp": 4000},
        ]
    },
    "gentle": {
        "name": "Gentle (45 min)",
        "duration_minutes": 45,
        "description": "Extended sunrise for deep sleepers. More gradual transition.",
        "phases": [
            {"pct": 0.45, "start_brightness": 1,  "end_brightness": 15,  "start_temp": 2500, "end_temp": 2600},
            {"pct": 0.30, "start_brightness": 15, "end_brightness": 50,  "start_temp": 2600, "end_temp": 3000},
            {"pct": 0.25, "start_brightness": 50, "end_brightness": 100, "start_temp": 3000, "end_temp": 4000},
        ]
    },
    # Ablation test profiles for experimentation
    "ablation_day1": {
        "name": "Ablation Day 1: Quick + Cool End",
        "duration_minutes": 20,
        "description": "Test: Faster with cooler end temp (more alerting)",
        "phases": [
            {"pct": 0.30, "start_brightness": 1,  "end_brightness": 30,  "start_temp": 2500, "end_temp": 3000},
            {"pct": 0.35, "start_brightness": 30, "end_brightness": 70,  "start_temp": 3000, "end_temp": 4000},
            {"pct": 0.35, "start_brightness": 70, "end_brightness": 100, "start_temp": 4000, "end_temp": 5000},
        ]
    },
    "ablation_day2": {
        "name": "Ablation Day 2: Standard + Warm",
        "duration_minutes": 30,
        "description": "Test: Standard duration, warmer end temp (gentler)",
        "phases": [
            {"pct": 0.40, "start_brightness": 1,  "end_brightness": 20,  "start_temp": 2500, "end_temp": 2700},
            {"pct": 0.35, "start_brightness": 20, "end_brightness": 60,  "start_temp": 2700, "end_temp": 3000},
            {"pct": 0.25, "start_brightness": 60, "end_brightness": 100, "start_temp": 3000, "end_temp": 3500},
        ]
    },
    "ablation_day3": {
        "name": "Ablation Day 3: Long + Oscillating",
        "duration_minutes": 40,
        "description": "Test: Longer with gentle brightness oscillation in final phase",
        "phases": [
            {"pct": 0.40, "start_brightness": 1,  "end_brightness": 20,  "start_temp": 2500, "end_temp": 2700},
            {"pct": 0.35, "start_brightness": 20, "end_brightness": 55,  "start_temp": 2700, "end_temp": 3200},
            {"pct": 0.25, "start_brightness": 55, "end_brightness": 100, "start_temp": 3200, "end_temp": 4000, "oscillate": True},
        ]
    },
}


async def discover_bulbs():
    """Find Kasa devices on the network."""
    devices = await Discover.discover()
    return devices


async def run_sunrise(ip: str, profile: str = "standard", verbose: bool = True):
    """Run the science-backed sunrise simulation."""
    if profile not in SUNRISE_PROFILES:
        print(f"Unknown profile '{profile}'. Available: {', '.join(SUNRISE_PROFILES.keys())}")
        return

    config = SUNRISE_PROFILES[profile]
    duration_minutes = config["duration_minutes"]
    phases = config["phases"]

    if verbose:
        print(f"Starting sunrise: {config['name']}")
        print(f"  {config['description']}")
        print(f"  Duration: {duration_minutes} minutes")
        print()

    bulb = await Device.connect(host=ip)
    await bulb.update()
    light = bulb.modules[Module.Light]

    # Start from off
    await bulb.turn_off()
    await asyncio.sleep(0.5)

    total_seconds = duration_minutes * 60
    elapsed = 0

    for phase_idx, phase in enumerate(phases):
        phase_duration = total_seconds * phase["pct"]
        steps = max(int(phase_duration / 2), 10)  # Update every ~2 seconds, min 10 steps
        delay = phase_duration / steps

        start_b, end_b = phase["start_brightness"], phase["end_brightness"]
        start_t, end_t = phase["start_temp"], phase["end_temp"]
        oscillate = phase.get("oscillate", False)

        if verbose:
            print(f"  Phase {phase_idx + 1}: {start_b}%→{end_b}% brightness, {start_t}K→{end_t}K")

        # Turn on at start of first phase
        if phase_idx == 0:
            await light.set_brightness(start_b)
            await light.set_color_temp(start_t)
            await bulb.turn_on()

        for step in range(steps):
            progress = step / steps
            brightness = int(start_b + (end_b - start_b) * progress)
            temp = int(start_t + (end_t - start_t) * progress)

            # Add gentle oscillation if enabled (simulates natural light variation)
            if oscillate:
                osc = math.sin(step * 0.5) * 5  # ±5% brightness wave
                brightness = max(1, min(100, int(brightness + osc)))

            await light.set_brightness(brightness)
            await light.set_color_temp(temp)

            # Show progress
            if verbose:
                show_progress(phase_idx + 1, len(phases), brightness, temp)

            await asyncio.sleep(delay)

        elapsed += phase_duration

    if verbose:
        print()  # Clear the progress line
        show_sunrise_complete()


async def run_demo(ip: str):
    """Fun 30-second demo: quick ramp → weird pulsing → optimal wake light."""
    print("Starting demo mode (35 seconds)")
    print()

    bulb = await Device.connect(host=ip)
    await bulb.update()
    light = bulb.modules[Module.Light]

    # Start from off
    await bulb.turn_off()
    await asyncio.sleep(0.5)

    # === Phase 1: Quick dark-to-light ramp (15 seconds) ===
    print("  Phase 1: Dark to light ramp (15s)")
    await light.set_brightness(1)
    await light.set_color_temp(2500)
    await bulb.turn_on()

    for i in range(15):
        brightness = int(1 + (99 * i / 14))
        temp = int(2500 + (1500 * i / 14))
        await light.set_brightness(brightness)
        await light.set_color_temp(temp)
        await asyncio.sleep(1)

    # === Phase 2: Weird pulsing (20 seconds) ===
    print("  Phase 2: Weird pulsing (20s)")
    pulse_patterns = [
        (30, 2700), (90, 4500), (20, 2500), (100, 6000),
        (40, 3000), (80, 5000), (15, 2500), (95, 4000),
        (50, 3500), (70, 5500), (25, 2700), (100, 4500),
        (35, 3000), (85, 5000), (45, 2800), (75, 4200),
        (55, 3800), (65, 5200), (30, 2600), (100, 4000),
    ]
    for brightness, temp in pulse_patterns:
        await light.set_brightness(brightness)
        await light.set_color_temp(temp)
        await asyncio.sleep(1)

    # === Phase 3: Settle to optimal wake light ===
    print("  Phase 3: Settling to optimal wake light")
    # Smooth transition to ideal wake state
    for i in range(5):
        brightness = int(100 - (20 * (4 - i) / 4))  # 80 → 100
        temp = int(4000 + (0 * i / 4))  # Stay at 4000K
        await light.set_brightness(brightness)
        await light.set_color_temp(temp)
        await asyncio.sleep(0.5)

    await light.set_brightness(100)
    await light.set_color_temp(4000)
    await asyncio.sleep(2)
    await bulb.turn_off()

    print()
    print("Demo complete! Light off.")


async def schedule_sunrise(wake_time: str, ip: str, profile: str):
    """Schedule sunrise to complete at the specified wake time."""
    try:
        wake_hour, wake_minute = map(int, wake_time.split(":"))
    except ValueError:
        print(f"Error: Invalid time format '{wake_time}'. Use HH:MM (e.g., 06:30)")
        return

    config = SUNRISE_PROFILES.get(profile, SUNRISE_PROFILES["standard"])
    duration_minutes = config["duration_minutes"]

    now = datetime.now()
    wake_dt = now.replace(hour=wake_hour, minute=wake_minute, second=0, microsecond=0)

    # If start time already passed today, schedule for tomorrow
    if wake_dt <= now:
        wake_dt += timedelta(days=1)

    # Time specified is when sunrise STARTS
    start_dt = wake_dt
    end_dt = wake_dt + timedelta(minutes=duration_minutes)
    wait_seconds = (start_dt - now).total_seconds()

    print(f"Sunrise Alarm Scheduled")
    print(f"  Profile:        {config['name']}")
    print(f"  Starts at:      {start_dt.strftime('%Y-%m-%d %H:%M')}")
    print(f"  Completes at:   {end_dt.strftime('%H:%M')} ({duration_minutes} min later)")
    print(f"  Waiting:        {wait_seconds / 60:.1f} minutes ({wait_seconds / 3600:.1f} hours)")
    print()
    print("Press Ctrl+C to cancel")

    if wait_seconds > 0:
        await asyncio.sleep(wait_seconds)

    await run_sunrise(ip, profile)


async def cmd_now(args):
    """Handle 'now' command - immediate sunrise."""
    ip = args.ip or DEFAULT_BULB_IP
    await run_sunrise(ip, args.profile)


async def cmd_at(args):
    """Handle 'at' command - scheduled sunrise."""
    ip = args.ip or DEFAULT_BULB_IP
    await schedule_sunrise(args.time, ip, args.profile)


async def cmd_demo(args):
    """Handle 'demo' command."""
    ip = args.ip or DEFAULT_BULB_IP
    await run_demo(ip)


async def cmd_discover(args):
    """Handle 'discover' command."""
    devices = await Discover.discover()
    if not devices:
        print("No Kasa devices found on the network.")
        return

    print("Found Kasa devices:\n")
    for ip, dev in devices.items():
        await dev.update()
        status = "ON" if dev.is_on else "OFF"
        print(f"  {dev.alias}")
        print(f"    IP: {ip}")
        print(f"    Type: {dev.device_type.name}")
        print(f"    Status: {status}")
        print()


async def cmd_off(args):
    """Turn off the bulb."""
    ip = args.ip or DEFAULT_BULB_IP
    bulb = await Device.connect(host=ip)
    await bulb.turn_off()
    print(f"Turned off bulb at {ip}")


async def cmd_profiles(args):
    """List available sunrise profiles."""
    print("Available Sunrise Profiles:\n")
    for key, config in SUNRISE_PROFILES.items():
        print(f"  {key}")
        print(f"    {config['name']}")
        print(f"    {config['description']}")
        print(f"    Duration: {config['duration_minutes']} min")
        print()


async def cmd_ablation(args):
    """Show ablation test schedule for next 3 days."""
    print("3-Day Ablation Test Schedule")
    print("=" * 40)
    print()

    now = datetime.now()
    for i, day_key in enumerate(["ablation_day1", "ablation_day2", "ablation_day3"]):
        test_date = now + timedelta(days=i)
        config = SUNRISE_PROFILES[day_key]
        print(f"Day {i+1} ({test_date.strftime('%A, %b %d')}):")
        print(f"  Profile: {config['name']}")
        print(f"  {config['description']}")
        print(f"  Duration: {config['duration_minutes']} min")
        print(f"  Command: uv run python main.py at {args.time} -p {day_key}")
        print()

    print("Tip: Rate your wake quality each day (1-10) to compare!")


def main():
    parser = argparse.ArgumentParser(
        description="Sunrise Alarm - Science-backed wake-up light using Kasa smart bulbs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s now                      # Start standard 30-min sunrise now
  %(prog)s now -p quick             # Start quick 20-min sunrise
  %(prog)s at 06:30                 # Schedule wake at 6:30 AM
  %(prog)s at 07:00 -p gentle       # Gentle 45-min sunrise, wake at 7:00
  %(prog)s demo                     # Fun 35-second light show
  %(prog)s profiles                 # List all available profiles
  %(prog)s ablation 06:30           # Show 3-day test schedule for 6:30 wake

Profiles: standard (30min), quick (20min), gentle (45min), ablation_day1/2/3
"""
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Common arguments
    def add_common_args(p, include_profile=True):
        p.add_argument("--ip", help=f"Bulb IP address (default: {DEFAULT_BULB_IP})")
        if include_profile:
            p.add_argument("-p", "--profile", default="standard",
                           help="Sunrise profile (default: standard)")

    # 'now' - immediate sunrise
    now_parser = subparsers.add_parser("now", help="Start sunrise immediately")
    add_common_args(now_parser)
    now_parser.set_defaults(func=cmd_now)

    # 'at' - scheduled sunrise
    at_parser = subparsers.add_parser("at", help="Schedule sunrise for a specific time")
    at_parser.add_argument("time", nargs="?", default=DEFAULT_WAKE_TIME,
                           help=f"Wake time in HH:MM format (default: {DEFAULT_WAKE_TIME})")
    add_common_args(at_parser)
    at_parser.set_defaults(func=cmd_at)

    # 'demo' - fun demo mode
    demo_parser = subparsers.add_parser("demo", help="Fun 35-second light show demo")
    add_common_args(demo_parser, include_profile=False)
    demo_parser.set_defaults(func=cmd_demo)

    # 'discover' - find devices
    discover_parser = subparsers.add_parser("discover", help="Find Kasa devices on network")
    discover_parser.set_defaults(func=cmd_discover)

    # 'off' - turn off
    off_parser = subparsers.add_parser("off", help="Turn off the bulb")
    off_parser.add_argument("--ip", help=f"Bulb IP address (default: {DEFAULT_BULB_IP})")
    off_parser.set_defaults(func=cmd_off)

    # 'profiles' - list profiles
    profiles_parser = subparsers.add_parser("profiles", help="List available sunrise profiles")
    profiles_parser.set_defaults(func=cmd_profiles)

    # 'ablation' - show test schedule
    ablation_parser = subparsers.add_parser("ablation", help="Show 3-day ablation test schedule")
    ablation_parser.add_argument("time", nargs="?", default=DEFAULT_WAKE_TIME,
                                  help=f"Wake time for tests (default: {DEFAULT_WAKE_TIME})")
    ablation_parser.set_defaults(func=cmd_ablation)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
