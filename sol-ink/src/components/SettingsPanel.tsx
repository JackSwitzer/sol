import React from 'react';
import { Box, Text } from 'ink';

interface SettingsPanelProps {
  profile: string;
  wakeTime: string;
  duration: number;
  endTemp: number;
  selectedField: number;
}

// Temperature quality description
function getTempDesc(temp: number): string {
  if (temp <= 2500) return 'candlelight';
  if (temp <= 3000) return 'warm amber';
  if (temp <= 4000) return 'warm white';
  if (temp <= 5000) return 'neutral';
  if (temp <= 6000) return 'daylight';
  if (temp <= 7000) return 'cool white';
  return 'bright blue';
}

export default function SettingsPanel({
  profile,
  wakeTime,
  duration,
  endTemp,
  selectedField,
}: SettingsPanelProps) {
  const fields = [
    { label: 'Profile', value: profile },
    { label: 'Wake', value: wakeTime },
    { label: 'Duration', value: `${duration} min` },
    { label: 'End Temp', value: `${endTemp}K`, desc: getTempDesc(endTemp) },
  ];

  // Fixed width to prevent resize on navigation
  const boxWidth = 44;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#3a3a3a"
      paddingX={2}
      paddingY={1}
      width={boxWidth}
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="center">
        <Text color="#FFD700">Settings</Text>
      </Box>

      {/* Divider */}
      <Box marginBottom={1}>
        <Text color="#2a2a2a">{'─'.repeat(boxWidth - 6)}</Text>
      </Box>

      {/* Fields */}
      {fields.map((field, index) => {
        const isSelected = selectedField === index;
        // Always pad to consistent width (including description column)
        const descStr = (field.desc || '').padEnd(11);
        return (
          <Box key={field.label}>
            <Text color={isSelected ? '#FFD700' : '#333'}>
              {isSelected ? '▸ ' : '  '}
            </Text>
            <Text color={isSelected ? '#fff' : '#666'} bold={isSelected}>
              {field.label.padEnd(9)}
            </Text>
            <Text color="#333"> │ </Text>
            <Text color={isSelected ? '#00BFFF' : '#888'} bold={isSelected}>
              {field.value.padEnd(14)}
            </Text>
            <Text color="#444">{descStr}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
