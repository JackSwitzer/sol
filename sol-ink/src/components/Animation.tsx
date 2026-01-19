import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

interface AnimationProps {
  width: number;
  height: number;
  autoReturn: boolean;
  onComplete: (cancelled?: boolean) => void;
}

// =============================================================================
// SUN ASCII ART - Pre-padded stages
// =============================================================================

const W0 = 3;
const W1 = 7;
const W2 = 11;
const W3 = 17;
const W4 = 25;

const pad = (s: string, w: number): string => {
  const left = Math.floor((w - s.length) / 2);
  const right = w - s.length - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
};

const SUN_STAGES = [
  [pad('.', W0)],
  [pad('.', W1), pad('(o)', W1), pad('.', W1)],
  [
    pad('\\   /', W2),
    pad('\\ | /', W2),
    pad('--O--', W2),
    pad('/ | \\', W2),
    pad('/   \\', W2),
  ],
  [
    pad('\\    |    /', W3),
    pad('\\   |   /', W3),
    pad('\\  |  /', W3),
    pad('-----O-----', W3),
    pad('/  |  \\', W3),
    pad('/   |   \\', W3),
    pad('/    |    \\', W3),
  ],
  [
    pad('\\      |      /', W4),
    pad('\\     |     /', W4),
    pad('\\    |    /', W4),
    pad('\\   |   /', W4),
    pad('-----------@-----------', W4),
    pad('/   |   \\', W4),
    pad('/    |    \\', W4),
    pad('/     |     \\', W4),
    pad('/      |      \\', W4),
  ],
];

// =============================================================================
// COLOR SYSTEM
// =============================================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

const PALETTE = [
  { t: 0.0, sky: '#030201', sun: '#3a0808', txt: '#2a1010' },
  { t: 0.15, sky: '#050302', sun: '#6a1010', txt: '#4a1818' },
  { t: 0.3, sky: '#0a0504', sun: '#aa3300', txt: '#883311' },
  { t: 0.5, sky: '#120806', sun: '#dd5500', txt: '#cc5522' },
  { t: 0.7, sky: '#1a0c08', sun: '#ff7700', txt: '#ff8844' },
  { t: 0.85, sky: '#22100a', sun: '#ffaa33', txt: '#ffcc66' },
  { t: 1.0, sky: '#2a180e', sun: '#ffdd66', txt: '#ffffff' },
];

function getColors(progress: number): { sky: string; sun: string; txt: string } {
  let lo = PALETTE[0];
  let hi = PALETTE[PALETTE.length - 1];

  for (let i = 0; i < PALETTE.length - 1; i++) {
    if (progress >= PALETTE[i].t && progress <= PALETTE[i + 1].t) {
      lo = PALETTE[i];
      hi = PALETTE[i + 1];
      break;
    }
  }

  const span = hi.t - lo.t;
  const local = span > 0 ? (progress - lo.t) / span : 0;

  return {
    sky: lerpColor(lo.sky, hi.sky, local),
    sun: lerpColor(lo.sun, hi.sun, local),
    txt: lerpColor(lo.txt, hi.txt, local),
  };
}

// =============================================================================
// EASING & CONSTANTS
// =============================================================================

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

const MSG1 = 'Let there be light.';
const MSG2 = 'Welcome to the game.';
const TOTAL_FRAMES = 120;
const FRAME_DELAY = 50;

// =============================================================================
// HELPERS
// =============================================================================

function fillRow(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = width - text.length;
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function Animation({
  width,
  height,
  autoReturn,
  onComplete,
}: AnimationProps): React.ReactElement {
  const { stdout } = useStdout();
  const [frame, setFrame] = useState(0);
  const [escapeCount, setEscapeCount] = useState(0);
  const escapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  // Hide cursor
  useEffect(() => {
    stdout?.write('\x1B[?25l');
  }, [stdout]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
      if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
    };
  }, []);

  // Frame ticker
  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f < TOTAL_FRAMES ? f + 1 : f));
    }, FRAME_DELAY);
    return () => clearInterval(id);
  }, []);

  // Auto-return
  useEffect(() => {
    if (frame >= TOTAL_FRAMES && autoReturn && !completedRef.current) {
      completedRef.current = true;
      autoReturnTimerRef.current = setTimeout(() => onComplete(false), 1200);
    }
  }, [frame, autoReturn, onComplete]);

  // Fill the final row with sky color (handles Ink's trailing newline)
  useEffect(() => {
    if (!stdout) return;
    const progress = Math.min(frame / TOTAL_FRAMES, 1);
    const colors = getColors(progress);
    const [r, g, b] = hexToRgb(colors.sky);
    stdout.write(`\x1B[${height};1H`);
    stdout.write(`\x1B[48;2;${r};${g};${b}m`);
    stdout.write(' '.repeat(width));
    stdout.write('\x1B[H');
  }, [frame, stdout, height, width]);

  // Input handling
  useInput((input, key) => {
    if (completedRef.current) return;

    if (input === 'q' || input === 'Q') {
      completedRef.current = true;
      if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
      onComplete(true);
      return;
    }

    if (key.escape) {
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
      if (escapeCount >= 1) {
        completedRef.current = true;
        if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
        onComplete(true);
      } else {
        setEscapeCount(1);
        escapeTimerRef.current = setTimeout(() => setEscapeCount(0), 1000);
      }
      return;
    }

    if (!autoReturn && frame >= TOTAL_FRAMES) {
      completedRef.current = true;
      onComplete(false);
    }
  });

  // ==========================================================================
  // Animation state
  // ==========================================================================
  const progress = Math.min(frame / TOTAL_FRAMES, 1);
  const easedProgress = easeOutQuart(progress);
  const colors = getColors(progress);

  // Sun stage (0-4)
  const stageIdx = Math.min(Math.floor(progress * 5), 4);
  const sunArt = SUN_STAGES[stageIdx];
  const sunH = sunArt.length;

  // Render height-1 rows (Ink adds trailing newline)
  const renderH = height - 1;

  // Vertical layout
  const horizonRow = Math.floor(renderH * 0.72);
  const sunTopLimit = Math.floor(renderH * 0.18);
  const sunStartY = horizonRow + 2;

  // Sun rises from below horizon
  const sunY = Math.max(
    sunTopLimit,
    Math.floor(sunStartY - (sunStartY - sunTopLimit) * easedProgress)
  );

  // Message positions
  const msgRow1 = Math.floor(renderH * 0.36);
  const msgRow2 = msgRow1 + 3;
  const dateRow = msgRow1 + 6;

  // Show messages as sun rises past them
  const showMsg1 = sunY < msgRow1;
  const showMsg2 = sunY < msgRow2;

  // Date/time
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })}  |  ${now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;

  // ==========================================================================
  // Build frame buffer
  // ==========================================================================
  const rows: React.ReactElement[] = [];

  for (let row = 0; row < renderH; row++) {
    const inSun = row >= sunY && row < sunY + sunH;
    const sunLineIdx = row - sunY;

    let text: string;
    let fg: string;
    let bold = false;
    let dim = false;

    if (inSun && sunLineIdx >= 0 && sunLineIdx < sunArt.length) {
      text = fillRow(sunArt[sunLineIdx], width);
      fg = colors.sun;
      bold = true;
    } else if (row === msgRow1 && showMsg1) {
      text = fillRow(MSG1, width);
      fg = colors.txt;
      bold = true;
    } else if (row === msgRow2 && showMsg2) {
      text = fillRow(MSG2, width);
      fg = colors.txt;
    } else if (row === dateRow && showMsg2) {
      text = fillRow(dateStr, width);
      fg = colors.txt;
      dim = true;
    } else {
      text = ' '.repeat(width);
      fg = colors.sky;
    }

    rows.push(
      <Text
        key={row}
        color={fg}
        backgroundColor={colors.sky}
        bold={bold}
        dimColor={dim}
      >
        {text}
      </Text>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={renderH}>
      {rows}
    </Box>
  );
}
