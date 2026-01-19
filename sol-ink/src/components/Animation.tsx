import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

interface AnimationProps {
  width: number;
  height: number;
  autoReturn: boolean;
  onComplete: () => void;
}

// Perfectly symmetric sun stages - each line same width for clean rendering
const SUN_STAGES = [
  // Stage 0: First light - minimal, ethereal
  [
    '    ·    ',
    '  · ◯ ·  ',
    '    ·    ',
  ],
  // Stage 1: Emerging - small rays
  [
    '   \\│/   ',
    '  ──◉──  ',
    '   /│\\   ',
  ],
  // Stage 2: Rising - growing presence
  [
    '  \\ │ /  ',
    '   \\│/   ',
    ' ───☀─── ',
    '   /│\\   ',
    '  / │ \\  ',
  ],
  // Stage 3: Radiant - full glory
  [
    '    │    ',
    ' \\  │  / ',
    '  \\ │ /  ',
    '────☀────',
    '  / │ \\  ',
    ' /  │  \\ ',
    '    │    ',
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
  const [frame, setFrame] = useState(0);
  const [escapeCount, setEscapeCount] = useState(0);
  const escapeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  const TOTAL_FRAMES = 120;  // More frames for smoother motion
  const FRAME_DELAY = 50;    // Faster updates for fluidity

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
      const timeout = setTimeout(onComplete, 1200);
      return () => clearTimeout(timeout);
    }
  }, [frame, autoReturn, onComplete]);

  useInput((input, key) => {
    if (completedRef.current) return;

    if (input === 'q' || input === 'Q') {
      completedRef.current = true;
      onComplete();
      return;
    }

    if (key.escape) {
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
      if (escapeCount >= 1) {
        completedRef.current = true;
        onComplete();
      } else {
        setEscapeCount(1);
        escapeTimerRef.current = setTimeout(() => setEscapeCount(0), 1000);
      }
      return;
    }

    if (!autoReturn && frame >= TOTAL_FRAMES) {
      completedRef.current = true;
      onComplete();
    }
  });

  const progress = Math.min(frame / TOTAL_FRAMES, 1);

  // Cinematic eased rise - starts very slow, accelerates, then gentle finish
  const riseProgress = easeOutQuart(progress);

  // Calculate sun position
  const horizonY = Math.floor(height * 0.72);
  const sunTopEnd = Math.floor(height * 0.18);
  const sunBottomStart = horizonY + 3;
  const sunY = Math.floor(sunBottomStart - (sunBottomStart - sunTopEnd) * riseProgress);

  // Sun stage transitions (with slight overlap for smoothness)
  const sunStageIndex = Math.min(Math.floor(progress * 3.5), 3);
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

  // Build the scene
  const lines: React.ReactNode[] = [];
  const innerWidth = width - 2;

  // Top border
  lines.push(
    <Box key="top">
      <Text color={colors.border}>╭{'─'.repeat(innerWidth)}╮</Text>
    </Box>
  );

  for (let row = 1; row < height - 3; row++) {
    const isSunRow = row >= sunY && row < sunY + sunHeight;
    const sunRowIndex = row - sunY;
    const isMessage1Row = row === messageY - 1;
    const isMessage2Row = row === messageY + 2;
    const isDateRow = row === messageY + 5;
    const isHorizonRow = row === horizonY;

    let content: React.ReactNode;

    if (isSunRow && sunRowIndex >= 0 && sunRowIndex < sunHeight) {
      // Sun row - perfectly centered
      const sunLine = sunArt[sunRowIndex];
      const totalPad = innerWidth - sunLine.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;

      content = (
        <>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.sun} backgroundColor={colors.sky} bold>{sunLine}</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
        </>
      );
    } else if (isMessage1Row && showMessage1) {
      const totalPad = innerWidth - MSG1.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;

      content = (
        <>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} bold>{MSG1}</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
        </>
      );
    } else if (isMessage2Row && showMessage2) {
      const totalPad = innerWidth - MSG2.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;

      content = (
        <>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} italic>{MSG2}</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
        </>
      );
    } else if (isDateRow && showMessage2) {
      const totalPad = innerWidth - dateStr.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;

      content = (
        <>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} dimColor>{dateStr}</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
        </>
      );
    } else if (isHorizonRow) {
      // Horizon line that brightens with progress
      const horizonChar = progress > 0.4 ? '─' : progress > 0.2 ? '·' : ' ';
      content = (
        <Text color={colors.sun} backgroundColor={colors.sky} dimColor>
          {horizonChar.repeat(innerWidth)}
        </Text>
      );
    } else {
      // Empty sky
      content = <Text backgroundColor={colors.sky}>{' '.repeat(innerWidth)}</Text>;
    }

    lines.push(
      <Box key={`row-${row}`}>
        <Text color={colors.border}>│</Text>
        {content}
        <Text color={colors.border}>│</Text>
      </Box>
    );
  }

  // Bottom border
  lines.push(
    <Box key="bottom">
      <Text color={colors.border}>╰{'─'.repeat(innerWidth)}╯</Text>
    </Box>
  );

  // Hint text
  const hint = autoReturn
    ? (frame >= TOTAL_FRAMES ? '·' : '')
    : (frame >= TOTAL_FRAMES ? 'Press any key' : '');

  if (hint) {
    lines.push(
      <Box key="hint" justifyContent="center" marginTop={1}>
        <Text color="#444">{hint}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {lines}
    </Box>
  );
}
