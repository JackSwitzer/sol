#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { execSync } from 'child_process';
import App from './App.js';

// Set up dark terminal environment
process.stdout.write('\x1B[?25l'); // Hide cursor
process.stdout.write('\x1B[48;2;0;0;0m'); // Set background to black
process.stdout.write('\x1B[38;2;255;255;255m'); // Set foreground to white
process.stdout.write('\x1B[2J\x1B[H'); // Clear screen with new colors

// Fill entire screen with black background
const rows = process.stdout.rows || 24;
const cols = process.stdout.columns || 80;
for (let i = 0; i < rows; i++) {
  process.stdout.write(' '.repeat(cols));
}
process.stdout.write('\x1B[H'); // Move cursor back to top

const { waitUntilExit } = render(<App />);

waitUntilExit().then(() => {
  process.stdout.write('\x1B[0m'); // Reset all attributes (colors)
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
