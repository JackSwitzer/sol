import React from 'react';
import { Box, Text } from 'ink';

interface SettingsPanelProps {
  wakeTime: string;
  duration: { name: string; duration: number };
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
      <Text color={isSelected ? '#FFD700' : '#555555'}>
        {isSelected ? ' > ' : '   '}
      </Text>

      {/* Label */}
      <Text color={isSelected ? '#FFFFFF' : '#888888'} bold={isSelected}>
        {label.padEnd(12)}
      </Text>

      {/* Value with brackets indicating adjustable */}
      <Text color="#555555">[</Text>
      <Text color={isSelected ? '#00BFFF' : '#CCCCCC'} bold>
        {` ${value} `}
      </Text>
      <Text color="#555555">]</Text>

      {/* Hint */}
      {hint && (
        <Text color="#666666">
          {' '}{hint}
        </Text>
      )}
    </Box>
  );
}

// Temperature hint based on Kelvin value
function getTempHint(temp: number): string {
  if (temp <= 4000) return '(warm amber)';
  if (temp <= 4500) return '(warm white)';
  if (temp <= 5000) return '(neutral)';
  if (temp <= 5500) return '(cool white)';
  return '(daylight)';
}

export default function SettingsPanel({
  wakeTime,
  duration,
  endTemp,
  selectedField,
}: SettingsPanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#CC8400"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="#FFD700">
          Alarm Settings
        </Text>
      </Box>

      {/* Divider */}
      <Box marginBottom={1}>
        <Text color="#555555">{'~'.repeat(32)}</Text>
      </Box>

      {/* Wake Time */}
      <FieldRow
        label="Wake Time"
        value={wakeTime}
        isSelected={selectedField === 0}
        hint="(+/- 5 min)"
      />

      {/* Duration */}
      <FieldRow
        label="Duration"
        value={`${duration.name} (${duration.duration}m)`}
        isSelected={selectedField === 1}
      />

      {/* End Temperature */}
      <FieldRow
        label="End Temp"
        value={`${endTemp}K`}
        isSelected={selectedField === 2}
        hint={getTempHint(endTemp)}
      />
    </Box>
  );
}
