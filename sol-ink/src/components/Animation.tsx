import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface AnimationProps {
  width: number;
  height: number;
  onComplete: () => void;
}

// Sun art that grows as it rises
const SUN_STAGES = [
  // Stage 0: Peeking (deep red)
  [
    '      . . .      ',
    '     . (*) .     ',
    '      . . .      ',
  ],
  // Stage 1: Rising (orange-red)
  [
    '      \\ | /      ',
    '       \\|/       ',
    '    ---(@)---    ',
    '       /|\\       ',
    '      / | \\      ',
  ],
  // Stage 2: Half-risen (orange)
  [
    '       \\ | /       ',
    '        \\|/        ',
    '     \\  | /        ',
    '   ----(@)----     ',
    '     /  |  \\       ',
    '        /|\\        ',
    '       / | \\       ',
  ],
  // Stage 3: Full (golden yellow)
  [
    '         |         ',
    '     \\   |   /     ',
    '      \\  |  /      ',
    '       \\ | /       ',
    '   -----(@)-----   ',
    '       / | \\       ',
    '      /  |  \\      ',
    '     /   |   \\     ',
    '         |         ',
  ],
];

// Color progression: red -> orange -> yellow -> bright yellow/white
const COLOR_STAGES = [
  { sun: '#8B0000', border: '#4a0000', sky: '#0a0505', text: '#5a2020' },      // Deep red
  { sun: '#FF4500', border: '#CC3700', sky: '#1a0a05', text: '#FF6347' },      // Orange-red
  { sun: '#FFA500', border: '#CC8400', sky: '#2a1505', text: '#FFD700' },      // Orange
  { sun: '#FFD700', border: '#CCAC00', sky: '#3a2510', text: '#FFFF00' },      // Golden
  { sun: '#FFFF00', border: '#FFFF00', sky: '#4a3515', text: '#FFFFFF' },      // Bright yellow
];

// Messages revealed as sun rises
const MESSAGES = [
  { text: 'Let there be light.', style: 'bold' as const },
  { text: 'Good Morning!', style: 'italic' as const },
];

export default function Animation({ width, height, onComplete }: AnimationProps) {
  const [frame, setFrame] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Animation constants
  const TOTAL_FRAMES = 120;
  const FRAME_DELAY = 70; // ms per frame

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => {
        if (prev >= TOTAL_FRAMES) {
          return prev; // Hold at end
        }
        return prev + 1;
      });
    }, FRAME_DELAY);

    return () => clearInterval(timer);
  }, []);

  // Handle any key to exit
  useInput(() => {
    if (!exiting) {
      setExiting(true);
      setTimeout(onComplete, 100);
    }
  });

  // Calculate animation state
  const progress = frame / TOTAL_FRAMES;

  // Sun position: starts below horizon, rises to upper third
  const horizonY = Math.floor(height * 0.7);
  const sunTopEnd = Math.floor(height * 0.12);
  const sunBottomStart = horizonY + 4;

  // Eased rise (starts slow, accelerates, slows at end)
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  const sunY = Math.floor(sunBottomStart - (sunBottomStart - sunTopEnd) * Math.min(eased * 1.1, 1));

  // Sun stage based on progress (0-3)
  const sunStageIndex = Math.min(Math.floor(progress * 4), 3);
  const colorStageIndex = Math.min(Math.floor(progress * 5), 4);

  const sunArt = SUN_STAGES[sunStageIndex];
  const colors = COLOR_STAGES[colorStageIndex];

  const sunHeight = sunArt.length;
  const sunWidth = sunArt[0].length;
  const sunX = Math.floor((width - sunWidth) / 2);

  // Message reveal: show when sun passes message position
  const messageY = Math.floor(height * 0.4);
  const showMessage1 = sunY < messageY - 2;
  const showMessage2 = sunY < messageY + 1;

  // Date/time
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Build the scene row by row
  const lines: React.ReactNode[] = [];

  // Top border
  lines.push(
    <Box key="top" width={width}>
      <Text color={colors.border} bold>{'='.repeat(width)}</Text>
    </Box>
  );

  for (let row = 1; row < height - 2; row++) {
    const isSunRow = row >= sunY && row < sunY + sunHeight;
    const sunRowIndex = row - sunY;

    // Check for message rows
    const isMessage1Row = row === messageY - 2;
    const isMessage2Row = row === messageY + 1;
    const isDateRow = row === messageY + 4;

    // Horizon line
    const isHorizonRow = row === horizonY;

    if (isSunRow && sunRowIndex >= 0 && sunRowIndex < sunHeight) {
      // Sun row
      const sunLine = sunArt[sunRowIndex];
      const leftPad = Math.max(0, sunX);
      const rightPad = Math.max(0, width - leftPad - sunLine.length - 2);

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>|</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.sun} backgroundColor={colors.sky} bold>
            {sunLine}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>|</Text>
        </Box>
      );
    } else if (isMessage1Row && showMessage1) {
      // "Let there be light."
      const msg = MESSAGES[0].text;
      const leftPad = Math.floor((width - msg.length - 2) / 2);
      const rightPad = width - leftPad - msg.length - 2;

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>|</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} bold>
            {msg}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>|</Text>
        </Box>
      );
    } else if (isMessage2Row && showMessage2) {
      // "Good Morning!"
      const msg = MESSAGES[1].text;
      const leftPad = Math.floor((width - msg.length - 2) / 2);
      const rightPad = width - leftPad - msg.length - 2;

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>|</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} italic>
            {msg}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>|</Text>
        </Box>
      );
    } else if (isDateRow && showMessage2) {
      // Date and time
      const msg = `${dateStr} | ${timeStr}`;
      const leftPad = Math.floor((width - msg.length - 2) / 2);
      const rightPad = width - leftPad - msg.length - 2;

      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>|</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(leftPad)}</Text>
          <Text color={colors.text} backgroundColor={colors.sky} dimColor>
            {msg}
          </Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(rightPad)}</Text>
          <Text color={colors.border}>|</Text>
        </Box>
      );
    } else if (isHorizonRow) {
      // Horizon line with subtle gradient
      const horizonChar = progress > 0.3 ? '-' : '.';
      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>|</Text>
          <Text color={colors.sun} dimColor backgroundColor={colors.sky}>
            {horizonChar.repeat(width - 2)}
          </Text>
          <Text color={colors.border}>|</Text>
        </Box>
      );
    } else {
      // Empty sky
      lines.push(
        <Box key={`row-${row}`}>
          <Text color={colors.border}>|</Text>
          <Text backgroundColor={colors.sky}>{' '.repeat(width - 2)}</Text>
          <Text color={colors.border}>|</Text>
        </Box>
      );
    }
  }

  // Bottom border
  lines.push(
    <Box key="bottom" width={width}>
      <Text color={colors.border} bold>{'='.repeat(width)}</Text>
    </Box>
  );

  // Hint
  lines.push(
    <Box key="hint" justifyContent="center" width={width}>
      <Text dimColor>Press any key to return</Text>
    </Box>
  );

  return (
    <Box flexDirection="column">
      {lines}
    </Box>
  );
}
