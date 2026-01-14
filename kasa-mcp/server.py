#!/usr/bin/env python3
"""
Kasa Smart Bulb MCP Server
Control TP-Link Kasa bulbs directly from Claude Code!
"""

import asyncio
import json
from typing import Any
from mcp.server.models import InitializationOptions
import mcp.types as types
from mcp.server import NotificationOptions, Server
from kasa import Discover, SmartBulb

server = Server("kasa-bulb-controller")

# Cache discovered devices
discovered_devices: dict[str, dict] = {}


async def get_bulb(ip: str) -> SmartBulb:
    """Get a SmartBulb instance and update it."""
    bulb = SmartBulb(ip)
    await bulb.update()
    return bulb


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available Kasa control tools."""
    return [
        types.Tool(
            name="kasa_discover",
            description="Discover all Kasa smart devices on the network. Run this first to find bulb IP addresses.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        types.Tool(
            name="kasa_on",
            description="Turn a Kasa bulb ON",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {
                        "type": "string",
                        "description": "IP address of the bulb (e.g., 192.168.1.100)",
                    },
                },
                "required": ["ip"],
            },
        ),
        types.Tool(
            name="kasa_off",
            description="Turn a Kasa bulb OFF",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {
                        "type": "string",
                        "description": "IP address of the bulb",
                    },
                },
                "required": ["ip"],
            },
        ),
        types.Tool(
            name="kasa_brightness",
            description="Set bulb brightness (1-100%)",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address of the bulb"},
                    "brightness": {
                        "type": "integer",
                        "description": "Brightness level 1-100",
                        "minimum": 1,
                        "maximum": 100,
                    },
                },
                "required": ["ip", "brightness"],
            },
        ),
        types.Tool(
            name="kasa_color_temp",
            description="Set bulb color temperature (warm to cool white)",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address of the bulb"},
                    "temperature": {
                        "type": "integer",
                        "description": "Color temperature in Kelvin (2500=warm, 6500=cool)",
                        "minimum": 2500,
                        "maximum": 6500,
                    },
                },
                "required": ["ip", "temperature"],
            },
        ),
        types.Tool(
            name="kasa_color",
            description="Set bulb to a specific color (for color bulbs like KL125)",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address of the bulb"},
                    "hue": {
                        "type": "integer",
                        "description": "Hue 0-360 (0=red, 120=green, 240=blue)",
                        "minimum": 0,
                        "maximum": 360,
                    },
                    "saturation": {
                        "type": "integer",
                        "description": "Saturation 0-100 (0=white, 100=full color)",
                        "minimum": 0,
                        "maximum": 100,
                    },
                },
                "required": ["ip", "hue", "saturation"],
            },
        ),
        types.Tool(
            name="kasa_status",
            description="Get current status of a Kasa bulb (on/off, brightness, color)",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address of the bulb"},
                },
                "required": ["ip"],
            },
        ),
        types.Tool(
            name="kasa_sunrise",
            description="Start a sunrise simulation - gradually brighten the bulb over time",
            inputSchema={
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address of the bulb"},
                    "duration_seconds": {
                        "type": "integer",
                        "description": "Duration of sunrise in seconds (default 60)",
                        "minimum": 10,
                        "maximum": 3600,
                    },
                    "start_temp": {
                        "type": "integer",
                        "description": "Starting color temp in Kelvin (default 2500 warm)",
                        "minimum": 2500,
                        "maximum": 6500,
                    },
                    "end_temp": {
                        "type": "integer",
                        "description": "Ending color temp in Kelvin (default 4000 neutral)",
                        "minimum": 2500,
                        "maximum": 6500,
                    },
                },
                "required": ["ip"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent]:
    """Handle tool calls for Kasa control."""

    if arguments is None:
        arguments = {}

    try:
        if name == "kasa_discover":
            devices = await Discover.discover()
            discovered_devices.clear()

            if not devices:
                return [types.TextContent(
                    type="text",
                    text="No Kasa devices found on network.\n\nMake sure:\n1. Bulb is screwed in and powered on\n2. Bulb is set up via Kasa phone app\n3. Bulb is on same WiFi network as this computer\n4. Your WiFi is 2.4GHz (Kasa doesn't support 5GHz)"
                )]

            result = "Found Kasa devices:\n\n"
            for ip, dev in devices.items():
                await dev.update()
                discovered_devices[ip] = {
                    "alias": dev.alias,
                    "model": dev.model,
                    "is_bulb": dev.is_bulb,
                    "is_on": dev.is_on,
                }
                result += f"- **{dev.alias}** ({dev.model})\n"
                result += f"  IP: `{ip}`\n"
                result += f"  Status: {'ON' if dev.is_on else 'OFF'}\n\n"

            return [types.TextContent(type="text", text=result)]

        elif name == "kasa_on":
            ip = arguments["ip"]
            bulb = await get_bulb(ip)
            await bulb.turn_on()
            return [types.TextContent(type="text", text=f"Turned ON bulb at {ip}")]

        elif name == "kasa_off":
            ip = arguments["ip"]
            bulb = await get_bulb(ip)
            await bulb.turn_off()
            return [types.TextContent(type="text", text=f"Turned OFF bulb at {ip}")]

        elif name == "kasa_brightness":
            ip = arguments["ip"]
            brightness = arguments["brightness"]
            bulb = await get_bulb(ip)
            await bulb.set_brightness(brightness)
            return [types.TextContent(
                type="text",
                text=f"Set brightness to {brightness}% on bulb at {ip}"
            )]

        elif name == "kasa_color_temp":
            ip = arguments["ip"]
            temp = arguments["temperature"]
            bulb = await get_bulb(ip)
            await bulb.set_color_temp(temp)
            return [types.TextContent(
                type="text",
                text=f"Set color temperature to {temp}K on bulb at {ip}"
            )]

        elif name == "kasa_color":
            ip = arguments["ip"]
            hue = arguments["hue"]
            saturation = arguments["saturation"]
            bulb = await get_bulb(ip)
            # set_hsv takes (hue, saturation, value/brightness)
            await bulb.set_hsv(hue, saturation, bulb.brightness or 100)
            return [types.TextContent(
                type="text",
                text=f"Set color to hue={hue}, saturation={saturation}% on bulb at {ip}"
            )]

        elif name == "kasa_status":
            ip = arguments["ip"]
            bulb = await get_bulb(ip)

            status = f"**{bulb.alias}** ({bulb.model})\n"
            status += f"- Power: {'ON' if bulb.is_on else 'OFF'}\n"
            if bulb.is_on:
                status += f"- Brightness: {bulb.brightness}%\n"
                if hasattr(bulb, 'color_temp') and bulb.color_temp:
                    status += f"- Color Temp: {bulb.color_temp}K\n"
                if hasattr(bulb, 'hsv') and bulb.hsv:
                    h, s, v = bulb.hsv
                    status += f"- HSV: ({h}, {s}%, {v}%)\n"

            return [types.TextContent(type="text", text=status)]

        elif name == "kasa_sunrise":
            ip = arguments["ip"]
            duration = arguments.get("duration_seconds", 60)
            start_temp = arguments.get("start_temp", 2500)
            end_temp = arguments.get("end_temp", 4000)

            bulb = await get_bulb(ip)

            # Turn off first to ensure clean start from darkness
            await bulb.turn_off()
            await asyncio.sleep(0.5)  # Brief pause to ensure state change

            # Start dim and warm
            await bulb.turn_on()
            await bulb.set_brightness(1)
            await bulb.set_color_temp(start_temp)

            steps = min(duration, 100)  # Max 100 steps
            delay = duration / steps
            brightness_step = 99 / steps
            temp_step = (end_temp - start_temp) / steps

            result = f"Starting {duration}s sunrise simulation...\n"
            result += f"- From: 1% brightness, {start_temp}K\n"
            result += f"- To: 100% brightness, {end_temp}K\n"
            result += f"- Steps: {steps}, Interval: {delay:.1f}s\n\n"
            result += "Sunrise in progress! Bulb will gradually brighten."

            # Run sunrise in background (non-blocking)
            async def do_sunrise():
                for i in range(steps):
                    brightness = int(1 + (i + 1) * brightness_step)
                    temp = int(start_temp + (i + 1) * temp_step)
                    try:
                        await bulb.set_brightness(min(brightness, 100))
                        await bulb.set_color_temp(temp)
                    except Exception:
                        pass
                    await asyncio.sleep(delay)

            asyncio.create_task(do_sunrise())

            return [types.TextContent(type="text", text=result)]

        else:
            return [types.TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Error: {str(e)}\n\nMake sure the bulb is set up and on the network."
        )]


async def main():
    from mcp.server.stdio import stdio_server

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="kasa-bulb-controller",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
