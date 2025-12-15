#!/usr/bin/env python3
"""Fun 35-second light show demo - quick ramp, weird pulsing, settle."""

import asyncio
from kasa import Discover, Device, Module

DEFAULT_BULB_IP = "192.168.1.77"


async def run_demo(ip: str = DEFAULT_BULB_IP):
    """Fun demo: quick ramp → weird pulsing → optimal wake light → off."""
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
    for i in range(5):
        brightness = int(100 - (20 * (4 - i) / 4))
        await light.set_brightness(brightness)
        await light.set_color_temp(4000)
        await asyncio.sleep(0.5)

    await light.set_brightness(100)
    await light.set_color_temp(4000)
    await asyncio.sleep(2)
    await bulb.turn_off()

    print()
    print("Demo complete! Light off.")


if __name__ == "__main__":
    import sys
    ip = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BULB_IP
    asyncio.run(run_demo(ip))
