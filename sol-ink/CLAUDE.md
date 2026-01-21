# Sol-Ink Claude Instructions

## Animation Testing Utility

When testing animation changes, use the render utility instead of interactive terminal:

```bash
# Render key frames (default)
bun run render

# Render specific frame
bun run utils/render-frames.ts --frame 60

# Render frame range
bun run utils/render-frames.ts --range 30-60

# Render all frames and save to utils/frames/
bun run render:all

# Export as JSON (rich metadata)
bun run utils/render-frames.ts --frame 60 --json

# Export as JSONL (streaming-friendly)
bun run utils/render-frames.ts --all --jsonl > frames.jsonl

# Show help with all options
bun run utils/render-frames.ts --help
```

JSON output includes: frame timing, ring visibility array, all color values, dimensions, and ASCII art.

## Project Structure

- `src/components/Animation.tsx` - Main sunrise animation component
- `src/App.tsx` - App shell with alternate screen buffer
- `tools/stage-review.tsx` - Interactive stage review tool
- `utils/render-frames.ts` - Frame rendering utility for testing

## Animation System

The animation has two phases over 180 frames (9 seconds at 50ms/frame):

### Rise Phase (Frames 0-119)
- **Continuous growth**: 11 rings (0-10) fade in progressively
- **Ring types**: Inner rings (0-6) use dot characters (●○•·), outer rings (7-10) use ray characters (─│╱╲)
- **Ring birth timing**: RING_BIRTH_FRAMES = [0, 6, 14, 24, 36, 50, 64, 78, 90, 102, 112]
- **Pulse effect**: Rippling brightness wave through rings every 18 frames
- **Character state machine**: 5 levels (space, ·, •, ○, ●)
- **Color timing**: Deep red stall (0-10%), red (10-50%), orange (50-85%), yellow (85-100%)

### Morph Phase (Frames 120-179)
- Sun particles transform into welcome text
- Line 1: "WELCOME TO THE GAME" (3x5 pixel font)
- Line 2: "JACK"
- Line 3: Time in 7-segment display format (HH:MM)
- Particles spawn from sun center using golden angle distribution
- Ease-out cubic easing for smooth morph animation

## Running the App

```bash
./sol-ink          # Main TUI
./sol-ink stages   # Stage review tool
```
