import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

interface AnimationProps {
  width: number;
  height: number;
  autoReturn: boolean;
  onComplete: (cancelled?: boolean) => void;
}

// Sun stages using ASCII only for consistent character widths
// Each line in a stage is padded to exactly the same length
const W0 = 3, W1 = 7, W2 = 11, W3 = 17, W4 = 25;
const pad = (s: string, w: number) => {
  const left = Math.floor((w - s.length) / 2);
  const right = w - s.length - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
};

const SUN_STAGES = [
  // Stage 0: First light - tiny dot
  [pad('.', W0)],

  // Stage 1: Emerging - small circle
  [
    pad('.', W1),
    pad('(o)', W1),
    pad('.', W1),
  ],

  // Stage 2: Rising - with small rays
  [
    pad('\\   /', W2),
    pad('\\ | /', W2),
    pad('--O--', W2),
    pad('/ | \\', W2),
    pad('/   \\', W2),
  ],

  // Stage 3: Growing - larger sun
  [
    pad('\\    |    /', W3),
    pad('\\   |   /', W3),
    pad('\\  |  /', W3),
    pad('-----O-----', W3),
    pad('/  |  \\', W3),
    pad('/   |   \\', W3),
    pad('/    |    \\', W3),
  ],

  // Stage 4: Full radiant sun - final size
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

// Smooth color interpolation helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function lerpColor(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

// Color keyframes for smooth interpolation
const COLOR_KEYFRAMES = [
  { at: 0.00, sun: '#4a0a0a', border: '#2a1508', sky: '#050302', text: '#3a1515' },
  { at: 0.20, sun: '#8B0000', border: '#3a1a08', sky: '#0a0504', text: '#5a2020' },
  { at: 0.40, sun: '#CC4400', border: '#5a3010', sky: '#120806', text: '#AA4422' },
  { at: 0.60, sun: '#FF6600', border: '#7a4818', sky: '#1a0c08', text: '#DD7733' },
  { at: 0.75, sun: '#FFA020', border: '#906020', sky: '#22100a', text: '#FFAA44' },
  { at: 0.90, sun: '#FFD060', border: '#AA8030', sky: '#2a180c', text: '#FFDD88' },
  { at: 1.00, sun: '#FFE888', border: '#CCAA44', sky: '#32200e', text: '#FFFFFF' },
];

function getInterpolatedColors(progress: number) {
  // Find the two keyframes to interpolate between
  let lower = COLOR_KEYFRAMES[0];
  let upper = COLOR_KEYFRAMES[COLOR_KEYFRAMES.length - 1];

  for (let i = 0; i < COLOR_KEYFRAMES.length - 1; i++) {
    if (progress >= COLOR_KEYFRAMES[i].at && progress <= COLOR_KEYFRAMES[i + 1].at) {
      lower = COLOR_KEYFRAMES[i];
      upper = COLOR_KEYFRAMES[i + 1];
      break;
    }
  }

  // Calculate local progress between keyframes
  const range = upper.at - lower.at;
  const localProgress = range > 0 ? (progress - lower.at) / range : 0;

  return {
    sun: lerpColor(lower.sun, upper.sun, localProgress),
    border: lerpColor(lower.border, upper.border, localProgress),
    sky: lerpColor(lower.sky, upper.sky, localProgress),
    text: lerpColor(lower.text, upper.text, localProgress),
  };
}

// Smooth easing functions
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Messages
const MSG1 = 'Let there be light.';
const MSG2 = 'Welcome to the game.';

export default function Animation({ width, height, autoReturn, onComplete }: AnimationProps) {
  const { stdout } = useStdout();
  const [frame, setFrame] = useState(0);
  const [escapeCount, setEscapeCount] = useState(0);
  const escapeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoReturnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  const TOTAL_FRAMES = 120;  // More frames for smoother motion
  const FRAME_DELAY = 50;    // Faster updates for fluidity

  // Hide cursor and ensure clean screen on animation start
  useEffect(() => {
    // Ensure cursor is hidden during animation
    stdout?.write('\x1B[?25l');
  }, [stdout]);

  // Force cursor to home position before each frame render
  // This prevents ghosting artifacts by ensuring consistent render position
  useEffect(() => {
    stdout?.write('\x1B[H');
  }, [frame, stdout]);

  // Cleanup all timers on unmount to prevent memory leaks and state updates on unmounted component
  useEffect(() => {
    return () => {
      if (escapeTimerRef.current) {
        clearTimeout(escapeTimerRef.current);
        escapeTimerRef.current = null;
      }
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
        autoReturnTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev >= TOTAL_FRAMES ? prev : prev + 1));
    }, FRAME_DELAY);
    return () => clearInterval(timer);
  }, []);

  // Auto-return after animation completes
  useEffect(() => {
    if (frame >= TOTAL_FRAMES && autoReturn && !completedRef.current) {
      completedRef.current = true;
      autoReturnTimerRef.current = setTimeout(() => {
        // Double-check we haven't been cleaned up
        if (autoReturnTimerRef.current !== null) {
          onComplete(false); // completed normally, not cancelled
        }
      }, 1200);
    }
  }, [frame, autoReturn, onComplete]);

  useInput((input, key) => {
    if (completedRef.current) return;

    if (input === 'q' || input === 'Q') {
      completedRef.current = true;
      // Clear auto-return timer if it was set
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
        autoReturnTimerRef.current = null;
      }
      onComplete(true); // cancelled=true
      return;
    }

    if (key.escape) {
      if (escapeTimerRef.current) {
        clearTimeout(escapeTimerRef.current);
        escapeTimerRef.current = null;
      }
      if (escapeCount >= 1) {
        completedRef.current = true;
        // Clear auto-return timer if it was set
        if (autoReturnTimerRef.current) {
          clearTimeout(autoReturnTimerRef.current);
          autoReturnTimerRef.current = null;
        }
        onComplete(true); // cancelled=true
      } else {
        setEscapeCount(1);
        escapeTimerRef.current = setTimeout(() => {
          escapeTimerRef.current = null;
          setEscapeCount(0);
        }, 1000);
      }
      return;
    }

    if (!autoReturn && frame >= TOTAL_FRAMES) {
      completedRef.current = true;
      onComplete(false); // completed normally
    }
  });

  const progress = Math.min(frame / TOTAL_FRAMES, 1);

  // Cinematic eased rise - starts very slow, accelerates, then gentle finish
  const riseProgress = easeOutQuart(progress);

  // Calculate sun position - ensure it stays within the bordered area
  const horizonY = Math.floor(height * 0.72);
  const sunTopEnd = Math.floor(height * 0.20); // Don't let sun go too high
  const sunBottomStart = horizonY + 3;
  // Clamp sunY to stay within content area (min 1, after top border)
  const rawSunY = Math.floor(sunBottomStart - (sunBottomStart - sunTopEnd) * riseProgress);
  const sunY = Math.max(1, rawSunY);

  // Sun stage transitions - reaches full size at 80% progress, stays full for last 20%
  const sunStageIndex = Math.min(Math.floor(progress * 5), 4);
  const sunArt = SUN_STAGES[sunStageIndex];
  const sunHeight = sunArt.length;

  // Smooth color interpolation
  const colors = getInterpolatedColors(progress);

  // Message reveal based on sun position crossing thresholds
  const messageY = Math.floor(height * 0.38);
  const showMessage1 = sunY < messageY - 1;
  const showMessage2 = sunY < messageY + 2;

  // Date/time display
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}  ·  ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  // Build the scene - TRUE full screen, no borders, fill every pixel
  const lines: React.ReactNode[] = [];

  // Fill every row from 0 to height-1 with sky background
  for (let row = 0; row < height - 1; row++) {
    const isSunRow = row >= sunY && row < sunY + sunHeight;
    const sunRowIndex = row - sunY;
    const isMessage1Row = row === messageY - 1;
    const isMessage2Row = row === messageY + 2;
    const isDateRow = row === messageY + 5;
    const isHorizonRow = row === horizonY;

    // Build the full-width row content
    let rowContent: string;
    let rowColor = colors.sky; // default sky color for text
    let isBold = false;
    let isItalic = false;
    let isDim = false;

    if (isSunRow && sunRowIndex >= 0 && sunRowIndex < sunHeight) {
      // Sun row - center the sun art in the full width
      const sunLine = sunArt[sunRowIndex];
      const totalPad = width - sunLine.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      rowContent = ' '.repeat(leftPad) + sunLine + ' '.repeat(rightPad);
      rowColor = colors.sun;
      isBold = true;
    } else if (isMessage1Row && showMessage1) {
      const totalPad = width - MSG1.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      rowContent = ' '.repeat(leftPad) + MSG1 + ' '.repeat(rightPad);
      rowColor = colors.text;
      isBold = true;
    } else if (isMessage2Row && showMessage2) {
      const totalPad = width - MSG2.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      rowContent = ' '.repeat(leftPad) + MSG2 + ' '.repeat(rightPad);
      rowColor = colors.text;
      isItalic = true;
    } else if (isDateRow && showMessage2) {
      const totalPad = width - dateStr.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      rowContent = ' '.repeat(leftPad) + dateStr + ' '.repeat(rightPad);
      rowColor = colors.text;
      isDim = true;
    } else if (isHorizonRow) {
      // Horizon line spans full width
      const horizonChar = progress > 0.4 ? '─' : progress > 0.2 ? '·' : ' ';
      rowContent = horizonChar.repeat(width);
      rowColor = colors.sun;
      isDim = true;
    } else {
      // Empty sky - full width of spaces
      rowContent = ' '.repeat(width);
    }

    lines.push(
      <Box key={`row-${row}`} width={width}>
        <Text
          color={rowColor}
          backgroundColor={colors.sky}
          bold={isBold}
          italic={isItalic}
          dimColor={isDim}
        >
          {rowContent}
        </Text>
      </Box>
    );
  }

  // Use height - 1 to prevent scroll flicker (known Ink issue)
  return (
    <Box flexDirection="column" width={width} height={height - 1}>
      {lines}
    </Box>
  );
}
