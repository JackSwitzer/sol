#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import App from './App.js';

// Clear screen and hide cursor for cleaner UI
process.stdout.write('\x1B[?25l'); // Hide cursor
process.stdout.write('\x1B[2J\x1B[H'); // Clear screen

const { waitUntilExit } = render(<App />);

waitUntilExit().then(() => {
  process.stdout.write('\x1B[?25h'); // Show cursor
  process.stdout.write('\x1B[2J\x1B[H'); // Clear screen
  process.exit(0);
});
