import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import SettingsPanel from './components/SettingsPanel.js';
import Animation from './components/Animation.js';
import { useLampConnection } from './hooks/useLampConnection.js';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Profiles with presets
const PROFILES = {
  standard: { name: 'Standard', duration: 30, endTemp: 5000 },
  quick: { name: 'Quick', duration: 20, endTemp: 4000 },
  gentle: { name: 'Gentle', duration: 45, endTemp: 4000 },
  custom: { name: 'Custom', duration: 30, endTemp: 5000 },
} as const;

type ProfileKey = keyof typeof PROFILES;
const PROFILE_ORDER: ProfileKey[] = ['standard', 'quick', 'gentle', 'custom'];

// Duration range (5 min increments)
const DURATION_MIN = 10;
const DURATION_MAX = 60;

// Temperature options (Kelvin)
const TEMP_OPTIONS = [4000, 4500, 5000, 5500, 6000, 6500];

interface Settings {
  profile: ProfileKey;
  wakeTime: { hour: number; minute: number };
  duration: number;
  endTemp: number;
}

const DEFAULT_SETTINGS: Settings = {
  profile: 'standard',
  wakeTime: { hour: 7, minute: 0 },
  duration: 30,
  endTemp: 5000,
};

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function calculateStartTime(wakeHour: number, wakeMinute: number, duration: number): string {
  let startMinute = wakeMinute - duration;
  let startHour = wakeHour;

  while (startMinute < 0) {
    startMinute += 60;
    startHour -= 1;
  }
  if (startHour < 0) startHour += 24;

  return formatTime(startHour, startMinute);
}

// ASCII Sun for header
const SUN_HEADER = [
  '     \\  │  /     ',
  '      \\ │ /      ',
  '    ────☉────    ',
  '      / │ \\      ',
  '     /  │  \\     ',
];

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedField, setSelectedField] = useState(0);
  const [animationMode, setAnimationMode] = useState<'none' | 'preview' | 'confirm'>('none');
  const { connected, checking, checkConnection } = useLampConnection();
  const pendingAlarmRef = useRef(false);

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

  const applyProfile = useCallback((profileKey: ProfileKey) => {
    if (profileKey !== 'custom') {
      const profile = PROFILES[profileKey];
      setSettings(prev => ({
        ...prev,
        profile: profileKey,
        duration: profile.duration,
        endTemp: profile.endTemp,
      }));
    } else {
      setSettings(prev => ({ ...prev, profile: 'custom' }));
    }
  }, []);

  const setCustomProfile = useCallback(() => {
    if (settings.profile !== 'custom') {
      setSettings(prev => ({ ...prev, profile: 'custom' }));
    }
  }, [settings.profile]);

  const cycleProfile = useCallback((direction: number) => {
    const currentIndex = PROFILE_ORDER.indexOf(settings.profile);
    let newIndex = (currentIndex + direction + PROFILE_ORDER.length) % PROFILE_ORDER.length;
    applyProfile(PROFILE_ORDER[newIndex]);
  }, [settings.profile, applyProfile]);

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

  const adjustDuration = useCallback((delta: number) => {
    setSettings(prev => {
      const newDuration = Math.max(DURATION_MIN, Math.min(DURATION_MAX, prev.duration + delta));
      return { ...prev, duration: newDuration };
    });
    setCustomProfile();
  }, [setCustomProfile]);

  const adjustTemp = useCallback((direction: number) => {
    setSettings(prev => {
      const currentIndex = TEMP_OPTIONS.indexOf(prev.endTemp);
      let newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= TEMP_OPTIONS.length) newIndex = TEMP_OPTIONS.length - 1;
      return { ...prev, endTemp: TEMP_OPTIONS[newIndex] };
    });
    setCustomProfile();
  }, [setCustomProfile]);

  const startAlarm = useCallback(() => {
    const wakeTimeStr = formatTime(settings.wakeTime.hour, settings.wakeTime.minute);

    // Map to closest profile for main.py
    let profile = settings.profile;
    if (profile === 'custom') {
      if (settings.duration <= 20) profile = 'quick';
      else if (settings.duration >= 45) profile = 'gentle';
      else profile = 'standard';
    }

    // Get the path to the parent directory where main.py lives
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const lampDir = resolve(__dirname, '../..');

    // Turn off lamp first, then exit and run alarm
    try {
      execSync(`cd "${lampDir}" && uv run python -c "
import asyncio
from kasa import Device
async def off():
    try:
        b = await Device.connect(host='192.168.1.77')
        await b.turn_off()
    except: pass
asyncio.run(off())
"`, { stdio: 'ignore' });
    } catch {}

    // Store command for after exit
    process.env.SOL_ALARM_CMD = `cd "${lampDir}" && caffeinate -d uv run python main.py up ${wakeTimeStr} -p ${profile}`;
    exit();
  }, [settings, exit]);

  const handleAnimationComplete = useCallback((cancelled?: boolean) => {
    // Clear screen before transitioning back to prevent ghosting artifacts
    stdout?.write('\x1B[2J\x1B[H');

    if (pendingAlarmRef.current && !cancelled) {
      pendingAlarmRef.current = false;
      startAlarm();
    } else {
      pendingAlarmRef.current = false;
      setAnimationMode('none');
    }
  }, [startAlarm, stdout]);

  useInput((input, key) => {
    if (animationMode !== 'none') {
      return; // Animation handles its own input
    }

    if (input === 'q' || input === 'Q') {
      exit();
      return;
    }

    if (input === 'a' || input === 'A') {
      // Clear screen before animation to prevent ghosting
      stdout?.write('\x1B[2J\x1B[H');
      setAnimationMode('preview');
      return;
    }

    if (key.return) {
      pendingAlarmRef.current = true;
      // Clear screen before animation to prevent ghosting
      stdout?.write('\x1B[2J\x1B[H');
      setAnimationMode('confirm');
      return;
    }

    // Navigation (4 fields now)
    if (key.upArrow) {
      setSelectedField(prev => (prev - 1 + 4) % 4);
    } else if (key.downArrow) {
      setSelectedField(prev => (prev + 1) % 4);
    }

    // Value adjustment
    if (key.leftArrow || key.rightArrow) {
      const direction = key.rightArrow ? 1 : -1;

      switch (selectedField) {
        case 0: // Profile
          cycleProfile(direction);
          break;
        case 1: // Wake time (10 min increments)
          adjustTime(direction * 10);
          break;
        case 2: // Duration (5 min increments)
          adjustDuration(direction * 5);
          break;
        case 3: // End temp
          adjustTemp(direction);
          break;
      }
    }
  });

  if (animationMode !== 'none') {
    return (
      <Animation
        width={dimensions.width}
        height={dimensions.height}
        autoReturn={animationMode === 'preview'}
        onComplete={handleAnimationComplete}
      />
    );
  }

  const startTime = calculateStartTime(settings.wakeTime.hour, settings.wakeTime.minute, settings.duration);
  const wakeTimeStr = formatTime(settings.wakeTime.hour, settings.wakeTime.minute);

  // Use height - 1 to prevent scroll flicker (known Ink issue)
  return (
    <Box
      flexDirection="column"
      width={dimensions.width}
      height={dimensions.height - 1}
    >
      {/* Header with Sun */}
      <Box flexDirection="column" alignItems="center" marginTop={1}>
        {SUN_HEADER.map((line, i) => (
          <Text key={i} color="#FFD700">{line}</Text>
        ))}
        <Box marginTop={1}>
          <Text bold color="#FFD700">Sol</Text>
          <Text color="#666"> · </Text>
          <Text color="#888">Sunrise Alarm</Text>
        </Box>
      </Box>

      {/* Main content area */}
      <Box justifyContent="center" marginTop={2}>
        <Box flexDirection="column">
          <SettingsPanel
            profile={PROFILES[settings.profile].name}
            wakeTime={wakeTimeStr}
            duration={settings.duration}
            endTemp={settings.endTemp}
            selectedField={selectedField}
          />

          {/* Calculated start time */}
          <Box marginTop={1} justifyContent="center">
            <Text color="#555">Sunrise </Text>
            <Text color="#FFA500" bold>{startTime}</Text>
            <Text color="#555"> → Wake </Text>
            <Text color="#FFD700" bold>{wakeTimeStr}</Text>
          </Box>

          {/* Lamp status */}
          <Box marginTop={1} justifyContent="center">
            <Text color="#555">Lamp: </Text>
            {checking ? (
              <Text color="#FFA500">Checking...</Text>
            ) : connected ? (
              <Text color="#00FF00">Connected</Text>
            ) : (
              <Text color="#FF4444">Not Found</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer with keybindings */}
      <Box justifyContent="center" marginTop={2}>
        <Text color="#444">─────────────────────────────────────────</Text>
      </Box>
      <Box justifyContent="center" marginTop={1}>
        <Text color="#555">[</Text>
        <Text color="#00BFFF">↑↓</Text>
        <Text color="#555">] Select  [</Text>
        <Text color="#00BFFF">←→</Text>
        <Text color="#555">] Adjust  [</Text>
        <Text color="#00FF00">Enter</Text>
        <Text color="#555">] Start  [</Text>
        <Text color="#FFA500">A</Text>
        <Text color="#555">] Preview  [</Text>
        <Text color="#FF4444">Q</Text>
        <Text color="#555">] Quit</Text>
      </Box>
    </Box>
  );
}
