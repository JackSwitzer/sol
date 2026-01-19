import React from 'react';
import { Box, Text } from 'ink';

interface SunProps {
  stage?: number; // 0-3 for different sun appearances
  size?: 'small' | 'medium' | 'large';
}

// Sun ASCII art with rays - warm and inviting
const SUN_ART = {
  small: [
    '    \\  |  /    ',
    '  -- (\\*/) --  ',
    '    /  |  \\    ',
  ],
  medium: [
    '       \\   |   /       ',
    '        \\  |  /        ',
    '         \\ | /         ',
    '    ------(@)------    ',
    '         / | \\         ',
    '        /  |  \\        ',
    '       /   |   \\       ',
  ],
  large: [
    '          \\    |    /          ',
    '           \\   |   /           ',
    '            \\  |  /            ',
    '             \\ | /             ',
    '      --------(@)--------      ',
    '             / | \\             ',
    '            /  |  \\            ',
    '           /   |   \\           ',
    '          /    |    \\          ',
  ],
};

// Colors based on stage (sunrise progression) - warm gradient
const STAGE_COLORS = [
  { sun: '#8B0000', rays: '#4a0000', glow: '#2a0000' },     // Deep red - pre-dawn
  { sun: '#FF4500', rays: '#CC3700', glow: '#FF6347' },     // Orange-red - early
  { sun: '#FFA500', rays: '#CC8400', glow: '#FFD700' },     // Orange - mid
  { sun: '#FFD700', rays: '#CCAC00', glow: '#FFFF00' },     // Golden - bright
];

export default function Sun({ stage = 2, size = 'medium' }: SunProps) {
  const art = SUN_ART[size];
  const colors = STAGE_COLORS[Math.min(stage, STAGE_COLORS.length - 1)];

  return (
    <Box flexDirection="column" alignItems="center">
      {art.map((line, i) => {
        // Determine if this line is the sun center or rays
        const isCenterLine = line.includes('(@)') || line.includes('(*)');

        return (
          <Text key={i} color={isCenterLine ? colors.sun : colors.rays} bold={isCenterLine}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

// Animated sun with glow effect
export function AnimatedSun({ frame }: { frame: number }) {
  // Cycle through stages based on frame
  const stage = Math.min(Math.floor(frame / 15), 3);
  const colors = STAGE_COLORS[stage];

  // Pulsing glow effect
  const glowIntensity = Math.sin(frame * 0.15) * 0.5 + 0.5;
  const useGlow = glowIntensity > 0.6;

  const art = [
    '       \\   |   /       ',
    '        \\  |  /        ',
    '         \\ | /         ',
    `    ------${useGlow ? '(*)' : '(@)'}------    `,
    '         / | \\         ',
    '        /  |  \\        ',
    '       /   |   \\       ',
  ];

  return (
    <Box flexDirection="column" alignItems="center">
      {art.map((line, i) => {
        const isCenterLine = line.includes('(@)') || line.includes('(*)');
        const color = isCenterLine
          ? (useGlow ? colors.glow : colors.sun)
          : colors.rays;

        return (
          <Text key={i} color={color} bold={isCenterLine}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
