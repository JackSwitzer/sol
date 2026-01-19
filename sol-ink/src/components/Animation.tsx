import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

interface AnimationProps {
  width: number;
  height: number;
  autoReturn: boolean;
  onComplete: () => void;
}

// Sun art that grows as it rises
const SUN_STAGES = [
  // Stage 0: Peeking
  [
    '    · · ·    ',
    '   · (○) ·   ',
    '    · · ·    ',
  ],
  // Stage 1: Rising
  [
    '    \\ │ /    ',
    '     \\│/     ',
    '   ───☉───   ',
    '     /│\\     ',
    '    / │ \\    ',
  ],
  // Stage 2: Half-risen
  [
    '     \\ │ /     ',
    '      \\│/      ',
    '    \\  │  /    ',
    '   ────☉────   ',
    '    /  │  \\    ',
    '      /│\\      ',
    '     / │ \\     ',
  ],
  // Stage 3: Full
  [
    '       │       ',
    '   \\   │   /   ',
    '    \\  │  /    ',
    '     \\ │ /     ',
    '   ─────☉─────  ',
    '     / │ \\     ',
    '    /  │  \\    ',
    '   /   │   \\   ',
    '       │       ',
  ],
];

// Color progression
const COLOR_STAGES = [
  { sun: '#8B0000', border: '#4a3000', sky: '#0a0505', text: '#6a3030' },
  { sun: '#FF4500', border: '#995500', sky: '#1a0a05', text: '#FF6347' },
  { sun: '#FFA500', border: '#AA7700', sky: '#2a1505', text: '#FFD700' },
  { sun: '#FFD700', border: '#AA9900', sky: '#3a2510', text: '#FFFF00' },
  { sun: '#FFFF00', border: '#BBBB00', sky: '#4a3515', text: '#FFFFFF' },
];

// Messages
const MSG1 = 'Let there be light.';
const MSG2 = 'Welcome to the game.';

export default function Animation({ width, height, autoReturn, onComplete }: AnimationProps) {
  const [frame, setFrame] = useState(0);
  const [escapeCount, setEscapeCount] = useState(0);
  const escapeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  const TOTAL_FRAMES = 100;
  const FRAME_DELAY = 80;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => {
        if (prev >= TOTAL_FRAMES) {
          return prev;
        }
        return prev + 1;
      });
    }, FRAME_DELAY);

    return () => clearInterval(timer);
  }, []);

  // Auto-return after animation completes
  useEffect(() => {
    if (frame >= TOTAL_FRAMES && autoReturn && !completedRef.current) {
      completedRef.current = true;
      const timeout = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [frame, autoReturn, onComplete]);

  useInput((input, key) => {
    if (completedRef.current) return;

    // Q always exits
    if (input === 'q' || input === 'Q') {
      completedRef.current = true;
      onComplete();
      return;
    }

    // Double-escape to exit
    if (key.escape) {
      if (escapeTimerRef.current) {
        clearTimeout(escapeTimerRef.current);
      }

      if (escapeCount >= 1) {
        completedRef.current = true;
        onComplete();
      } else {
        setEscapeCount(1);
        escapeTimerRef.current = setTimeout(() => {
          setEscapeCount(0);
        }, 1000);
      }
      return;
    }

    // Any other key exits if animation is done (for confirm mode)
    if (!autoReturn && frame >= TOTAL_FRAMES) {
      completedRef.current = true;
      onComplete();
    }
  });

  const progress = frame / TOTAL_FRAMES;

  // Sun position
  const horizonY = Math.floor(height * 0.7);
  const sunTopEnd = Math.floor(height * 0.15);
  const sunBottomStart = horizonY + 4;

  // Eased rise
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const sunY = Math.floor(sunBottomStart - (sunBottomStart - sunTopEnd) * Math.min(eased * 1.1, 1));

  // Stage indices
  const sunStageIndex = Math.min(Math.floor(progress * 4), 3);
  const colorStageIndex = Math.min(Math.floor(progress * 5), 4);

  const sunArt = SUN_STAGES[sunStageIndex];
  const colors = COLOR_STAGES[colorStageIndex];

  const sunHeight = sunArt.length;

  // Message positions
  const messageY = Math.floor(height * 0.4);
  const showMessage1 = sunY < messageY - 2;
  const showMessage2 = sunY < messageY + 1;

  // Date/time
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}  ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  // Build the scene
  const lines: React.ReactNode[] = [];
  const innerWidth = width - 2;

  // Top border (box drawing)
  lines.push(
    <Box key="top" width={width}>
      <Text color={colors.border}>┌{'─'.repeat(innerWidth)}┐</Text>
    </Box>
  );

  for (let row = 1; row < height - 3; row++) {
    const isSunRow = row >= sunY && row < sunY + sunHeight;
    const sunRowIndex = row - sunY;

    const isMessage1Row = row === messageY - 2;
    const isMessage2Row = row === messageY + 1;
    const isDateRow = row === messageY + 4;
    const isHorizonRow = row === horizonY;

    if (isSunRow && sunRowIndex >= 0 && sunRowIndex < sunHeight) {
      // Sun row
      const sunLine = sunArt[sunRowIndex];
      const leftPad = Math.max(0, Math.floor((innerWidth - sunLine.length) / 2));
      const rightPad = Math.max(0, innerWidth - leftPad - sunLine.length);

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>│</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.sun} backgroundColor={colors.sky} bold>
            {sunLine}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>│</Text>
        </Box>
      );
    } else if (isMessage1Row && showMessage1) {
      const leftPad = Math.floor((innerWidth - MSG1.length) / 2);
      const rightPad = innerWidth - leftPad - MSG1.length;

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>│</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} bold>
            {MSG1}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>│</Text>
        </Box>
      );
    } else if (isMessage2Row && showMessage2) {
      const leftPad = Math.floor((innerWidth - MSG2.length) / 2);
      const rightPad = innerWidth - leftPad - MSG2.length;

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>│</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} italic>
            {MSG2}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>│</Text>
        </Box>
      );
    } else if (isDateRow && showMessage2) {
      const leftPad = Math.floor((innerWidth - dateStr.length) / 2);
      const rightPad = innerWidth - leftPad - dateStr.length;

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>│</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} dimColor>
            {dateStr}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>│</Text>
        </Box>
      );
    } else if (isHorizonRow) {
      const horizonChar = progress > 0.3 ? '─' : '·';
      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>│</Text>
          <Text color={colors.sun} dimColor backgroundColor={colors.sky}>
            {horizonChar.repeat(innerWidth)}
          </Text>
          <Text color={colors.border}>│</Text>
        </Box>
      );
    } else {
      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>│</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(innerWidth)}</Text>
          <Text color={colors.border}>│</Text>
        </Box>
      );
    }
  }

  // Bottom border
  lines.push(
    <Box key="bottom" width={width}>
      <Text color={colors.border}>└{'─'.repeat(innerWidth)}┘</Text>
    </Box>
  );

  // Hint
  const hint = autoReturn
    ? (frame >= TOTAL_FRAMES ? 'Returning...' : 'Press Esc twice to return')
    : (frame >= TOTAL_FRAMES ? 'Press any key to start alarm' : 'Press Esc twice to cancel');

  lines.push(
    <Box key="hint" justifyContent="center" width={width} marginTop={1}>
      <Text dimColor>{hint}</Text>
    </Box>
  );

  return (
    <Box flexDirection="column">
      {lines}
    </Box>
  );
}
