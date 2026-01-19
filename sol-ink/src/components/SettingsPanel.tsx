import React from 'react';
import { Box, Text } from 'ink';

interface SettingsPanelProps {
  profile: string;
  wakeTime: string;
  duration: number;
  endTemp: number;
  selectedField: number;
}

interface FieldRowProps {
  label: string;
  value: string;
  isSelected: boolean;
  hint?: string;
}

function FieldRow({ label, value, isSelected, hint }: FieldRowProps) {
  return (
    <Box>
      {/* Selection indicator */}
      <Text color={isSelected ? '#FFD700' : '#333'}>
        {isSelected ? '▸ ' : '  '}
      </Text>

      {/* Label */}
      <Text color={isSelected ? '#FFF' : '#888'} bold={isSelected}>
        {label.padEnd(10)}
      </Text>

      {/* Value */}
      <Text color="#444"> │ </Text>
      <Text color={isSelected ? '#00BFFF' : '#AAA'} bold={isSelected}>
        {value.padEnd(14)}
      </Text>

      {/* Hint */}
      {hint && (
        <Text color="#555">{hint}</Text>
      )}
    </Box>
  );
}

// Temperature hint based on Kelvin value
function getTempHint(temp: number): string {
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
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#555"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="center">
        <Text bold color="#FFD700">
          ⚙ Settings
        </Text>
      </Box>

      {/* Divider */}
      <Box marginBottom={1}>
        <Text color="#333">{'─'.repeat(36)}</Text>
      </Box>

      {/* Profile */}
      <FieldRow
        label="Profile"
        value={profile}
        isSelected={selectedField === 0}
      />

      {/* Wake Time */}
      <FieldRow
        label="Wake"
        value={wakeTime}
        isSelected={selectedField === 1}
        hint="±10m"
      />

      {/* Duration */}
      <FieldRow
        label="Duration"
        value={`${duration} min`}
        isSelected={selectedField === 2}
        hint="±5m"
      />

      {/* End Temperature */}
      <FieldRow
        label="End Temp"
        value={`${endTemp}K`}
        isSelected={selectedField === 3}
        hint={getTempHint(endTemp)}
      />
    </Box>
  );
}
