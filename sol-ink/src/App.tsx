import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Sun from './components/Sun.js';
import SettingsPanel from './components/SettingsPanel.js';
import Animation from './components/Animation.js';
import { useLampConnection } from './hooks/useLampConnection.js';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Profiles match main.py
const PROFILES = {
  quick: { name: 'Quick', duration: 20 },
  standard: { name: 'Standard', duration: 30 },
  gentle: { name: 'Gentle', duration: 45 },
} as const;

type ProfileKey = keyof typeof PROFILES;

interface Settings {
  wakeTime: { hour: number; minute: number };
  duration: ProfileKey;
  endTemp: number;
}

const DEFAULT_SETTINGS: Settings = {
  wakeTime: { hour: 7, minute: 0 },
  duration: 'standard',
  endTemp: 4000,
};

// Temperature options (Kelvin)
const TEMP_OPTIONS = [4000, 4500, 5000, 5500, 6000, 6500];

// Duration options in order
const DURATION_ORDER: ProfileKey[] = ['quick', 'standard', 'gentle'];

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function calculateStartTime(settings: Settings): string {
  const { hour, minute } = settings.wakeTime;
  const duration = PROFILES[settings.duration].duration;

  let startMinute = minute - duration;
  let startHour = hour;

  while (startMinute < 0) {
    startMinute += 60;
    startHour -= 1;
  }
  if (startHour < 0) startHour += 24;

  return formatTime(startHour, startMinute);
}

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedField, setSelectedField] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);
  const { connected, checking, error, checkConnection } = useLampConnection();

  // Get terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 80,
    height: stdout?.rows || 24,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: stdout?.columns || 80,
        height: stdout?.rows || 24,
      });
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  // Check lamp connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const adjustTime = useCallback((delta: number) => {
    setSettings(prev => {
      let newMinute = prev.wakeTime.minute + delta;
      let newHour = prev.wakeTime.hour;

      while (newMinute >= 60) {
        newMinute -= 60;
        newHour += 1;
      }
      while (newMinute < 0) {
        newMinute += 60;
        newHour -= 1;
      }
      if (newHour >= 24) newHour -= 24;
      if (newHour < 0) newHour += 24;

      return {
        ...prev,
        wakeTime: { hour: newHour, minute: newMinute },
      };
    });
  }, []);

  const cycleDuration = useCallback((direction: number) => {
    setSettings(prev => {
      const currentIndex = DURATION_ORDER.indexOf(prev.duration);
      let newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = DURATION_ORDER.length - 1;
      if (newIndex >= DURATION_ORDER.length) newIndex = 0;
      return { ...prev, duration: DURATION_ORDER[newIndex] };
    });
  }, []);

  const adjustTemp = useCallback((direction: number) => {
    setSettings(prev => {
      const currentIndex = TEMP_OPTIONS.indexOf(prev.endTemp);
      let newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= TEMP_OPTIONS.length) newIndex = TEMP_OPTIONS.length - 1;
      return { ...prev, endTemp: TEMP_OPTIONS[newIndex] };
    });
  }, []);

  const startAlarm = useCallback(() => {
    const wakeTimeStr = formatTime(settings.wakeTime.hour, settings.wakeTime.minute);
    const profile = settings.duration;

    // Get the path to the parent directory where main.py lives
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const lampDir = resolve(__dirname, '../..');

    // Build the command to run in a new terminal
    const command = `cd "${lampDir}" && caffeinate -d uv run python main.py up ${wakeTimeStr} -p ${profile}`;

    // Open in new Terminal window
    const script = `tell application "Terminal"
      do script "${command.replace(/"/g, '\\"')}"
      activate
    end tell`;

    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });

    // Exit after launching
    setTimeout(() => exit(), 500);
  }, [settings, exit]);

  useInput((input, key) => {
    if (showAnimation) {
      // Any key exits animation
      if (input || key.return || key.escape) {
        setShowAnimation(false);
      }
      return;
    }

    if (input === 'q' || input === 'Q') {
      exit();
      return;
    }

    if (input === 'a' || input === 'A') {
      setShowAnimation(true);
      return;
    }

    if (key.return) {
      startAlarm();
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedField(prev => (prev - 1 + 3) % 3);
    } else if (key.downArrow) {
      setSelectedField(prev => (prev + 1) % 3);
    }

    // Value adjustment
    if (key.leftArrow || key.rightArrow) {
      const direction = key.rightArrow ? 1 : -1;

      switch (selectedField) {
        case 0: // Wake time
          adjustTime(direction * 5);
          break;
        case 1: // Duration
          cycleDuration(direction);
          break;
        case 2: // End temp
          adjustTemp(direction);
          break;
      }
    }
  });

  if (showAnimation) {
    return <Animation width={dimensions.width} height={dimensions.height} onComplete={() => setShowAnimation(false)} />;
  }

  const startTime = calculateStartTime(settings);
  const wakeTimeStr = formatTime(settings.wakeTime.hour, settings.wakeTime.minute);

  return (
    <Box
      flexDirection="column"
      width={dimensions.width}
      height={dimensions.height}
    >
      {/* Header with Sun */}
      <Box flexDirection="column" alignItems="center" marginTop={1}>
        <Sun stage={3} size="medium" />
        <Box marginTop={1}>
          <Text bold color="#FFD700">Sol</Text>
          <Text color="#888888"> - Sunrise Alarm</Text>
        </Box>
        <Text color="#555555">
          Gentle wake-up light for Kasa bulbs
        </Text>
      </Box>

      {/* Main content area */}
      <Box flexDirection="row" justifyContent="center" marginTop={2}>
        {/* Settings Panel */}
        <Box flexDirection="column" marginRight={4}>
          <SettingsPanel
            wakeTime={wakeTimeStr}
            duration={PROFILES[settings.duration]}
            endTemp={settings.endTemp}
            selectedField={selectedField}
          />

          {/* Calculated start time */}
          <Box marginTop={1} marginLeft={3}>
            <Text color="#666666">Sunrise starts at </Text>
            <Text color="#FFA500" bold>{startTime}</Text>
            <Text color="#666666"> -> Wake: </Text>
            <Text color="#FFD700" bold>{wakeTimeStr}</Text>
          </Box>
        </Box>

        {/* Status Panel */}
        <Box flexDirection="column" borderStyle="round" borderColor="#444444" paddingX={2} paddingY={1}>
          <Text bold color="#888888">Status</Text>
          <Box marginTop={1}>
            <Text color="#666666">Lamp: </Text>
            {checking ? (
              <Text color="#FFA500">Checking...</Text>
            ) : connected ? (
              <Text color="#00FF00">Connected</Text>
            ) : (
              <Text color="#FF4444">{error || 'Disconnected'}</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer with keybindings */}
      <Box
        flexDirection="column"
        alignItems="center"
        marginTop={2}
        paddingTop={1}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor="#333333"
      >
        <Box>
          <Text color="#555555">[</Text>
          <Text color="#00BFFF">Up/Down</Text>
          <Text color="#555555">] Select  </Text>

          <Text color="#555555">[</Text>
          <Text color="#00BFFF">Left/Right</Text>
          <Text color="#555555">] Adjust  </Text>

          <Text color="#555555">[</Text>
          <Text color="#00FF00">Enter</Text>
          <Text color="#555555">] Start  </Text>

          <Text color="#555555">[</Text>
          <Text color="#FFA500">A</Text>
          <Text color="#555555">] Animate  </Text>

          <Text color="#555555">[</Text>
          <Text color="#FF4444">Q</Text>
          <Text color="#555555">] Quit</Text>
        </Box>
      </Box>
    </Box>
  );
}
