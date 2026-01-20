import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import {
  Point, ANIM, getMoonPoints, textToPointsBold,
  hexToRgb, easeOutCubic,
} from '../animation-core';

interface CountdownAnimationProps {
  width: number;
  height: number;
  minutesUntilWake: number;
  onComplete: (cancelled?: boolean) => void;
  onWakeTime: () => void;
}

// Deep dark blue palette
const MOON_COLORS = {
  sky: '#000000',
  core: '#1a3a5c',
  glow: '#0d2035',
  text: '#2a4a6c',
};

// Slightly brighter blue for countdown text
const COUNTDOWN_COLORS = {
  sky: '#000000',
  core: '#2a5a8c',
  glow: '#1a3a5c',
  text: '#3a6a9c',
};

interface MorphTarget {
  point: Point;
  char: string;
}

export default function CountdownAnimation({
  width,
  height,
  minutesUntilWake,
  onComplete,
  onWakeTime,
}: CountdownAnimationProps): React.ReactElement {
  const { stdout } = useStdout();
  const [frame, setFrame] = useState(0);
  const [currentMinutes, setCurrentMinutes] = useState(minutesUntilWake);
  const [escapeCount, setEscapeCount] = useState(0);
  const escapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const MORPH_FRAMES = 60;
  const TOTAL_INTRO_FRAMES = 90; // Moon appears + morphs

  // Hide cursor
  useEffect(() => { stdout?.write('\x1B[?25l'); }, [stdout]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
    };
  }, []);

  // Animation frame timer (only during intro)
  useEffect(() => {
    if (frame >= TOTAL_INTRO_FRAMES) return;
    const id = setInterval(() => {
      setFrame(f => f + 1);
    }, 50);
    return () => clearInterval(id);
  }, [frame]);

  // Countdown timer - updates every minute
  useEffect(() => {
    if (frame < TOTAL_INTRO_FRAMES) return;

    const interval = setInterval(() => {
      setCurrentMinutes(prev => {
        if (prev <= 1) {
          // Wake time reached!
          clearInterval(interval);
          if (!completedRef.current) {
            completedRef.current = true;
            onWakeTime();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [frame, onWakeTime]);

  // Check if wake time already passed
  useEffect(() => {
    if (currentMinutes <= 0 && !completedRef.current) {
      completedRef.current = true;
      onWakeTime();
    }
  }, [currentMinutes, onWakeTime]);

  // Background color - always black
  useEffect(() => {
    if (!stdout) return;
    stdout.write(`\x1B[${height};1H\x1B[48;2;0;0;0m${' '.repeat(width)}\x1B[H`);
  }, [frame, stdout, height, width]);

  useInput((input, key) => {
    if (completedRef.current) return;

    // Cancel with Q or double-escape
    if (input === 'q' || input === 'Q') {
      completedRef.current = true;
      onComplete(true);
      return;
    }
    if (key.escape) {
      if (escapeTimerRef.current) clearTimeout(escapeTimerRef.current);
      if (escapeCount >= 1) {
        completedRef.current = true;
        onComplete(true);
      } else {
        setEscapeCount(1);
        escapeTimerRef.current = setTimeout(() => setEscapeCount(0), 1000);
      }
      return;
    }
  });

  const renderH = height - 1;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(renderH / 2);

  // Build frame buffer
  const grid: { char: string; color: string }[][] = [];
  for (let r = 0; r < renderH; r++) {
    grid[r] = [];
    for (let c = 0; c < width; c++) {
      grid[r][c] = { char: ' ', color: MOON_COLORS.sky };
    }
  }

  // Get crescent moon points (radius 8 for good visibility)
  const moonRadius = 8;
  const moonPoints = getMoonPoints(moonRadius);

  // Build text targets
  const textPoints = textToPointsBold('MINUTES UNTIL WAKE');
  const textWidth = textPoints.reduce((max, p) => Math.max(max, p[1]), 0) + 1;
  const textStartX = Math.floor((width - textWidth) / 2);
  const textStartY = Math.floor(renderH / 2) - 5;

  const allTargets: MorphTarget[] = textPoints.map(([r, c]) => ({
    point: [textStartY + r, textStartX + c],
    char: '●',
  }));

  // Calculate total dots needed
  const totalMoonDots = moonPoints.length;
  const totalTextDots = allTargets.length;
  const maxDots = Math.max(totalMoonDots, totalTextDots);

  // Morph progress
  const introComplete = frame >= TOTAL_INTRO_FRAMES;
  const morphProgress = introComplete ? 1 : Math.min(1, Math.max(0, (frame - 30) / MORPH_FRAMES));
  const eased = easeOutCubic(morphProgress);

  // Calculate dot visibility based on countdown progress
  const initialMinutes = minutesUntilWake;
  const dotFadeProgress = initialMinutes > 0 ? 1 - (currentMinutes / initialMinutes) : 1;
  const visibleDots = Math.floor(maxDots * (1 - dotFadeProgress * 0.7)); // Keep at least 30% dots

  // Render morphing dots
  for (let i = 0; i < Math.min(maxDots, visibleDots + 10); i++) {
    // Source: moon position
    let srcRow: number, srcCol: number;
    if (i < moonPoints.length) {
      srcRow = centerY + moonPoints[i][0];
      srcCol = centerX + moonPoints[i][1];
    } else {
      // Extra dots spawn from center
      const angle = (i * 137.508) * (Math.PI / 180);
      const dist = ((i * 3) % moonRadius) + 1;
      srcRow = centerY + Math.round(Math.sin(angle) * dist);
      srcCol = centerX + Math.round(Math.cos(angle) * dist);
    }

    // Target: text position
    let tgtRow: number, tgtCol: number;
    if (i < allTargets.length) {
      tgtRow = allTargets[i].point[0];
      tgtCol = allTargets[i].point[1];
    } else {
      // Extra dots fade to random positions
      tgtRow = srcRow;
      tgtCol = srcCol;
    }

    // Interpolate position
    const row = Math.round(srcRow + (tgtRow - srcRow) * eased);
    const col = Math.round(srcCol + (tgtCol - srcCol) * eased);

    // Fade dots based on countdown
    const dotOpacity = i < visibleDots ? 1 : Math.max(0, 1 - (i - visibleDots) / 10);

    if (row >= 0 && row < renderH && col >= 0 && col < width && dotOpacity > 0.3) {
      const color = eased > 0.8 ? COUNTDOWN_COLORS.core : MOON_COLORS.core;
      grid[row][col] = { char: '●', color };
    }
  }

  // Render countdown number below text (after morph completes)
  if (introComplete) {
    const countdownStr = String(currentMinutes);
    const countdownY = textStartY + 8;
    const countdownX = Math.floor((width - countdownStr.length * 6) / 2);

    // Simple large numbers using segment font style
    for (let i = 0; i < countdownStr.length; i++) {
      const digit = countdownStr[i];
      const digitX = countdownX + i * 6;

      // Draw digit (simple 3x5 representation)
      const digitPatterns: Record<string, string[]> = {
        '0': [' ● ', '● ●', '● ●', '● ●', ' ● '],
        '1': [' ● ', '●● ', ' ● ', ' ● ', '●●●'],
        '2': ['●●●', '  ●', '●●●', '●  ', '●●●'],
        '3': ['●●●', '  ●', '●●●', '  ●', '●●●'],
        '4': ['● ●', '● ●', '●●●', '  ●', '  ●'],
        '5': ['●●●', '●  ', '●●●', '  ●', '●●●'],
        '6': ['●●●', '●  ', '●●●', '● ●', '●●●'],
        '7': ['●●●', '  ●', '  ●', '  ●', '  ●'],
        '8': ['●●●', '● ●', '●●●', '● ●', '●●●'],
        '9': ['●●●', '● ●', '●●●', '  ●', '●●●'],
      };

      const pattern = digitPatterns[digit] || digitPatterns['0'];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < pattern[r].length; c++) {
          if (pattern[r][c] === '●') {
            const row = countdownY + r;
            const col = digitX + c;
            if (row >= 0 && row < renderH && col >= 0 && col < width) {
              grid[row][col] = { char: '●', color: COUNTDOWN_COLORS.text };
            }
          }
        }
      }
    }

    // "MIN" label
    const minLabel = 'MIN';
    const minY = countdownY + 6;
    const minX = Math.floor((width - minLabel.length) / 2);
    for (let i = 0; i < minLabel.length; i++) {
      if (minY < renderH && minX + i < width) {
        grid[minY][minX + i] = { char: minLabel[i], color: COUNTDOWN_COLORS.glow };
      }
    }
  }

  // Convert grid to React elements
  const rows: React.ReactElement[] = [];
  for (let r = 0; r < renderH; r++) {
    const segments: { text: string; color: string }[] = [];
    let currentText = '', currentColor = MOON_COLORS.sky;
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
          <Text key={i} color={seg.color} backgroundColor={MOON_COLORS.sky}>{seg.text}</Text>
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
