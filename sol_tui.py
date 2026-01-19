#!/usr/bin/env python3
"""Sol Sunrise Alarm - Textual TUI.

A beautiful, flicker-free terminal interface for configuring sunrise alarms.
"""

import asyncio
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from kasa import Device, Module
from rich.text import Text
from textual import on, work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Center, Container, Vertical
from textual.reactive import reactive
from textual.screen import Screen
from textual.widgets import Footer, Static

# Default configuration
DEFAULT_BULB_IP = "192.168.1.77"

# Duration options (minutes)
DURATION_OPTIONS = [20, 30, 45]

# End temperature options (Kelvin)
END_TEMP_OPTIONS = [4000, 4500, 5000, 5500, 6000, 6500]

# ASCII sun art for header
SUN_ASCII = """
       \\   \u2502   /
        \\  \u2502  /
      \u2500\u2500\u2500\u2500(\u2609)\u2500\u2500\u2500\u2500
        /  \u2502  \\
       /   \u2502   \\
"""

SUN_ASCII_SMALL = """    \\  \u2502  /
   \u2500\u2500\u2500(\u2609)\u2500\u2500\u2500
    /  \u2502  \\"""

# Animation sun art (same as main.py)
ANIMATION_SUN = [
    "        \u2502        ",
    "    \\   \u2502   /    ",
    "     \\  \u2502  /     ",
    "      \\ \u2502 /      ",
    "   \u2500\u2500\u2500\u2500\u2500\u2609\u2500\u2500\u2500\u2500\u2500   ",
    "      / \u2502 \\      ",
    "     /  \u2502  \\     ",
    "    /   \u2502   \\    ",
    "        \u2502        ",
]


class ConfigField(Static):
    """A single configurable field with label and value."""

    selected = reactive(False)

    def __init__(
        self,
        label: str,
        value: str,
        field_id: str,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self.label = label
        self._value = value
        self.field_id = field_id

    @property
    def value(self) -> str:
        return self._value

    @value.setter
    def value(self, new_value: str) -> None:
        self._value = new_value
        self.refresh()

    def render(self) -> Text:
        text = Text()
        if self.selected:
            text.append("  > ", style="bold yellow")
            text.append(f"{self.label}: ", style="bold yellow")
            text.append(f"{self._value}", style="bold bright_yellow")
            text.append(" <", style="bold yellow")
        else:
            text.append("    ", style="dim")
            text.append(f"{self.label}: ", style="dim white")
            text.append(f"{self._value}", style="white")
        return text

    def watch_selected(self, selected: bool) -> None:
        self.refresh()


class StatusDisplay(Static):
    """Displays lamp connection status."""

    status = reactive("Checking...")

    def render(self) -> Text:
        text = Text()
        if self.status == "Connected":
            text.append("    Lamp: ", style="dim")
            text.append("Connected", style="green")
        elif self.status == "Checking...":
            text.append("    Lamp: ", style="dim")
            text.append("Checking...", style="yellow")
        else:
            text.append("    Lamp: ", style="dim")
            text.append("Not Found", style="red")
        return text


class SunriseInfo(Static):
    """Displays calculated sunrise start time."""

    wake_time: str = "07:00"
    duration: int = 30

    def update_info(self, wake_time: str, duration: int) -> None:
        self.wake_time = wake_time
        self.duration = duration
        self.refresh()

    def render(self) -> Text:
        try:
            hour, minute = map(int, self.wake_time.split(":"))
            wake_dt = datetime.now().replace(
                hour=hour, minute=minute, second=0, microsecond=0
            )
            start_dt = wake_dt - timedelta(minutes=self.duration)
            start_time = start_dt.strftime("%H:%M")
        except (ValueError, AttributeError):
            start_time = "--:--"

        text = Text()
        text.append("\n    Sunrise starts: ", style="dim")
        text.append(f"{start_time}", style="orange1")
        text.append(" -> Wake: ", style="dim")
        text.append(f"{self.wake_time}", style="bright_yellow")
        return text


class SunHeader(Static):
    """ASCII sun art header."""

    def render(self) -> Text:
        text = Text()
        for line in SUN_ASCII_SMALL.split("\n"):
            text.append(line + "\n", style="bold bright_yellow")
        text.append("\n")
        text.append("       Sol", style="bold bright_yellow")
        text.append(" - Sunrise Alarm\n", style="dim yellow")
        return text


class AnimationScreen(Screen):
    """Full-screen sunrise animation."""

    BINDINGS = [
        Binding("escape", "dismiss", "Exit"),
        Binding("q", "dismiss", "Exit"),
    ]

    def compose(self) -> ComposeResult:
        yield Static(id="animation-canvas")

    async def on_mount(self) -> None:
        self.run_animation()

    @work
    async def run_animation(self) -> None:
        """Run the sunrise animation."""
        canvas = self.query_one("#animation-canvas", Static)
        sun_art = ANIMATION_SUN
        sun_height = len(sun_art)

        # Messages
        msg1 = "Let there be light."
        msg2 = "Good Morning, welcome to the game!"
        now = datetime.now()
        msg3 = f"\u2600 {now.strftime('%A, %B %d')} \u2022 {now.strftime('%H:%M')}"

        # Get terminal size
        width = self.app.size.width
        height = self.app.size.height - 2

        # Calculate positions
        msg_row = height // 2
        sun_final_row = 3

        # Sun starts at bottom, rises to top
        start_pos = height - 6
        end_pos = sun_final_row
        total_frames = start_pos - end_pos

        border_color = "bright_yellow"
        sun_color = "bright_yellow"
        sky_bg = "grey27"

        revealed = [False, False, False]

        for frame in range(total_frames + 1):
            sun_row = max(end_pos, start_pos - frame)

            # Check if sun passed message rows
            if sun_row < msg_row - 2:
                revealed[0] = True
            if sun_row < msg_row:
                revealed[1] = True
            if sun_row < msg_row + 2:
                revealed[2] = True

            # Build the frame
            lines = []

            # Top border
            lines.append(("\u2588" * width, border_color))

            for row in range(1, height - 1):
                is_sun_row = sun_row <= row < sun_row + sun_height
                sun_idx = row - sun_row

                line_text = Text()
                line_text.append("\u2588", style=border_color)

                if is_sun_row and 0 <= sun_idx < sun_height:
                    sun_line = sun_art[sun_idx]
                    pad = (width - 2 - len(sun_line)) // 2
                    line_text.append(" " * pad, style=f"on {sky_bg}")
                    line_text.append(sun_line, style=f"{sun_color} on {sky_bg}")
                    remaining = width - 2 - pad - len(sun_line)
                    line_text.append(" " * remaining, style=f"on {sky_bg}")
                elif row == msg_row - 2 and revealed[0]:
                    pad = (width - 2 - len(msg1)) // 2
                    line_text.append(" " * pad, style=f"on {sky_bg}")
                    line_text.append(msg1, style=f"bold bright_yellow on {sky_bg}")
                    remaining = width - 2 - pad - len(msg1)
                    line_text.append(" " * remaining, style=f"on {sky_bg}")
                elif row == msg_row and revealed[1]:
                    pad = (width - 2 - len(msg2)) // 2
                    line_text.append(" " * pad, style=f"on {sky_bg}")
                    line_text.append(msg2, style=f"italic orange1 on {sky_bg}")
                    remaining = width - 2 - pad - len(msg2)
                    line_text.append(" " * remaining, style=f"on {sky_bg}")
                elif row == msg_row + 2 and revealed[2]:
                    pad = (width - 2 - len(msg3)) // 2
                    line_text.append(" " * pad, style=f"on {sky_bg}")
                    line_text.append(msg3, style=f"dim on {sky_bg}")
                    remaining = width - 2 - pad - len(msg3)
                    line_text.append(" " * remaining, style=f"on {sky_bg}")
                else:
                    line_text.append(" " * (width - 2), style=f"on {sky_bg}")

                line_text.append("\u2588", style=border_color)
                lines.append(line_text)

            # Bottom border
            lines.append(Text("\u2588" * width, style=border_color))

            # Combine all lines
            full_text = Text()
            for i, line in enumerate(lines):
                if isinstance(line, tuple):
                    full_text.append(line[0], style=line[1])
                else:
                    full_text.append(line)
                if i < len(lines) - 1:
                    full_text.append("\n")

            canvas.update(full_text)
            await asyncio.sleep(0.08)


class SolApp(App):
    """Sol Sunrise Alarm TUI."""

    CSS = """
    Screen {
        background: $surface;
    }

    #main-container {
        width: 100%;
        height: 100%;
        align: center middle;
    }

    #config-panel {
        width: 50;
        height: auto;
        padding: 1 2;
        border: round $primary;
        background: $surface-darken-1;
    }

    #sun-header {
        text-align: center;
        margin-bottom: 1;
    }

    .config-field {
        height: 1;
        margin: 0 0;
    }

    #status-display {
        margin-top: 1;
    }

    #sunrise-info {
        margin-top: 0;
    }

    #instructions {
        margin-top: 1;
        text-align: center;
    }

    Footer {
        background: $surface-darken-2;
    }

    AnimationScreen {
        background: #3d3d3d;
    }

    #animation-canvas {
        width: 100%;
        height: 100%;
    }
    """

    BINDINGS = [
        Binding("up", "move_up", "Up"),
        Binding("down", "move_down", "Down"),
        Binding("left", "adjust_left", "Decrease"),
        Binding("right", "adjust_right", "Increase"),
        Binding("enter", "confirm", "Start Alarm"),
        Binding("a", "animate", "Animation"),
        Binding("q", "quit", "Quit"),
    ]

    # Reactive state
    current_field = reactive(0)
    wake_time = reactive("07:00")
    duration_idx = reactive(1)  # Index into DURATION_OPTIONS (default 30)
    end_temp_idx = reactive(0)  # Index into END_TEMP_OPTIONS (default 4000)
    lamp_status = reactive("Checking...")

    def __init__(self, bulb_ip: str = DEFAULT_BULB_IP) -> None:
        super().__init__()
        self.bulb_ip = bulb_ip
        self.fields: list[ConfigField] = []

    def compose(self) -> ComposeResult:
        with Center(id="main-container"):
            with Container(id="config-panel"):
                yield SunHeader(id="sun-header")
                yield ConfigField(
                    "Wake Time",
                    self.wake_time,
                    "wake_time",
                    classes="config-field",
                )
                yield ConfigField(
                    "Duration",
                    f"{DURATION_OPTIONS[self.duration_idx]} min",
                    "duration",
                    classes="config-field",
                )
                yield ConfigField(
                    "End Temp",
                    f"{END_TEMP_OPTIONS[self.end_temp_idx]}K",
                    "end_temp",
                    classes="config-field",
                )
                yield StatusDisplay(id="status-display")
                yield SunriseInfo(id="sunrise-info")
                yield Static(
                    "\n[dim]Arrow keys to adjust, Enter to start[/dim]",
                    id="instructions",
                )
        yield Footer()

    async def on_mount(self) -> None:
        """Initialize the app on mount."""
        # Get field references
        self.fields = list(self.query(ConfigField))

        # Select the first field
        if self.fields:
            self.fields[0].selected = True

        # Update sunrise info
        self._update_sunrise_info()

        # Check lamp connection
        self.check_lamp_connection()

    @work(exclusive=True)
    async def check_lamp_connection(self) -> None:
        """Check if the lamp is reachable."""
        status_widget = self.query_one(StatusDisplay)
        try:
            bulb = await Device.connect(host=self.bulb_ip)
            await bulb.update()
            status_widget.status = "Connected"
        except Exception:
            status_widget.status = "Not Found"

    def watch_current_field(self, old: int, new: int) -> None:
        """Update field selection when current_field changes."""
        if self.fields:
            if 0 <= old < len(self.fields):
                self.fields[old].selected = False
            if 0 <= new < len(self.fields):
                self.fields[new].selected = True

    def _update_field_displays(self) -> None:
        """Update all field display values."""
        if len(self.fields) >= 3:
            self.fields[0].value = self.wake_time
            self.fields[1].value = f"{DURATION_OPTIONS[self.duration_idx]} min"
            self.fields[2].value = f"{END_TEMP_OPTIONS[self.end_temp_idx]}K"

    def _update_sunrise_info(self) -> None:
        """Update the sunrise info display."""
        info = self.query_one(SunriseInfo)
        info.update_info(self.wake_time, DURATION_OPTIONS[self.duration_idx])

    def action_move_up(self) -> None:
        """Move selection up."""
        if self.current_field > 0:
            self.current_field -= 1

    def action_move_down(self) -> None:
        """Move selection down."""
        if self.current_field < len(self.fields) - 1:
            self.current_field += 1

    def action_adjust_left(self) -> None:
        """Decrease the current field value."""
        if self.current_field == 0:
            # Wake time: decrease by 5 minutes
            self._adjust_wake_time(-5)
        elif self.current_field == 1:
            # Duration: previous option
            if self.duration_idx > 0:
                self.duration_idx -= 1
        elif self.current_field == 2:
            # End temp: previous option
            if self.end_temp_idx > 0:
                self.end_temp_idx -= 1

        self._update_field_displays()
        self._update_sunrise_info()

    def action_adjust_right(self) -> None:
        """Increase the current field value."""
        if self.current_field == 0:
            # Wake time: increase by 5 minutes
            self._adjust_wake_time(5)
        elif self.current_field == 1:
            # Duration: next option
            if self.duration_idx < len(DURATION_OPTIONS) - 1:
                self.duration_idx += 1
        elif self.current_field == 2:
            # End temp: next option
            if self.end_temp_idx < len(END_TEMP_OPTIONS) - 1:
                self.end_temp_idx += 1

        self._update_field_displays()
        self._update_sunrise_info()

    def _adjust_wake_time(self, delta_minutes: int) -> None:
        """Adjust wake time by delta_minutes."""
        try:
            hour, minute = map(int, self.wake_time.split(":"))
            dt = datetime.now().replace(hour=hour, minute=minute)
            dt += timedelta(minutes=delta_minutes)
            self.wake_time = dt.strftime("%H:%M")
        except ValueError:
            pass

    def action_animate(self) -> None:
        """Show the sunrise animation."""
        self.push_screen(AnimationScreen())

    def action_confirm(self) -> None:
        """Confirm settings and start the alarm."""
        self.start_alarm()

    @work
    async def start_alarm(self) -> None:
        """Turn off lamp and launch alarm in new terminal."""
        # Turn off lamp first
        try:
            bulb = await Device.connect(host=self.bulb_ip)
            await bulb.turn_off()
        except Exception:
            pass  # Continue even if lamp not found

        # Build the command
        duration = DURATION_OPTIONS[self.duration_idx]
        # Map duration to profile
        profile_map = {20: "quick", 30: "standard", 45: "gentle"}
        profile = profile_map.get(duration, "standard")

        main_py = Path(__file__).parent / "main.py"
        cmd = f"uv run python {main_py} up {self.wake_time} -p {profile}"

        # Launch in new Terminal with caffeinate
        apple_script = f'''
        tell application "Terminal"
            activate
            do script "caffeinate -d {cmd}"
        end tell
        '''

        subprocess.run(["osascript", "-e", apple_script], check=False)

        # Exit the TUI
        self.exit()


def run_tui(bulb_ip: str = DEFAULT_BULB_IP) -> None:
    """Run the Sol TUI application."""
    app = SolApp(bulb_ip=bulb_ip)
    app.run()


if __name__ == "__main__":
    run_tui()
