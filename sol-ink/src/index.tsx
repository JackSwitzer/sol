#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { execSync } from 'child_process';
import App from './App.js';

// Cleanup function to restore terminal state
function cleanup() {
  process.stdout.write('\x1B[0m'); // Reset all colors/attributes
  process.stdout.write('\x1B[?7h'); // Re-enable line wrap
  process.stdout.write('\x1B[?25h'); // Show cursor
  process.stdout.write('\x1B[?1049l'); // Exit alternate screen buffer
}

// Register cleanup handlers for crashes and signals
process.on('uncaughtException', (err) => {
  cleanup();
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  cleanup();
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C) and SIGTERM gracefully
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Enter alternate screen buffer for clean full-screen TUI
process.stdout.write('\x1B[?1049h'); // Enter alternate screen buffer
process.stdout.write('\x1B[?25l'); // Hide cursor
process.stdout.write('\x1B[?7l'); // CRITICAL: Disable line wrap to prevent scrolling
process.stdout.write('\x1B[48;2;0;0;0m'); // Set background to pure black
process.stdout.write('\x1B[38;2;255;255;255m'); // Set foreground to white
process.stdout.write('\x1B[2J\x1B[H'); // Clear screen with black background

// Fill entire screen with black using cursor positioning (no newlines = no scroll)
const rows = process.stdout.rows || 24;
const cols = process.stdout.columns || 80;
for (let i = 0; i < rows; i++) {
  process.stdout.write(`\x1B[${i + 1};1H`); // Move cursor to row i+1, column 1
  process.stdout.write(' '.repeat(cols));
}
process.stdout.write('\x1B[H'); // Return cursor to top-left

const { waitUntilExit } = render(<App />, {
  // Prevent Ink from showing cursor on exit - we manage it ourselves
  patchConsole: true,
});

waitUntilExit().then(() => {
  cleanup();

  // Check if alarm command was set
  const alarmCmd = process.env.SOL_ALARM_CMD;
  if (alarmCmd) {
    console.log('Starting sunrise alarm...\n');
    // Replace this process with the alarm command
    execSync(alarmCmd, { stdio: 'inherit' });
  }

  process.exit(0);
});
