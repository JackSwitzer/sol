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
import sys
import tty
import termios
import shutil
import subprocess
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


# ═══════════════════════════════════════════════════════════════════════════════
# INTERACTIVE TUI - Sunrise Configuration Interface
# ═══════════════════════════════════════════════════════════════════════════════

SUN_ASCII = [
    "            ·  ✦  ·            ",
    "        ✦       │       ✦      ",
    "     ·    \\     │     /    ·   ",
    "            \\   │   /          ",
    "   ─ ─ ─ ─ ─ ( ☀ ) ─ ─ ─ ─ ─  ",
    "            /   │   \\          ",
    "     ·    /     │     \\    ·   ",
    "        ✦       │       ✦      ",
    "            ·  ✦  ·            ",
]

MOON_ASCII = [
    "                               ",
    "           ·411*1·             ",
    "        ✦      ░░░░  ✦        ",
    "            ░░░░░░░            ",
    "           ░░░░░░░░░           ",
    "            ░░░░░░░            ",
    "        ✦      ░░░░  ✦        ",
    "           ·  ✦  ·             ",
    "                               ",
]


def get_key():
    """Read a single keypress."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
        if ch == '\x1b':  # Escape sequence
            ch2 = sys.stdin.read(1)
            if ch2 == '[':
                ch3 = sys.stdin.read(1)
                if ch3 == 'A': return 'UP'
                if ch3 == 'B': return 'DOWN'
                if ch3 == 'C': return 'RIGHT'
                if ch3 == 'D': return 'LEFT'
        if ch == '\r' or ch == '\n': return 'ENTER'
        if ch == 'q' or ch == '\x03': return 'QUIT'  # q or Ctrl+C
        if ch == '\t': return 'TAB'
        return ch
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


def render_setup_screen(wake_hour: int, wake_min: int, duration: int, max_temp: int,
                        selected_field: int, lamp_status: str):
    """Render the interactive setup screen."""
    term = shutil.get_terminal_size()
    width = term.columns
    height = term.lines - 1

    # Colors - sunrise gradient palette
    night_bg = "grey7"
    accent = "orange1"
    highlight = "bright_yellow"
    dim = "grey50"

    console.clear()

    # Calculate vertical centering
    content_height = 24
    top_pad = max(0, (height - content_height) // 2)

    # Top padding
    for _ in range(top_pad):
        console.print()

    # Header with sun
    console.print()
    for i, line in enumerate(SUN_ASCII):
        color = ["grey30", "grey50", "orange1", "orange1", "bright_yellow",
                 "orange1", "orange1", "grey50", "grey30"][i]
        centered = line.center(width)
        console.print(centered, style=color)

    console.print()
    title = "S O L"
    subtitle = "sunrise alarm"
    console.print(title.center(width), style="bold bright_yellow")
    console.print(subtitle.center(width), style="dim orange1")
    console.print()

    # Lamp status
    status_color = "green" if "Connected" in lamp_status else "red"
    console.print(f"◉ {lamp_status}".center(width), style=status_color)
    console.print()

    # Settings panel
    box_width = 44
    pad = (width - box_width) // 2
    left_pad = " " * pad

    # Box top
    console.print(f"{left_pad}╭{'─' * (box_width - 2)}╮", style=dim)

    # Wake time field
    field_0_style = f"bold {highlight}" if selected_field == 0 else dim
    wake_str = f"{wake_hour:02d}:{wake_min:02d}"
    arrow_l = "◀ " if selected_field == 0 else "  "
    arrow_r = " ▶" if selected_field == 0 else "  "
    line = f"│  WAKE TIME        {arrow_l}[{field_0_style}]{wake_str}[/{field_0_style}]{arrow_r}       │"
    console.print(f"{left_pad}{line}", style=dim)

    # Spacer
    console.print(f"{left_pad}│{' ' * (box_width - 2)}│", style=dim)

    # Duration field
    field_1_style = f"bold {highlight}" if selected_field == 1 else dim
    duration_str = f"{duration} min"
    arrow_l = "◀ " if selected_field == 1 else "  "
    arrow_r = " ▶" if selected_field == 1 else "  "
    line = f"│  DURATION         {arrow_l}[{field_1_style}]{duration_str:>5}[/{field_1_style}]{arrow_r}       │"
    console.print(f"{left_pad}{line}", style=dim)

    # Spacer
    console.print(f"{left_pad}│{' ' * (box_width - 2)}│", style=dim)

    # Max temp field
    field_2_style = f"bold {highlight}" if selected_field == 2 else dim
    temp_str = f"{max_temp}K"
    arrow_l = "◀ " if selected_field == 2 else "  "
    arrow_r = " ▶" if selected_field == 2 else "  "
    line = f"│  END TEMP         {arrow_l}[{field_2_style}]{temp_str:>5}[/{field_2_style}]{arrow_r}       │"
    console.print(f"{left_pad}{line}", style=dim)

    # Box bottom
    console.print(f"{left_pad}╰{'─' * (box_width - 2)}╯", style=dim)

    console.print()

    # Calculate and show sunrise start time
    duration_td = timedelta(minutes=duration)
    wake_time = datetime.now().replace(hour=wake_hour, minute=wake_min, second=0)
    if wake_time <= datetime.now():
        wake_time += timedelta(days=1)
    start_time = wake_time - duration_td

    info = f"Sunrise: {start_time.strftime('%H:%M')} → Wake: {wake_time.strftime('%H:%M')}"
    console.print(info.center(width), style="orange1")

    console.print()
    console.print()

    # Action buttons
    btn_start = " [ ENTER ] Start Alarm "
    btn_quit = " [ Q ] Quit "
    buttons = f"{btn_start}     {btn_quit}"
    console.print(buttons.center(width), style=dim)

    # Instructions
    console.print()
    console.print("↑↓ select  ←→ adjust".center(width), style="grey35")


async def test_lamp_connection(ip: str) -> str:
    """Test lamp connection and return status string."""
    try:
        bulb = await Device.connect(host=ip)
        await bulb.update()
        return f"Connected: {bulb.alias}"
    except Exception as e:
        return f"Not connected: {str(e)[:30]}"


async def turn_off_lamp(ip: str):
    """Turn off the lamp."""
    try:
        bulb = await Device.connect(host=ip)
        await bulb.turn_off()
    except:
        pass


def launch_alarm_in_terminal(wake_time: str, duration: int, max_temp: int, ip: str):
    """Launch the alarm in a new fullscreen terminal window."""
    # Determine profile based on duration
    if duration <= 20:
        profile = "quick"
    elif duration <= 30:
        profile = "standard"
    else:
        profile = "gentle"

    # Create launcher script
    launcher = "/tmp/sol-launcher.sh"
    script_dir = Path(__file__).parent

    with open(launcher, 'w') as f:
        f.write(f'''#!/bin/bash
cd "{script_dir}"
echo $$ > /tmp/sol-sunrise.pid
exec caffeinate -is uv run python main.py up {wake_time} -p {profile} --no-auto-off
''')

    subprocess.run(['chmod', '+x', launcher])

    # Launch in new Terminal window with fullscreen
    applescript = f'''
    tell application "Terminal"
        activate
        do script "{launcher}"
        delay 0.8
        tell application "System Events" to tell process "Terminal"
            keystroke "f" using {{command down, control down}}
        end tell
    end tell
    '''
    subprocess.run(['osascript', '-e', applescript])


async def interactive_setup():
    """Run the interactive setup TUI."""
    # Default values
    wake_hour = 7
    wake_min = 0
    duration = 30  # minutes
    max_temp = 5000  # Kelvin
    selected_field = 0  # 0=time, 1=duration, 2=temp

    durations = [20, 30, 45]
    temps = [4000, 4500, 5000, 5500, 6000, 6500]

    ip = DEFAULT_BULB_IP

    # Test lamp connection
    lamp_status = await test_lamp_connection(ip)

    while True:
        render_setup_screen(wake_hour, wake_min, duration, max_temp, selected_field, lamp_status)

        key = get_key()

        if key == 'QUIT':
            console.clear()
            console.print("\n  Cancelled.\n", style="dim")
            return

        elif key == 'ENTER':
            # Turn off lamp and launch alarm
            console.clear()
            console.print("\n  Preparing alarm...\n", style="orange1")

            await turn_off_lamp(ip)

            wake_time = f"{wake_hour:02d}:{wake_min:02d}"
            launch_alarm_in_terminal(wake_time, duration, max_temp, ip)

            console.print(f"  ☀ Alarm set for {wake_time}", style="bright_yellow")
            console.print(f"  Running in new terminal window.\n", style="dim")
            return

        elif key == 'UP' or key == 'TAB':
            selected_field = (selected_field - 1) % 3

        elif key == 'DOWN':
            selected_field = (selected_field + 1) % 3

        elif key == 'LEFT':
            if selected_field == 0:  # Time
                wake_min -= 5
                if wake_min < 0:
                    wake_min = 55
                    wake_hour = (wake_hour - 1) % 24
            elif selected_field == 1:  # Duration
                idx = durations.index(duration) if duration in durations else 1
                duration = durations[(idx - 1) % len(durations)]
            elif selected_field == 2:  # Temp
                idx = temps.index(max_temp) if max_temp in temps else 2
                max_temp = temps[(idx - 1) % len(temps)]

        elif key == 'RIGHT':
            if selected_field == 0:  # Time
                wake_min += 5
                if wake_min >= 60:
                    wake_min = 0
                    wake_hour = (wake_hour + 1) % 24
            elif selected_field == 1:  # Duration
                idx = durations.index(duration) if duration in durations else 1
                duration = durations[(idx + 1) % len(durations)]
            elif selected_field == 2:  # Temp
                idx = temps.index(max_temp) if max_temp in temps else 2
                max_temp = temps[(idx + 1) % len(temps)]

def get_gradient_color(pos: int, total: int, stage: int) -> str:
    """Get color name based on position and stage."""
    colors_by_stage = [
        ["red", "orange1", "yellow"],
        ["orange1", "yellow", "bright_yellow"],
        ["yellow", "bright_yellow", "white"],
        ["bright_yellow", "white", "bold white"],
    ]
    colors = colors_by_stage[min(stage, 3)]
    ratio = pos / max(total, 1)
    if ratio < 0.33:
        return colors[0]
    elif ratio < 0.66:
        return colors[1]
    return colors[2]


def render_sunrise_frame(stage: int, width: int, height: int):
    """Render a single frame of the sunrise animation - FULL SCREEN."""

    # Sun art for each stage (bigger sun for bigger screens)
    suns = [
        ["      ⣀⣤⣤⣀      "],
        ["     \\  │  /     ", "      \\ │ /      ", "    ───(●)───    ", "      / │ \\      ", "     /  │  \\     "],
        ["       \\│/       ", "      \\ │ /      ", "     \\  │  /     ", "   ────(☀)────   ", "     /  │  \\     ", "      / │ \\      ", "       /│\\       "],
        ["        │        ", "    \\   │   /    ", "     \\  │  /     ", "      \\ │ /      ", "   ─────☀─────   ", "      / │ \\      ", "     /  │  \\     ", "    /   │   \\    ", "        │        "],
    ]
    sun_art = suns[min(stage, 3)]

    # Colors by stage
    border_colors = ["red", "orange1", "yellow", "bright_yellow"]
    sky_colors = ["grey7", "grey11", "grey19", "grey27"]
    ground_colors = ["grey3", "grey7", "grey11", "grey15"]
    sun_colors = ["red", "orange1", "yellow", "bright_yellow"]

    border_color = border_colors[min(stage, 3)]
    sky_bg = sky_colors[min(stage, 3)]
    ground_bg = ground_colors[min(stage, 3)]
    sun_color = sun_colors[min(stage, 3)]

    # Position sun - rises from bottom
    horizon_row = height - 6
    sun_height = len(sun_art)
    # Sun rises: stage 0 = peeking, stage 3 = high
    sun_offset = [sun_height - 1, sun_height // 2, 2, 0][min(stage, 3)]
    sun_start_row = horizon_row - sun_height + sun_offset

    # Top border
    console.print("█" * width, style=border_color, end="")

    for row in range(1, height - 1):
        if row >= horizon_row:
            # Ground area
            char = "░" if row == horizon_row else "▓"
            console.print("█", style=border_color, end="")
            console.print(char * (width - 2), style=f"{border_color} on {ground_bg}", end="")
            console.print("█", style=border_color, end="")
        elif sun_start_row <= row < sun_start_row + sun_height:
            # Sun row
            sun_idx = row - sun_start_row
            if 0 <= sun_idx < len(sun_art):
                sun_line = sun_art[sun_idx]
                pad = (width - 2 - len(sun_line)) // 2
                console.print("█", style=border_color, end="")
                console.print(" " * pad, style=f"on {sky_bg}", end="")
                console.print(sun_line, style=f"{sun_color} on {sky_bg}", end="")
                console.print(" " * (width - 2 - pad - len(sun_line)), style=f"on {sky_bg}", end="")
                console.print("█", style=border_color, end="")
            else:
                console.print("█", style=border_color, end="")
                console.print(" " * (width - 2), style=f"on {sky_bg}", end="")
                console.print("█", style=border_color, end="")
        else:
            # Empty sky
            console.print("█", style=border_color, end="")
            console.print(" " * (width - 2), style=f"on {sky_bg}", end="")
            console.print("█", style=border_color, end="")

    # Bottom border
    console.print("█" * width, style=border_color, end="")


def print_frame(lines):
    """Print a frame with proper styling."""
    for item in lines:
        if len(item) == 2:
            text, style = item
            if style:
                console.print(text, style=style, end="")
            else:
                console.print(text, end="")
        else:
            console.print(item, end="")


def show_sunrise_complete():
    """Display the epic animated sunrise - sun rises, reveals text, parks at top."""
    import time
    import shutil

    # Sun art
    sun_art = [
        "        │        ",
        "    \\   │   /    ",
        "     \\  │  /     ",
        "      \\ │ /      ",
        "   ─────☀─────   ",
        "      / │ \\      ",
        "     /  │  \\     ",
        "    /   │   \\    ",
        "        │        ",
    ]
    sun_height = len(sun_art)

    # Messages
    msg1 = "Let there be light."
    msg2 = "Good Morning Jack, welcome to the game!"
    now = datetime.now()
    msg3 = f"☀ {now.strftime('%A, %B %d')} • {now.strftime('%H:%M')}"

    # Get terminal size (leave 1 line buffer to prevent scroll)
    term_size = shutil.get_terminal_size()
    width = term_size.columns
    height = term_size.lines - 1

    # Calculate positions
    msg_row = height // 2  # Where text will appear
    sun_final_row = 3       # Where sun parks at top

    # Sun starts at bottom, rises to top
    # Total frames: from bottom (height - sun_height) to top (sun_final_row)
    start_pos = height - 6
    end_pos = sun_final_row
    total_frames = start_pos - end_pos

    border_color = "bright_yellow"
    sun_color = "bright_yellow"
    sky_bg = "grey27"

    # Track which messages have been revealed
    revealed = [False, False, False]

    for frame in range(total_frames + 1):
        term_size = shutil.get_terminal_size()
        width = term_size.columns
        height = term_size.lines - 1  # Leave 1 line buffer to prevent scroll

        sun_row = max(end_pos, start_pos - frame)

        # Check if sun passed message rows - reveal text
        if sun_row < msg_row - 2:
            revealed[0] = True
        if sun_row < msg_row:
            revealed[1] = True
        if sun_row < msg_row + 2:
            revealed[2] = True

        console.clear()

        # Top border
        console.print("█" * width, style=border_color, end="")

        for row in range(1, height - 1):
            is_sun_row = sun_row <= row < sun_row + sun_height
            sun_idx = row - sun_row

            console.print("█", style=border_color, end="")

            if is_sun_row and 0 <= sun_idx < sun_height:
                # Sun row
                sun_line = sun_art[sun_idx]
                pad = (width - 2 - len(sun_line)) // 2
                console.print(" " * pad, style=f"on {sky_bg}", end="")
                console.print(sun_line, style=f"{sun_color} on {sky_bg}", end="")
                console.print(" " * (width - 2 - pad - len(sun_line)), style=f"on {sky_bg}", end="")
            elif row == msg_row - 2 and revealed[0]:
                # Message 1
                pad = (width - 2 - len(msg1)) // 2
                console.print(" " * pad, style=f"on {sky_bg}", end="")
                console.print(msg1, style=f"bold bright_yellow on {sky_bg}", end="")
                console.print(" " * (width - 2 - pad - len(msg1)), style=f"on {sky_bg}", end="")
            elif row == msg_row and revealed[1]:
                # Message 2
                pad = (width - 2 - len(msg2)) // 2
                console.print(" " * pad, style=f"on {sky_bg}", end="")
                console.print(msg2, style=f"italic orange1 on {sky_bg}", end="")
                console.print(" " * (width - 2 - pad - len(msg2)), style=f"on {sky_bg}", end="")
            elif row == msg_row + 2 and revealed[2]:
                # Message 3
                pad = (width - 2 - len(msg3)) // 2
                console.print(" " * pad, style=f"on {sky_bg}", end="")
                console.print(msg3, style=f"dim on {sky_bg}", end="")
                console.print(" " * (width - 2 - pad - len(msg3)), style=f"on {sky_bg}", end="")
            else:
                # Empty sky
                console.print(" " * (width - 2), style=f"on {sky_bg}", end="")

            console.print("█", style=border_color, end="")

        # Bottom border
        console.print("█" * width, style=border_color, end="")

        time.sleep(0.08)  # Animation speed

    # TODO: Work on logo more tomorrow - make it glow/pulse, add rays, etc.


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
        "description": "Research-backed 30-min sunrise with alerting 5000K end.",
        "phases": [
            {"pct": 0.40, "start_brightness": 1,  "end_brightness": 20,  "start_temp": 2500, "end_temp": 2700},
            {"pct": 0.35, "start_brightness": 20, "end_brightness": 60,  "start_temp": 2700, "end_temp": 3500},
            {"pct": 0.25, "start_brightness": 60, "end_brightness": 100, "start_temp": 3500, "end_temp": 5000},
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
}


async def discover_bulbs():
    """Find Kasa devices on the network."""
    devices = await Discover.discover()
    return devices


async def run_sunrise(ip: str, profile: str = "standard", verbose: bool = True, auto_off_hours: float = 3.0):
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

    # Ensure lamp is off before we begin
    if bulb.is_on:
        if verbose:
            print("  Turning off lamp before sunrise...")
        await bulb.turn_off()
        await asyncio.sleep(1)
        await bulb.update()
        if bulb.is_on:
            print("  Warning: Lamp still on, forcing off...")
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

    # Schedule auto-off after sunrise
    if auto_off_hours > 0:
        off_time = datetime.now() + timedelta(hours=auto_off_hours)
        print(f"\n  Lamp will auto-off at {off_time.strftime('%H:%M')} ({auto_off_hours:.1f}h from now)")
        print("  Press Ctrl+C to cancel auto-off and keep lamp on\n")

        try:
            await asyncio.sleep(auto_off_hours * 3600)
            # Reconnect since it's been a while
            bulb = await Device.connect(host=ip)
            await bulb.turn_off()
            print(f"\n  Auto-off complete. Lamp turned off at {datetime.now().strftime('%H:%M')}")
        except asyncio.CancelledError:
            print("\n  Auto-off cancelled. Lamp will stay on.")
        except KeyboardInterrupt:
            print("\n  Auto-off cancelled. Lamp will stay on.")


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


def show_waiting_screen(start_dt: datetime, end_dt: datetime, profile_name: str):
    """Show full-screen waiting display with countdown."""
    import shutil

    term_size = shutil.get_terminal_size()
    width = term_size.columns
    height = term_size.lines - 1

    now = datetime.now()
    wait_seconds = (start_dt - now).total_seconds()
    total_wait = (start_dt - (start_dt - timedelta(seconds=wait_seconds))).total_seconds()

    # Progress (inverted - starts full, empties as we approach)
    if total_wait > 0:
        progress = max(0, wait_seconds / total_wait)
    else:
        progress = 0

    border_color = "dim yellow"
    sky_bg = "grey11"

    console.clear()

    # Top border
    console.print("█" * width, style=border_color, end="")

    msg_row = height // 2 - 3

    for row in range(1, height - 1):
        console.print("█", style=border_color, end="")

        if row == msg_row - 2:
            msg = "☽ Sol - Sunrise Alarm"
            pad = (width - 2 - len(msg)) // 2
            console.print(" " * pad, style=f"on {sky_bg}", end="")
            console.print(msg, style=f"dim yellow on {sky_bg}", end="")
            console.print(" " * (width - 2 - pad - len(msg)), style=f"on {sky_bg}", end="")
        elif row == msg_row:
            msg = f"Sunrise at {start_dt.strftime('%H:%M')} → Complete by {end_dt.strftime('%H:%M')}"
            pad = (width - 2 - len(msg)) // 2
            console.print(" " * pad, style=f"on {sky_bg}", end="")
            console.print(msg, style=f"orange1 on {sky_bg}", end="")
            console.print(" " * (width - 2 - pad - len(msg)), style=f"on {sky_bg}", end="")
        elif row == msg_row + 2:
            # Countdown
            hours = int(wait_seconds // 3600)
            mins = int((wait_seconds % 3600) // 60)
            secs = int(wait_seconds % 60)
            msg = f"T-{hours:02d}:{mins:02d}:{secs:02d}"
            pad = (width - 2 - len(msg)) // 2
            console.print(" " * pad, style=f"on {sky_bg}", end="")
            console.print(msg, style=f"bold bright_yellow on {sky_bg}", end="")
            console.print(" " * (width - 2 - pad - len(msg)), style=f"on {sky_bg}", end="")
        elif row == msg_row + 4:
            # Progress bar
            bar_width = min(40, width - 10)
            filled = int(bar_width * (1 - progress))  # Fills up as time passes
            bar = "█" * filled + "░" * (bar_width - filled)
            msg = f"[{bar}]"
            pad = (width - 2 - len(msg)) // 2
            console.print(" " * pad, style=f"on {sky_bg}", end="")
            console.print(msg, style=f"yellow on {sky_bg}", end="")
            console.print(" " * (width - 2 - pad - len(msg)), style=f"on {sky_bg}", end="")
        elif row == msg_row + 6:
            msg = "Press Ctrl+C to cancel"
            pad = (width - 2 - len(msg)) // 2
            console.print(" " * pad, style=f"on {sky_bg}", end="")
            console.print(msg, style=f"dim on {sky_bg}", end="")
            console.print(" " * (width - 2 - pad - len(msg)), style=f"on {sky_bg}", end="")
        else:
            console.print(" " * (width - 2), style=f"on {sky_bg}", end="")

        console.print("█", style=border_color, end="")

    # Bottom border
    console.print("█" * width, style=border_color, end="")


async def schedule_sunrise(wake_time: str, ip: str, profile: str, auto_off_hours: float = 3.0):
    """Schedule sunrise with live countdown display."""
    try:
        wake_hour, wake_minute = map(int, wake_time.split(":"))
    except ValueError:
        print(f"Error: Invalid time format '{wake_time}'. Use HH:MM (e.g., 06:30)")
        return

    config = SUNRISE_PROFILES.get(profile, SUNRISE_PROFILES["standard"])
    duration_minutes = config["duration_minutes"]

    # Turn off lamp immediately when alarm is scheduled
    try:
        bulb = await Device.connect(host=ip)
        await bulb.update()
        if bulb.is_on:
            await bulb.turn_off()
            print("Lamp turned off - ready for sunrise")
    except Exception as e:
        print(f"Warning: Could not turn off lamp: {e}")

    now = datetime.now()
    wake_dt = now.replace(hour=wake_hour, minute=wake_minute, second=0, microsecond=0)

    # If start time already passed today, schedule for tomorrow
    if wake_dt <= now:
        wake_dt += timedelta(days=1)

    # Time specified is when sunrise STARTS
    start_dt = wake_dt
    end_dt = wake_dt + timedelta(minutes=duration_minutes)

    # Show countdown until sunrise
    while datetime.now() < start_dt:
        show_waiting_screen(start_dt, end_dt, config['name'])
        await asyncio.sleep(1)

    # Run the actual sunrise (bulb + terminal animation synced)
    await run_sunrise(ip, profile, auto_off_hours=auto_off_hours)


async def cmd_now(args):
    """Handle 'now' command - immediate sunrise."""
    ip = args.ip or DEFAULT_BULB_IP
    auto_off = 0 if args.no_auto_off else args.auto_off
    await run_sunrise(ip, args.profile, auto_off_hours=auto_off)


async def cmd_at(args):
    """Handle 'at' command - scheduled sunrise."""
    ip = args.ip or DEFAULT_BULB_IP
    auto_off = 0 if args.no_auto_off else args.auto_off
    await schedule_sunrise(args.time, ip, args.profile, auto_off_hours=auto_off)


async def cmd_up(args):
    """Handle 'up' command - wake up at specified time (sunrise ends then)."""
    ip = args.ip or DEFAULT_BULB_IP
    config = SUNRISE_PROFILES.get(args.profile, SUNRISE_PROFILES["standard"])
    duration_minutes = config["duration_minutes"]
    auto_off = 0 if args.no_auto_off else args.auto_off

    # Parse the wake time
    try:
        wake_hour, wake_minute = map(int, args.time.split(":"))
    except ValueError:
        print(f"Error: Invalid time format '{args.time}'. Use HH:MM (e.g., 07:00)")
        return

    # Calculate start time (subtract duration from wake time)
    now = datetime.now()
    wake_dt = now.replace(hour=wake_hour, minute=wake_minute, second=0, microsecond=0)
    if wake_dt <= now:
        wake_dt += timedelta(days=1)

    start_dt = wake_dt - timedelta(minutes=duration_minutes)
    start_time = start_dt.strftime("%H:%M")

    print(f"Wake up at {args.time} → Sunrise starts at {start_time} ({duration_minutes} min)")
    await schedule_sunrise(start_time, ip, args.profile, auto_off_hours=auto_off)


async def cmd_rise(args):
    """Handle 'rise' command - sunrise starts at specified time."""
    ip = args.ip or DEFAULT_BULB_IP
    config = SUNRISE_PROFILES.get(args.profile, SUNRISE_PROFILES["standard"])
    duration_minutes = config["duration_minutes"]
    auto_off = 0 if args.no_auto_off else args.auto_off

    # Parse the start time
    try:
        start_hour, start_minute = map(int, args.time.split(":"))
    except ValueError:
        print(f"Error: Invalid time format '{args.time}'. Use HH:MM (e.g., 06:30)")
        return

    now = datetime.now()
    start_dt = now.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
    if start_dt <= now:
        start_dt += timedelta(days=1)

    end_dt = start_dt + timedelta(minutes=duration_minutes)
    end_time = end_dt.strftime("%H:%M")

    print(f"Sunrise at {args.time} → Wake up at {end_time} ({duration_minutes} min)")
    await schedule_sunrise(args.time, ip, args.profile, auto_off_hours=auto_off)


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


async def cmd_test_ui(args):
    """Test the terminal UI in isolation."""
    import time
    import webbrowser

    # Web mode - open portfolio website with test params
    if args.web:
        base_url = "http://localhost:3000/projects/sol-sunrise-lamp"
        params = []
        if args.time:
            params.append(f"time={args.time}")
        if args.date:
            params.append(f"date={args.date}")
        if args.scrub:
            params.append("scrub=true")
            params.append(f"speed={int(args.speed)}")

        url = base_url + ("?" + "&".join(params) if params else "")
        console.print(f"[cyan]Opening:[/cyan] {url}")
        webbrowser.open(url)
        return

    if args.complete_only:
        show_sunrise_complete()
        return

    if args.waiting:
        # Test waiting screen for 10 seconds
        start = datetime.now() + timedelta(seconds=10)
        end = start + timedelta(minutes=30)
        for _ in range(10):
            show_waiting_screen(start, end, "Test")
            time.sleep(1)
        show_sunrise_complete()
        return

    # Time/date simulation mode
    if args.time or args.date or args.scrub:
        show_sky_simulation(args)
        return

    # Export mode
    if args.export:
        export_sky_frames(args.export)
        return

    console.print("[dim]Testing progress bar...[/dim]\n")

    # Simulate sunrise progress
    for i in range(0, 101, 2):
        show_progress(1, 3, i, 2500 + int(i * 15))
        time.sleep(0.05)

    print()  # Clear progress line
    time.sleep(0.5)

    show_sunrise_complete()


def show_sky_simulation(args):
    """Show sky simulation with time/date controls."""
    import time
    import shutil
    from datetime import datetime

    # Toronto coordinates
    TORONTO_LAT = 43.6532
    TORONTO_LON = -79.3832

    # Parse base date/time
    base_date = datetime.now()
    if args.date:
        try:
            year, month, day = map(int, args.date.split("-"))
            base_date = base_date.replace(year=year, month=month, day=day)
        except ValueError:
            console.print("[red]Invalid date format. Use YYYY-MM-DD[/red]")
            return

    if args.time:
        try:
            parts = args.time.split(":")
            hour, minute = int(parts[0]), int(parts[1])
            second = int(parts[2]) if len(parts) > 2 else 0
            base_date = base_date.replace(hour=hour, minute=minute, second=second)
        except (ValueError, IndexError):
            console.print("[red]Invalid time format. Use HH:MM or HH:MM:SS[/red]")
            return

    console.print(f"[cyan]Sky Simulation[/cyan]")
    console.print(f"Base time: {base_date.strftime('%Y-%m-%d %H:%M:%S')}")
    if args.scrub:
        console.print(f"Scrub mode: {args.speed} minutes/second")
    console.print("[dim]Press Ctrl+C to exit[/dim]\n")

    offset_minutes = 0

    try:
        while True:
            # Calculate simulated time
            sim_time = base_date + timedelta(minutes=offset_minutes)

            # Get terminal size
            term_size = shutil.get_terminal_size()
            width = term_size.columns
            height = min(term_size.lines - 4, 20)  # Leave room for info

            # Calculate sun position (simplified)
            hour = sim_time.hour + sim_time.minute / 60
            # Simplified altitude: peaks at noon, negative at night
            altitude = 70 * math.sin((hour - 6) * math.pi / 12) if 6 <= hour <= 18 else -20

            # Determine colors based on altitude
            if altitude > 15:
                sky_bg = "grey27"
                border_color = "bright_yellow"
                sun_char = "☀"
            elif altitude > 0:
                sky_bg = "grey19"
                border_color = "yellow"
                sun_char = "☀"
            elif altitude > -6:
                sky_bg = "grey11"
                border_color = "orange1"
                sun_char = "☀"
            else:
                sky_bg = "grey7"
                border_color = "blue"
                sun_char = "☽"

            # Clear and render
            console.clear()

            # Info bar
            time_str = sim_time.strftime("%A, %B %d • %H:%M")
            console.print(f"[dim]{sun_char} {time_str}[/dim]")
            console.print(f"[dim]Sun altitude: {altitude:.1f}°[/dim]\n")

            # Simple sky visualization
            console.print("█" * width, style=border_color)
            for row in range(height):
                console.print("█", style=border_color, end="")
                console.print(" " * (width - 2), style=f"on {sky_bg}", end="")
                console.print("█", style=border_color)
            console.print("█" * width, style=border_color)

            # Update for scrub mode
            if args.scrub:
                offset_minutes += args.speed / 10  # Update 10x per second
                if offset_minutes >= 1440:  # 24 hours
                    offset_minutes = 0
                time.sleep(0.1)
            else:
                time.sleep(1)
    except KeyboardInterrupt:
        console.print("\n[dim]Simulation ended.[/dim]")


def export_sky_frames(output_dir: str):
    """Export sky frames for GIF creation."""
    import os
    import shutil

    os.makedirs(output_dir, exist_ok=True)

    console.print(f"[cyan]Exporting frames to:[/cyan] {output_dir}")
    console.print("[dim]This will export 24 frames (one per hour)[/dim]\n")

    term_size = shutil.get_terminal_size()
    width = min(term_size.columns, 80)
    height = 15

    for hour in range(24):
        # Calculate sun altitude
        altitude = 70 * math.sin((hour - 6) * math.pi / 12) if 6 <= hour <= 18 else -20

        # Determine colors
        if altitude > 15:
            sky_color = "#4a90d9"
            border_color = "#ffff00"
        elif altitude > 0:
            sky_color = "#ff8c42"
            border_color = "#ffd700"
        elif altitude > -6:
            sky_color = "#2a2a5a"
            border_color = "#ff6b35"
        else:
            sky_color = "#0a0a1a"
            border_color = "#4a4a6a"

        # Write frame info
        frame_file = os.path.join(output_dir, f"frame_{hour:02d}.txt")
        with open(frame_file, "w") as f:
            f.write(f"Hour: {hour:02d}:00\n")
            f.write(f"Altitude: {altitude:.1f}\n")
            f.write(f"Sky: {sky_color}\n")
            f.write(f"Border: {border_color}\n")

        console.print(f"  [green]✓[/green] Frame {hour:02d}:00 (altitude: {altitude:.1f}°)")

    console.print(f"\n[green]Exported 24 frames to {output_dir}[/green]")
    console.print("[dim]Use VHS or similar tool to render final GIF[/dim]")


def main():
    parser = argparse.ArgumentParser(
        description="Sunrise Alarm - Science-backed wake-up light using Kasa smart bulbs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s up 07:00                 # Wake up at 7:00 AM (sunrise ends then)
  %(prog)s up 07:00 -p gentle       # Gentle 45-min sunrise, wake at 7:00
  %(prog)s rise 06:30               # Sunrise starts at 6:30 AM
  %(prog)s now                      # Start sunrise immediately
  %(prog)s now -p quick             # Start quick 20-min sunrise
  %(prog)s demo                     # Fun 35-second light show
  %(prog)s profiles                 # List all available profiles

Profiles: standard (30min), quick (20min), gentle (45min)
"""
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Common arguments
    def add_common_args(p, include_profile=True, include_auto_off=True):
        p.add_argument("--ip", help=f"Bulb IP address (default: {DEFAULT_BULB_IP})")
        if include_profile:
            p.add_argument("-p", "--profile", default="standard",
                           help="Sunrise profile (default: standard)")
        if include_auto_off:
            p.add_argument("--auto-off", type=float, default=3.0,
                           help="Hours after sunrise to auto-turn off lamp (default: 3.0)")
            p.add_argument("--no-auto-off", action="store_true",
                           help="Disable auto-off (lamp stays on indefinitely)")

    # 'now' - immediate sunrise
    now_parser = subparsers.add_parser("now", help="Start sunrise immediately")
    add_common_args(now_parser)
    now_parser.set_defaults(func=cmd_now)

    # 'at' - scheduled sunrise (legacy, same as 'rise')
    at_parser = subparsers.add_parser("at", help="Schedule sunrise start time (alias for 'rise')")
    at_parser.add_argument("time", nargs="?", default=DEFAULT_WAKE_TIME,
                           help=f"Sunrise start time in HH:MM format (default: {DEFAULT_WAKE_TIME})")
    add_common_args(at_parser)
    at_parser.set_defaults(func=cmd_at)

    # 'up' - wake up at specified time (sunrise ends then)
    up_parser = subparsers.add_parser("up", help="Wake up at specified time (sunrise ends then)")
    up_parser.add_argument("time", nargs="?", default=DEFAULT_WAKE_TIME,
                           help=f"Wake up time in HH:MM format (default: {DEFAULT_WAKE_TIME})")
    add_common_args(up_parser)
    up_parser.set_defaults(func=cmd_up)

    # 'rise' - sunrise starts at specified time
    rise_parser = subparsers.add_parser("rise", help="Sunrise starts at specified time")
    rise_parser.add_argument("time", nargs="?", default=DEFAULT_WAKE_TIME,
                             help=f"Sunrise start time in HH:MM format (default: {DEFAULT_WAKE_TIME})")
    add_common_args(rise_parser)
    rise_parser.set_defaults(func=cmd_rise)

    # 'demo' - fun demo mode
    demo_parser = subparsers.add_parser("demo", help="Fun 35-second light show demo")
    add_common_args(demo_parser, include_profile=False, include_auto_off=False)
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

    # 'test-ui' - test terminal UI
    test_ui_parser = subparsers.add_parser("test-ui", help="Test terminal UI in isolation")
    test_ui_parser.add_argument("-c", "--complete-only", action="store_true",
                                 help="Only show completion screen")
    test_ui_parser.add_argument("-w", "--waiting", action="store_true",
                                 help="Test waiting/countdown screen")
    test_ui_parser.add_argument("-t", "--time", type=str,
                                 help="Simulate specific time (HH:MM or HH:MM:SS)")
    test_ui_parser.add_argument("-d", "--date", type=str,
                                 help="Simulate specific date (YYYY-MM-DD)")
    test_ui_parser.add_argument("-s", "--scrub", action="store_true",
                                 help="Enable 24-hour scrub mode (cycle through day)")
    test_ui_parser.add_argument("--speed", type=float, default=60.0,
                                 help="Scrub speed: minutes per second (default: 60)")
    test_ui_parser.add_argument("--export", type=str,
                                 help="Export frames to directory for GIF creation")
    test_ui_parser.add_argument("--web", action="store_true",
                                 help="Open portfolio website test page in browser")
    test_ui_parser.set_defaults(func=cmd_test_ui)

    args = parser.parse_args()

    if not args.command:
        # No command given - launch interactive setup TUI
        asyncio.run(interactive_setup())
        return

    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
