#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { execSync } from 'child_process';
import App from './App.js';

// Clear screen and hide cursor for cleaner UI
process.stdout.write('\x1B[?25l'); // Hide cursor
process.stdout.write('\x1B[2J\x1B[H'); // Clear screen

const { waitUntilExit } = render(<App />);

waitUntilExit().then(() => {
  process.stdout.write('\x1B[?25h'); // Show cursor
  process.stdout.write('\x1B[2J\x1B[H'); // Clear screen

  // Check if alarm command was set
  const alarmCmd = process.env.SOL_ALARM_CMD;
  if (alarmCmd) {
    console.log('Starting sunrise alarm...\n');
    // Replace this process with the alarm command
    execSync(alarmCmd, { stdio: 'inherit' });
  }

  process.exit(0);
});
