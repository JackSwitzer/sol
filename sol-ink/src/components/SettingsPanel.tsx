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
  if (temp <= 4000) return 'warm amber';
  if (temp <= 4500) return 'warm white';
  if (temp <= 5000) return 'neutral';
  if (temp <= 5500) return 'cool white';
  return 'daylight';
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

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#3a3a3a"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="center">
        <Text color="#FFD700">Settings</Text>
      </Box>

      {/* Divider */}
      <Box marginBottom={1}>
        <Text color="#2a2a2a">{'─'.repeat(32)}</Text>
      </Box>

      {/* Fields */}
      {fields.map((field, index) => {
        const isSelected = selectedField === index;
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
              {field.value.padEnd(12)}
            </Text>
            {field.desc && (
              <Text color="#444">{field.desc}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
