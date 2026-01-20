import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import {
  Point, CharLevel, CHARS, RING_DEFS, ANIM, Colors, ThemeKey,
  hexToRgb, getColors, getRingVisibility, getPulseIntensity,
  getRingChar, getRingColor, getRayChar, buildSunForFrame,
  textToPointsBold, timeToSegmentPoints, easeOutQuad, easeOutCubic,
} from '../animation-core';

interface AnimationProps {
  width: number;
  height: number;
  autoReturn: boolean;
  onComplete: (cancelled?: boolean) => void;
  theme?: ThemeKey;
}

// =============================================================================
// TEXT MORPHING
// =============================================================================

interface MorphTarget {
  point: Point;
  char: string;
}

function getSunPoints(frame: number, centerRow: number, centerCol: number): { point: Point; level: CharLevel }[] {
  const points: { point: Point; level: CharLevel }[] = [];
  for (let ringIdx = 0; ringIdx <= ANIM.MAX_RING; ringIdx++) {
    const visibility = getRingVisibility(ringIdx, Math.min(frame, ANIM.RISE_FRAMES));
    if (visibility === 0) continue;
    const baseLevel = RING_DEFS[ringIdx].baseLevel;
    const pulseIntensity = getPulseIntensity(ringIdx, frame);
    const pulseBoost = Math.round(pulseIntensity * 2);
    const fadeReduction = Math.round((1 - visibility) * 2);
    const level = Math.max(1, Math.min(4, baseLevel + pulseBoost - fadeReduction)) as CharLevel;
    for (const [dr, dc] of RING_DEFS[ringIdx].points) {
      points.push({ point: [centerRow + dr, centerCol + dc], level });
    }
  }
  return points;
}

function getMorphedPoints(
  frame: number,
  sunCenter: [number, number],
  targets: MorphTarget[]
): { point: Point; char: string; level: CharLevel }[] {
  const sunPoints = getSunPoints(ANIM.RISE_FRAMES, sunCenter[0], sunCenter[1]);
  const eased = easeOutCubic(Math.min(1, (frame - ANIM.MORPH_START) / ANIM.MORPH_FRAMES));
  const result: { point: Point; char: string; level: CharLevel }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    let srcRow: number, srcCol: number, level: CharLevel;

    if (i < sunPoints.length) {
      srcRow = sunPoints[i].point[0];
      srcCol = sunPoints[i].point[1];
      level = sunPoints[i].level;
    } else {
      const angle = (i * 137.508) * (Math.PI / 180);
      const dist = ((i * 7) % 7) + 1;
      srcRow = sunCenter[0] + Math.round(Math.sin(angle) * dist);
      srcCol = sunCenter[1] + Math.round(Math.cos(angle) * dist);
      level = 3 as CharLevel;
    }

    const newRow = Math.round(srcRow + (target.point[0] - srcRow) * eased);
    const newCol = Math.round(srcCol + (target.point[1] - srcCol) * eased);
    const char = eased > 0.8 ? target.char : '●';

    result.push({ point: [newRow, newCol], char, level });
  }
  return result;
}

// =============================================================================
// HELPERS
// =============================================================================

function fillRow(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = width - text.length;
  return ' '.repeat(Math.floor(pad / 2)) + text + ' '.repeat(pad - Math.floor(pad / 2));
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function Animation({
  width,
  height,
  autoReturn,
  onComplete,
  theme = 'blood_red',
}: AnimationProps): React.ReactElement {
  const { stdout } = useStdout();
  const [frame, setFrame] = useState(0);
  const [escapeCount, setEscapeCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const escapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => { stdout?.write('\x1B[?25l'); }, [stdout]);

  useEffect(() => {
    return () => {
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
      if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f < ANIM.TOTAL_FRAMES ? f + 1 : f));
    }, ANIM.FRAME_DELAY_MS);
    return () => clearInterval(id);
  }, []);

  // Live clock update after animation completes
  useEffect(() => {
    if (frame < ANIM.TOTAL_FRAMES) return;

    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };

    // Update immediately and then every second
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, [frame >= ANIM.TOTAL_FRAMES]);

  useEffect(() => {
    if (frame >= ANIM.TOTAL_FRAMES && autoReturn && !completedRef.current) {
      // Preview mode: auto-return after delay
      completedRef.current = true;
      autoReturnTimerRef.current = setTimeout(() => onComplete(false), 1200);
    }
    // Alarm mode (autoReturn=false): stay on screen until user interaction
  }, [frame, autoReturn, onComplete]);

  // Background color effect - always black
  useEffect(() => {
    if (!stdout) return;
    // Constant black background
    stdout.write(`\x1B[${height};1H\x1B[48;2;0;0;0m${' '.repeat(width)}\x1B[H`);
  }, [frame, stdout, height, width]);

  useInput((input, key) => {
    if (completedRef.current) return;

    // Cancel animation with Q or double-escape
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

    // Alarm mode: any key dismisses after animation completes
    if (!autoReturn && frame >= ANIM.TOTAL_FRAMES) {
      completedRef.current = true;
      onComplete(false);
    }
  });

  // Animation state
  const progress = Math.min(frame / ANIM.TOTAL_FRAMES, 1);
  const riseProgress = Math.min(frame / ANIM.RISE_FRAMES, 1);
  const easedProgress = easeOutQuad(riseProgress);
  const renderH = height - 1;

  // Color transition timing:
  // - Frames 0-100: sunrise colors (blood_red)
  // - Frames 100-120: transition to neon green (BEFORE morph starts)
  // - Frames 120+: neon green during morph
  const COLOR_TRANSITION_START = 100;
  const COLOR_TRANSITION_END = ANIM.RISE_FRAMES; // 120

  // Calculate color transition progress (0 during sunrise, 0-1 during transition, 1 after)
  let colorTransition = 0;
  if (frame >= COLOR_TRANSITION_START) {
    colorTransition = Math.min(1, (frame - COLOR_TRANSITION_START) / (COLOR_TRANSITION_END - COLOR_TRANSITION_START));
  }

  // Get sunrise colors based on rise progress
  const sunriseProgress = Math.min(frame / COLOR_TRANSITION_START, 1);
  const sunriseColors = getColors(sunriseProgress, 'blood_red');

  // Neon green palette (vibrant, high saturation)
  const neonGreen = {
    sky: '#000000',      // Black background
    core: '#00ff88',     // Bright neon green
    inner: '#00dd66',    // Slightly darker neon
    outer: '#00bb44',    // Outer glow
    glow: '#44ffaa',     // Bright glow
  };

  // Blend helper
  const blendColors = (c1: string, c2: string, t: number): string => {
    const [r1, g1, b1] = hexToRgb(c1);
    const [r2, g2, b2] = hexToRgb(c2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Always use black background, blend sun colors
  const colors: Colors = {
    sky: '#000000',  // Constant black background
    core: blendColors(sunriseColors.core, neonGreen.core, colorTransition),
    inner: blendColors(sunriseColors.inner, neonGreen.inner, colorTransition),
    outer: blendColors(sunriseColors.outer, neonGreen.outer, colorTransition),
    glow: blendColors(sunriseColors.glow, neonGreen.glow, colorTransition),
  };

  const sunArt = buildSunForFrame(Math.min(frame, ANIM.RISE_FRAMES));
  const sunH = sunArt.length;
  const sunW = sunArt[0]?.length || 1;

  const sunEndY = Math.floor((renderH - sunH) / 2);
  const sunY = Math.max(sunEndY, Math.floor(renderH - (renderH - sunEndY) * easedProgress));
  const sunCenterX = Math.floor(width / 2);
  const sunCenterY = sunY + Math.floor(sunH / 2);

  // Build frame buffer
  const grid: { char: string; color: string }[][] = [];
  for (let r = 0; r < renderH; r++) {
    grid[r] = [];
    for (let c = 0; c < width; c++) {
      grid[r][c] = { char: ' ', color: colors.sky };
    }
  }

  if (frame >= ANIM.MORPH_START) {
    // Morph phase - "WELCOME TO THE GAME JACK" + live clock
    // Two lines of text
    const line1Points = textToPointsBold('WELCOME TO THE GAME JACK');
    const line2Points = timeToSegmentPoints(currentTime);

    const line1Width = line1Points.reduce((max, p) => Math.max(max, p[1]), 0) + 1;
    const line2Width = line2Points.reduce((max, p) => Math.max(max, p.point[1]), 0) + 1;

    const textHeight = 5, segmentHeight = 5;
    const totalHeight = textHeight + 3 + segmentHeight;  // text + gap + time
    const textStartY = Math.floor((renderH - totalHeight) / 2);
    const line1StartX = Math.floor((width - line1Width) / 2);
    const line2StartX = Math.floor((width - line2Width) / 2);

    const allTargets: MorphTarget[] = [];
    // Line 1: WELCOME TO THE GAME JACK
    for (const [r, c] of line1Points) {
      allTargets.push({ point: [textStartY + r, line1StartX + c], char: '●' });
    }
    // Line 2: Time (7-segment)
    for (const { point: [r, c], char } of line2Points) {
      allTargets.push({ point: [textStartY + textHeight + 3 + r, line2StartX + c], char });
    }

    const morphedPoints = getMorphedPoints(frame, [sunCenterY, sunCenterX], allTargets);
    const morphProgress = (frame - ANIM.MORPH_START) / ANIM.MORPH_FRAMES;
    for (const { point: [r, c], char } of morphedPoints) {
      if (r >= 0 && r < renderH && c >= 0 && c < width) {
        grid[r][c] = { char, color: morphProgress > 0.7 ? colors.core : colors.glow };
      }
    }
  } else {
    // Rise phase
    for (let ringIdx = 0; ringIdx <= ANIM.MAX_RING; ringIdx++) {
      const ringDef = RING_DEFS[ringIdx];
      if (!ringDef) continue;
      const visibility = getRingVisibility(ringIdx, frame);
      if (visibility === 0) continue;
      const ringColor = getRingColor(ringIdx, frame, colors);

      for (const [dr, dc] of ringDef.points) {
        const r = sunCenterY + dr, c = sunCenterX + dc;
        if (r >= 0 && r < renderH && c >= 0 && c < width) {
          let char: string;
          if (ringDef.isRay) {
            // Ray rings use line characters
            char = visibility > 0.5 ? getRayChar(dr, dc) : '·';
          } else {
            char = getRingChar(ringIdx, frame);
            if (char === ' ') continue;
          }
          grid[r][c] = { char, color: ringColor };
        }
      }
    }
  }

  // Convert grid to React elements with color grouping
  const rows: React.ReactElement[] = [];
  for (let r = 0; r < renderH; r++) {
    const segments: { text: string; color: string }[] = [];
    let currentText = '', currentColor = colors.sky;
    for (let c = 0; c < width; c++) {
      const cell = grid[r][c];
      if (cell.color === currentColor) {
        currentText += cell.char;
      } else {
        if (currentText) segments.push({ text: currentText, color: currentColor });
        currentText = cell.char;
        currentColor = cell.color;
      }
    }
    if (currentText) segments.push({ text: currentText, color: currentColor });

    rows.push(
      <Box key={r}>
        {segments.map((seg, i) => (
          <Text key={i} color={seg.color} backgroundColor={colors.sky}>{seg.text}</Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} height={renderH}>
      {rows}
    </Box>
  );
}
