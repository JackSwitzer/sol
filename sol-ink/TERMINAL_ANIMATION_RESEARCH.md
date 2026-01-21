# Terminal Animation Research: Full-Screen Non-Scrolling Approaches

## Executive Summary

Your current implementation uses Ink with the alternate screen buffer, which is the right foundation. However, Ink's `log-update` mechanism uses `eraseLines()` to clear previous output, which can cause scroll artifacts when the terminal output exceeds screen height. This document explores alternatives and improvements.

---

## 1. Raw ANSI Approach

### ANSI Escape Code Reference

```
ESC = \x1B or \u001B

CURSOR POSITIONING:
  \x1B[H          - Move cursor to home (0,0)
  \x1B[{row};{col}H - Move cursor to row,col (1-indexed)
  \x1B[{n}A       - Move cursor up n lines
  \x1B[{n}B       - Move cursor down n lines
  \x1B[{n}C       - Move cursor forward n columns
  \x1B[{n}D       - Move cursor backward n columns
  \x1B[{col}G     - Move cursor to column (1-indexed)
  \x1B7           - Save cursor position (DEC)
  \x1B8           - Restore cursor position (DEC)
  \x1B[s          - Save cursor position (ANSI)
  \x1B[u          - Restore cursor position (ANSI)

SCREEN CONTROL:
  \x1B[2J         - Clear entire screen
  \x1B[3J         - Clear screen + scrollback buffer
  \x1B[J          - Clear from cursor to end of screen
  \x1B[1J         - Clear from cursor to start of screen
  \x1B[K          - Clear from cursor to end of line
  \x1B[2K         - Clear entire line

SCREEN MODES:
  \x1B[?1049h     - Enter alternate screen buffer (CRITICAL)
  \x1B[?1049l     - Exit alternate screen buffer
  \x1B[?25h       - Show cursor
  \x1B[?25l       - Hide cursor
  \x1B[?7h        - Enable line wrapping
  \x1B[?7l        - Disable line wrapping (prevents scroll!)

SCROLLING CONTROL:
  \x1B[{t};{b}r   - Set scroll region (t=top, b=bottom)
  \x1B[r          - Reset scroll region to full screen

COLORS (24-bit RGB):
  \x1B[38;2;{r};{g};{b}m - Set foreground color
  \x1B[48;2;{r};{g};{b}m - Set background color
  \x1B[0m         - Reset all attributes
```

### Concrete Example: Raw ANSI Full-Screen Animation

```typescript
// raw-animation.ts - Pure ANSI approach without any framework

const ESC = '\x1B';

class RawTerminalAnimation {
  private width: number;
  private height: number;
  private frameBuffer: string[][] = [];
  private running = false;

  constructor() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    this.initBuffer();
  }

  private initBuffer() {
    this.frameBuffer = [];
    for (let y = 0; y < this.height; y++) {
      this.frameBuffer.push(new Array(this.width).fill(' '));
    }
  }

  // Position cursor at specific row/column (1-indexed for ANSI)
  private moveTo(row: number, col: number): string {
    return `${ESC}[${row + 1};${col + 1}H`;
  }

  // Set a character at position
  private setChar(row: number, col: number, char: string) {
    if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
      this.frameBuffer[row][col] = char;
    }
  }

  // Clear buffer with black background
  private clearBuffer() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.frameBuffer[y][x] = ' ';
      }
    }
  }

  // Render entire frame at once (no scrolling)
  private renderFrame(colors: { bg: string; fg: string }) {
    const [bgR, bgG, bgB] = this.hexToRgb(colors.bg);
    const [fgR, fgG, fgB] = this.hexToRgb(colors.fg);

    let output = '';

    // Move to home position first
    output += `${ESC}[H`;

    // Set colors
    output += `${ESC}[48;2;${bgR};${bgG};${bgB}m`; // Background
    output += `${ESC}[38;2;${fgR};${fgG};${fgB}m`; // Foreground

    // Write each row directly - no newlines needed when using cursor positioning
    for (let y = 0; y < this.height; y++) {
      output += this.moveTo(y, 0);
      output += this.frameBuffer[y].join('');
    }

    // Single write - atomic update
    process.stdout.write(output);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  async start() {
    // Enter alternate screen buffer - THIS IS KEY
    process.stdout.write(`${ESC}[?1049h`);  // Alternate screen
    process.stdout.write(`${ESC}[?25l`);     // Hide cursor
    process.stdout.write(`${ESC}[?7l`);      // Disable line wrap (prevents scroll!)
    process.stdout.write(`${ESC}[2J`);       // Clear screen

    this.running = true;
    let frame = 0;

    const animate = () => {
      if (!this.running) return;

      this.clearBuffer();

      // Draw sun rising from bottom
      const sunY = Math.floor(this.height - (frame * 0.5));
      const sunX = Math.floor(this.width / 2);

      // Simple sun shape
      if (sunY >= 0 && sunY < this.height) {
        const sunChars = ['\\', '|', '/'];
        for (let i = -1; i <= 1; i++) {
          this.setChar(sunY, sunX + i, sunChars[i + 1]);
        }
        this.setChar(sunY + 1, sunX, 'O');
      }

      this.renderFrame({ bg: '#000000', fg: '#FFD700' });

      frame++;
      if (frame < 100) {
        setTimeout(animate, 50);
      } else {
        this.stop();
      }
    };

    animate();
  }

  stop() {
    this.running = false;
    process.stdout.write(`${ESC}[?7h`);      // Re-enable line wrap
    process.stdout.write(`${ESC}[?25h`);     // Show cursor
    process.stdout.write(`${ESC}[?1049l`);   // Exit alternate screen
    process.stdout.write(`${ESC}[0m`);       // Reset colors
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  process.stdout.write(`${ESC}[?7h${ESC}[?25h${ESC}[?1049l${ESC}[0m`);
  process.exit(0);
});

const anim = new RawTerminalAnimation();
anim.start();
```

### Key Insight: Why `\x1B[?7l` Matters

The line wrap disable sequence `\x1B[?7l` is CRITICAL. Without it, if any line exceeds terminal width, the terminal will wrap and potentially scroll. With it disabled, excess characters are simply not displayed.

---

## 2. Ink with Manual Control

### How Ink's log-update Works

Looking at `/Users/jackswitzer/Desktop/Lamp/sol-ink/node_modules/ink/build/log-update.js`:

```javascript
// Ink erases previous lines and rewrites
stream.write(ansiEscapes.eraseLines(previousLineCount) + output);
```

This `eraseLines` implementation moves cursor up and clears each line - which CAN cause scroll issues if the output height varies or exceeds screen size.

### Mixing Ink with Raw Terminal Writes

You CAN mix them, but with caveats:

```typescript
// hybrid-approach.tsx
import React, { useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';

function HybridAnimation() {
  const { stdout } = useStdout();

  useEffect(() => {
    // Force cursor home before each Ink render cycle
    // This prevents drift that leads to scrolling
    const interval = setInterval(() => {
      stdout?.write('\x1B[H');
    }, 16); // 60fps cursor reset

    return () => clearInterval(interval);
  }, [stdout]);

  // ... rest of component
}
```

### Potential Conflicts

1. **Cursor position battles**: Ink tracks cursor position internally; raw writes confuse it
2. **Output buffer conflicts**: Ink may erase content you've written
3. **Timing issues**: Raw writes during Ink's render cycle can cause flicker

### Better Hybrid: Pre-render Hook

```typescript
// Use Ink's useEffect to inject ANSI before render
useEffect(() => {
  // Ensure we're always at the top before Ink renders
  stdout?.write('\x1B[H');
}, [frame]); // Run on every frame update
```

---

## 3. Other Node.js Terminal Libraries

### blessed / neo-blessed

**Pros:**
- Full-featured TUI library
- Built-in screen abstraction with "blessed.screen()" that manages the buffer
- Handles resize, mouse events, scrolling regions
- No scrolling artifacts - uses direct cursor positioning

**Cons:**
- Heavy dependency (~500KB)
- Different paradigm from React
- Older, less maintained (neo-blessed is a fork)

```typescript
// blessed-animation.ts
import blessed from 'blessed';

const screen = blessed.screen({
  smartCSR: true,       // Only redraw changed regions
  fullUnicode: true,
  title: 'Sol Sunrise'
});

const sun = blessed.box({
  parent: screen,
  top: 'center',
  left: 'center',
  width: 11,
  height: 5,
  content: ' \\ | / \n--O--\n / | \\ ',
  style: {
    fg: 'yellow',
    bg: 'black'
  }
});

let frame = 0;
setInterval(() => {
  const y = Math.floor(screen.height - frame * 0.5);
  sun.top = y;
  screen.render(); // blessed handles the diff
  frame++;
}, 50);

screen.key(['escape', 'q', 'C-c'], () => process.exit(0));
```

### terminal-kit

**Pros:**
- Modern, well-maintained
- Has ScreenBuffer class for off-screen rendering
- Delta updates (only writes changed cells)
- Good TypeScript support

**Cons:**
- Different API from React
- ~200KB

```typescript
// terminal-kit-animation.ts
import term from 'terminal-kit';

const terminal = term.terminal;

terminal.fullscreen(true);
terminal.hideCursor();

// Create an off-screen buffer
const screenBuffer = new term.ScreenBuffer({
  dst: terminal,
  width: terminal.width,
  height: terminal.height
});

function animate(frame: number) {
  // Clear buffer
  screenBuffer.fill({ char: ' ', attr: { bgColor: 'black' } });

  // Draw sun
  const sunY = Math.floor(screenBuffer.height - frame * 0.5);
  screenBuffer.put({
    x: Math.floor(screenBuffer.width / 2) - 2,
    y: sunY,
    attr: { color: 'yellow', bgColor: 'black' }
  }, '--O--');

  // Draw to terminal (only changed cells)
  screenBuffer.draw({ delta: true });

  if (frame < 100) {
    setTimeout(() => animate(frame + 1), 50);
  } else {
    terminal.fullscreen(false);
    terminal.showCursor();
    process.exit(0);
  }
}

animate(0);
```

### ansi-escapes Package

**What it is:** A collection of ANSI escape code helpers (you already have it via Ink)

**Best use:** As building blocks, not a full solution

```typescript
import ansiEscapes from 'ansi-escapes';

// Position cursor
process.stdout.write(ansiEscapes.cursorTo(10, 5)); // x=10, y=5

// Alternative screen
process.stdout.write(ansiEscapes.enterAlternativeScreen);

// Hide cursor
process.stdout.write(ansiEscapes.cursorHide);
```

### Recommendation for Your Use Case

**terminal-kit** would be the best alternative if you want to move away from Ink. Its `ScreenBuffer` with delta updates is ideal for animation. However, you'd lose the React-based approach.

For staying with Ink, the **patch approach** (below) is better.

---

## 4. The "Patch" Approach - Differential Rendering

This is the most sophisticated approach and what professional TUI apps use (vim, htop, etc.).

### Core Concept

1. Maintain two buffers: `previousFrame` and `currentFrame`
2. Compare them cell-by-cell
3. Only write ANSI sequences to update changed cells

### Implementation

```typescript
// diff-renderer.ts

interface Cell {
  char: string;
  fg: string;  // RGB hex
  bg: string;  // RGB hex
}

class DiffRenderer {
  private width: number;
  private height: number;
  private currentBuffer: Cell[][];
  private previousBuffer: Cell[][];
  private defaultCell: Cell = { char: ' ', fg: '#FFFFFF', bg: '#000000' };

  constructor() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    this.currentBuffer = this.createBuffer();
    this.previousBuffer = this.createBuffer();
  }

  private createBuffer(): Cell[][] {
    const buffer: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      buffer.push([]);
      for (let x = 0; x < this.width; x++) {
        buffer[y].push({ ...this.defaultCell });
      }
    }
    return buffer;
  }

  // Set a cell in the current buffer
  setCell(x: number, y: number, char: string, fg: string, bg: string) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.currentBuffer[y][x] = { char, fg, bg };
    }
  }

  // Clear current buffer
  clear(bg = '#000000') {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.currentBuffer[y][x] = { char: ' ', fg: '#FFFFFF', bg };
      }
    }
  }

  // Draw text at position
  drawText(x: number, y: number, text: string, fg: string, bg: string) {
    for (let i = 0; i < text.length && x + i < this.width; i++) {
      this.setCell(x + i, y, text[i], fg, bg);
    }
  }

  // Render only the differences
  render() {
    let output = '';
    let lastX = -1;
    let lastY = -1;
    let lastFg = '';
    let lastBg = '';

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const curr = this.currentBuffer[y][x];
        const prev = this.previousBuffer[y][x];

        // Skip unchanged cells
        if (curr.char === prev.char && curr.fg === prev.fg && curr.bg === prev.bg) {
          continue;
        }

        // Move cursor if not sequential
        if (y !== lastY || x !== lastX + 1) {
          output += `\x1B[${y + 1};${x + 1}H`;
        }

        // Change colors only if different
        if (curr.fg !== lastFg) {
          const [r, g, b] = this.hexToRgb(curr.fg);
          output += `\x1B[38;2;${r};${g};${b}m`;
          lastFg = curr.fg;
        }
        if (curr.bg !== lastBg) {
          const [r, g, b] = this.hexToRgb(curr.bg);
          output += `\x1B[48;2;${r};${g};${b}m`;
          lastBg = curr.bg;
        }

        output += curr.char;
        lastX = x;
        lastY = y;

        // Update previous buffer
        this.previousBuffer[y][x] = { ...curr };
      }
    }

    // Single write - no scrolling possible
    if (output) {
      process.stdout.write(output);
    }
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  // Force full redraw (for initial render or resize)
  forceFullRedraw() {
    // Mark all previous cells as different
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.previousBuffer[y][x] = { char: '\0', fg: '', bg: '' };
      }
    }
    this.render();
  }
}

// Usage example
async function animateSunrise() {
  const renderer = new DiffRenderer();

  // Setup
  process.stdout.write('\x1B[?1049h');  // Alternate screen
  process.stdout.write('\x1B[?25l');     // Hide cursor
  process.stdout.write('\x1B[?7l');      // Disable line wrap

  const sunArt = [
    '\\  |  /',
    ' \\ | / ',
    '---O---',
    ' / | \\ ',
    '/  |  \\'
  ];

  const height = process.stdout.rows || 24;
  const width = process.stdout.columns || 80;

  for (let frame = 0; frame < 120; frame++) {
    renderer.clear('#000000');

    const progress = frame / 120;
    const sunY = Math.floor(height - 5 - (height * 0.7) * progress);
    const sunX = Math.floor(width / 2) - 4;

    // Interpolate sun color
    const intensity = Math.floor(100 + 155 * progress);
    const sunColor = `#FF${intensity.toString(16).padStart(2, '0')}00`;

    // Draw sun
    for (let i = 0; i < sunArt.length; i++) {
      if (sunY + i >= 0 && sunY + i < height) {
        renderer.drawText(sunX, sunY + i, sunArt[i], sunColor, '#000000');
      }
    }

    renderer.render();
    await new Promise(r => setTimeout(r, 50));
  }

  // Cleanup
  process.stdout.write('\x1B[?7h');      // Re-enable line wrap
  process.stdout.write('\x1B[?25h');     // Show cursor
  process.stdout.write('\x1B[?1049l');   // Exit alternate screen
  process.stdout.write('\x1B[0m');       // Reset colors
}

animateSunrise();
```

### Why This Approach Prevents Scrolling

1. **No newlines written**: We position cursor explicitly for each cell
2. **Line wrap disabled**: Even if we write to the last column, no wrap occurs
3. **Atomic writes**: The entire diff is one `process.stdout.write()` call
4. **Cursor never reaches bottom**: We never write sequentially to the last row

---

## 5. Fixing Your Current Ink Implementation

Given your current code, here are specific fixes:

### Problem Analysis

Your `Animation.tsx` writes `\x1B[H` before each frame, which helps, but Ink's internal log-update still:
1. Tracks line counts
2. Uses `eraseLines()` which can scroll
3. Adds newlines between renders

### Fix 1: Disable Line Wrapping in index.tsx

```typescript
// In index.tsx, add this before render()
process.stdout.write('\x1B[?7l'); // Disable line wrap

// In cleanup(), add:
process.stdout.write('\x1B[?7h'); // Re-enable line wrap
```

### Fix 2: Lock Scroll Region

```typescript
// At animation start, lock scroll region to prevent any scrolling
const height = process.stdout.rows || 24;
stdout?.write(`\x1B[1;${height}r`); // Set scroll region to full screen
stdout?.write('\x1B[H');            // Move to home

// This prevents the terminal from scrolling even if content overflows
```

### Fix 3: Force Exact Height

Your current code uses `height - 1` which is correct for Ink's quirks. But also ensure:

```typescript
// In Animation.tsx render, force the container to exact size
return (
  <Box
    flexDirection="column"
    width={width}
    height={height - 1}
    overflow="hidden"  // Clip any overflow
  >
    {/* Render exactly height-2 rows of content */}
  </Box>
);
```

### Fix 4: Pre-frame Reset

```typescript
useEffect(() => {
  // Before each frame, reset cursor AND clear to prevent artifacts
  stdout?.write('\x1B[H');           // Home
  stdout?.write('\x1B[48;2;0;0;0m'); // Black background
}, [frame, stdout]);
```

---

## 6. Complete Working Example: Smooth Full-Screen Animation

```typescript
// smooth-animation.ts - Production-ready approach

const ESC = '\x1B';

interface TerminalAnimation {
  width: number;
  height: number;
  buffer: string[][];
  running: boolean;
}

function createAnimation(): TerminalAnimation {
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;

  // Initialize buffer with spaces
  const buffer: string[][] = [];
  for (let y = 0; y < height; y++) {
    buffer.push(new Array(width).fill(' '));
  }

  return { width, height, buffer, running: false };
}

function setup() {
  process.stdout.write(`${ESC}[?1049h`);  // Alternate screen buffer
  process.stdout.write(`${ESC}[?25l`);     // Hide cursor
  process.stdout.write(`${ESC}[?7l`);      // Disable line wrapping
  process.stdout.write(`${ESC}[2J`);       // Clear screen
  process.stdout.write(`${ESC}[48;2;0;0;0m`); // Black background
  process.stdout.write(`${ESC}[H`);        // Home position

  // Fill screen with black
  const rows = process.stdout.rows || 24;
  const cols = process.stdout.columns || 80;
  for (let i = 0; i < rows; i++) {
    process.stdout.write(' '.repeat(cols));
  }
}

function cleanup() {
  process.stdout.write(`${ESC}[?7h`);      // Re-enable line wrapping
  process.stdout.write(`${ESC}[?25h`);     // Show cursor
  process.stdout.write(`${ESC}[?1049l`);   // Exit alternate screen
  process.stdout.write(`${ESC}[0m`);       // Reset all attributes
}

function renderFrame(state: TerminalAnimation, sunY: number, colors: { sun: string; bg: string }) {
  const { width, height, buffer } = state;

  // Clear buffer
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buffer[y][x] = ' ';
    }
  }

  // Draw sun (simple version)
  const sunArt = [
    '\\  |  /',
    ' \\ | / ',
    '---@---',
    ' / | \\ ',
    '/  |  \\'
  ];

  const sunX = Math.floor(width / 2) - 4;
  for (let i = 0; i < sunArt.length; i++) {
    const y = sunY + i;
    if (y >= 0 && y < height) {
      const line = sunArt[i];
      for (let j = 0; j < line.length; j++) {
        const x = sunX + j;
        if (x >= 0 && x < width) {
          buffer[y][x] = line[j];
        }
      }
    }
  }

  // Build output string
  let output = '';
  output += `${ESC}[H`;  // Home position

  // Background color
  const [bgR, bgG, bgB] = hexToRgb(colors.bg);
  output += `${ESC}[48;2;${bgR};${bgG};${bgB}m`;

  // Sun color
  const [sunR, sunG, sunB] = hexToRgb(colors.sun);
  output += `${ESC}[38;2;${sunR};${sunG};${sunB}m`;

  // Write buffer - NO newlines, use cursor positioning
  for (let y = 0; y < height; y++) {
    output += `${ESC}[${y + 1};1H`;  // Position at start of row
    output += buffer[y].join('');
  }

  // Atomic write
  process.stdout.write(output);
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});

// Main animation loop
async function main() {
  const state = createAnimation();
  setup();

  const totalFrames = 120;
  const frameDelay = 50;

  for (let frame = 0; frame <= totalFrames; frame++) {
    const progress = frame / totalFrames;

    // Eased rise
    const eased = 1 - Math.pow(1 - progress, 4);

    // Sun position (rises from bottom to top)
    const startY = state.height - 3;
    const endY = Math.floor(state.height * 0.2);
    const sunY = Math.floor(startY - (startY - endY) * eased);

    // Color interpolation
    const intensity = Math.floor(50 + 205 * progress);
    const sunColor = `#FF${intensity.toString(16).padStart(2, '0')}${Math.floor(intensity * 0.4).toString(16).padStart(2, '0')}`;
    const bgColor = `#${Math.floor(5 + 15 * progress).toString(16).padStart(2, '0')}${Math.floor(2 + 8 * progress).toString(16).padStart(2, '0')}${Math.floor(2 + 6 * progress).toString(16).padStart(2, '0')}`;

    renderFrame(state, sunY, { sun: sunColor, bg: bgColor });

    await new Promise(r => setTimeout(r, frameDelay));
  }

  // Hold final frame
  await new Promise(r => setTimeout(r, 2000));

  cleanup();
}

main().catch(err => {
  cleanup();
  console.error(err);
  process.exit(1);
});
```

---

## Summary: Recommendations for sol-ink

### For Quick Fix (Stay with Ink)
1. Add `\x1B[?7l` to disable line wrap in `index.tsx`
2. Ensure exact `height - 1` on all containers
3. Keep your `\x1B[H` cursor reset before each frame
4. Add `overflow="hidden"` to the animation Box

### For Better Solution (Hybrid)
1. Keep Ink for the settings menu (React is nice for forms)
2. Use raw ANSI approach for the animation only
3. When entering animation mode, switch from Ink to raw rendering

### For Best Solution (If Willing to Refactor)
1. Use the differential renderer approach
2. Build a buffer abstraction that can be used by both menu and animation
3. Only write changed cells to the terminal

The key principles that prevent scrolling:
1. **Always use alternate screen buffer** (`\x1B[?1049h`)
2. **Disable line wrapping** (`\x1B[?7l`)
3. **Use cursor positioning, not newlines** (`\x1B[{row};{col}H`)
4. **Write atomically** (single `process.stdout.write()` call)
5. **Never write to the last line last column** (or wrap is triggered)
