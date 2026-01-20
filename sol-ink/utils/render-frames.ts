#!/usr/bin/env bun
/**
 * Animation Frame Renderer - For testing sun animation without interactive terminal
 *
 * Usage:
 *   bun utils/render-frames.ts                    # Render key frames
 *   bun utils/render-frames.ts --all              # Render all frames
 *   bun utils/render-frames.ts --frame 60         # Render specific frame
 *   bun utils/render-frames.ts --range 30-60      # Render frame range
 *   bun utils/render-frames.ts --json             # Export as JSON
 *   bun utils/render-frames.ts --jsonl            # Export as JSONL
 *   bun utils/render-frames.ts --help             # Show help
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  Point, ANIM, RING_DEFS, ThemeKey, THEME_ORDER,
  getColors, getRingVisibility, getPulseIntensity, lerpColor,
  buildSunForFrame, textToPointsBold, timeToSegmentPoints,
} from '../src/animation-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = resolve(__dirname, 'frames');

// =============================================================================
// MORPH FRAME BUILDER
// =============================================================================

function buildMorphFrame(frame: number, width = 80, height = 24): string[] {
  const morphProgress = Math.min(1, (frame - ANIM.MORPH_START) / ANIM.MORPH_FRAMES);
  const eased = 1 - Math.pow(1 - morphProgress, 3);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Two lines of text
  const line1Points = textToPointsBold('WELCOME TO THE GAME JACK');
  const line2Points = timeToSegmentPoints(timeStr);

  const line1Width = line1Points.reduce((max, p) => Math.max(max, p[1]), 0) + 1;
  const line2Width = line2Points.reduce((max, p) => Math.max(max, p.point[1]), 0) + 1;

  const textHeight = 5, segmentHeight = 5;
  const totalHeight = textHeight + 3 + segmentHeight;  // text + gap + time
  const textStartY = Math.floor((height - totalHeight) / 2);
  const line1StartX = Math.floor((width - line1Width) / 2);
  const line2StartX = Math.floor((width - line2Width) / 2);

  const sunCenterY = Math.floor(height / 2);
  const sunCenterX = Math.floor(width / 2);

  // Get sun points
  const sunPoints: Point[] = [];
  for (let ringIdx = 0; ringIdx <= ANIM.MAX_RING; ringIdx++) {
    if (getRingVisibility(ringIdx, ANIM.RISE_FRAMES) === 0) continue;
    for (const [dr, dc] of RING_DEFS[ringIdx].points) {
      sunPoints.push([sunCenterY + dr, sunCenterX + dc]);
    }
  }

  // Build targets
  interface MorphTarget { point: Point; char: string }
  const allTargets: MorphTarget[] = [];
  // Line 1: WELCOME TO THE GAME JACK
  for (const [r, c] of line1Points) {
    allTargets.push({ point: [textStartY + r, line1StartX + c], char: '●' });
  }
  // Line 2: Time (7-segment)
  for (const { point: [r, c], char } of line2Points) {
    allTargets.push({ point: [textStartY + textHeight + 3 + r, line2StartX + c], char });
  }

  // Create grid
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) grid[r] = Array(width).fill(' ');

  // Lerp points
  for (let i = 0; i < allTargets.length; i++) {
    const target = allTargets[i];
    let srcRow: number, srcCol: number;

    if (i < sunPoints.length) {
      [srcRow, srcCol] = sunPoints[i];
    } else {
      const angle = (i * 137.508) * (Math.PI / 180);
      const dist = ((i * 7) % 10) + 1;
      srcRow = sunCenterY + Math.round(Math.sin(angle) * dist);
      srcCol = sunCenterX + Math.round(Math.cos(angle) * dist);
    }

    const newRow = Math.round(srcRow + (target.point[0] - srcRow) * eased);
    const newCol = Math.round(srcCol + (target.point[1] - srcCol) * eased);
    const char = eased > 0.8 ? target.char : '●';

    if (newRow >= 0 && newRow < height && newCol >= 0 && newCol < width) {
      grid[newRow][newCol] = char;
    }
  }

  return grid.map(row => row.join(''));
}

// =============================================================================
// FRAME METADATA
// =============================================================================

interface FrameMetadata {
  frame: number;
  totalFrames: number;
  progress: number;
  phase: 'rise' | 'morph';
  morphProgress?: number;
  timing: { frameDelayMs: number; elapsedMs: number; remainingMs: number };
  sun: { maxRing: number; diameter: number; pulsePositions: number[]; ringVisibility: number[] };
  colors: { sky: string; core: string; inner: string; outer: string };
  dimensions: { width: number; height: number };
  art: string[];
}

function getFrameMetadata(frame: number, width = 80, height = 24, theme: ThemeKey = 'blood_red'): FrameMetadata {
  const cappedFrame = Math.min(frame, ANIM.RISE_FRAMES);
  let maxRing = 0;
  const ringVisibility: number[] = [];
  for (let i = 0; i <= ANIM.MAX_RING; i++) {
    const vis = getRingVisibility(i, cappedFrame);
    ringVisibility.push(Math.round(vis * 100) / 100);
    if (vis > 0) maxRing = i;
  }

  const pulsePositions: number[] = [];
  for (let pulseStart = 0; pulseStart <= cappedFrame; pulseStart += ANIM.PULSE_PERIOD) {
    const pulseAge = cappedFrame - pulseStart;
    const pulseRing = pulseAge / ANIM.PULSE_SPEED;
    if (pulseRing <= ANIM.MAX_RING + 1) pulsePositions.push(Math.round(pulseRing * 10) / 10);
  }

  const progress = frame / ANIM.TOTAL_FRAMES;
  const isMorph = frame >= ANIM.MORPH_START;
  const colors = getColors(progress, theme);

  return {
    frame,
    totalFrames: ANIM.TOTAL_FRAMES,
    progress: Math.round(progress * 100),
    phase: isMorph ? 'morph' : 'rise',
    morphProgress: isMorph ? Math.round(((frame - ANIM.MORPH_START) / ANIM.MORPH_FRAMES) * 100) : undefined,
    timing: {
      frameDelayMs: ANIM.FRAME_DELAY_MS,
      elapsedMs: frame * ANIM.FRAME_DELAY_MS,
      remainingMs: (ANIM.TOTAL_FRAMES - frame) * ANIM.FRAME_DELAY_MS,
    },
    sun: { maxRing, diameter: maxRing === 0 ? 1 : maxRing * 2 + 1, pulsePositions, ringVisibility },
    colors: {
      sky: colors.sky,
      core: colors.core,
      inner: lerpColor(colors.sky, colors.core, 0.5),
      outer: lerpColor(colors.sky, colors.core, 0.25),
    },
    dimensions: { width, height },
    art: isMorph ? buildMorphFrame(frame, width, height) : buildSunForFrame(frame),
  };
}

function renderFrameText(meta: FrameMetadata): string {
  const lines: string[] = [];
  const morphStr = meta.morphProgress !== undefined ? ` (morph: ${meta.morphProgress}%)` : '';
  lines.push(`Frame ${meta.frame}/${meta.totalFrames} (${meta.progress}%) - ${meta.phase.toUpperCase()}${morphStr}`);
  lines.push(`Colors: sky=${meta.colors.sky} core=${meta.colors.core}`);
  if (meta.phase === 'rise') {
    lines.push(`Max ring: ${meta.sun.maxRing}, Pulse at: [${meta.sun.pulsePositions.join(', ')}]`);
  }
  lines.push('');
  for (const row of meta.art) lines.push(`|${row}|`);
  return lines.join('\n');
}

// =============================================================================
// CLI
// =============================================================================

interface CliOptions {
  frames: number[];
  save: boolean;
  json: boolean;
  jsonl: boolean;
  width: number;
  height: number;
  theme: ThemeKey;
  help: boolean;
}

function showHelp() {
  console.log(`
Animation Frame Renderer - Test sun animation without interactive terminal

Usage: bun utils/render-frames.ts [options]

Options:
  --all              Render all ${ANIM.TOTAL_FRAMES} frames
  --frame N          Render specific frame
  --range N-M        Render frame range
  --save             Save to utils/frames/
  --json             Output as JSON array
  --jsonl            Output as JSONL (streaming)
  --width N          Frame width (default: 80)
  --height N         Frame height (default: 24)
  --theme NAME       Color theme: ${THEME_ORDER.join(', ')} (default: blood_red)
  --help             Show this help

Animation: ${ANIM.TOTAL_FRAMES} frames, ${ANIM.FRAME_DELAY_MS}ms/frame, ${(ANIM.TOTAL_FRAMES * ANIM.FRAME_DELAY_MS / 1000).toFixed(1)}s total
Phases: rise (0-${ANIM.RISE_FRAMES-1}), morph (${ANIM.MORPH_START}-${ANIM.TOTAL_FRAMES-1})
`);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = { frames: [], save: false, json: false, jsonl: false, width: 80, height: 24, theme: 'blood_red', help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--all') opts.frames = Array.from({ length: ANIM.TOTAL_FRAMES }, (_, i) => i);
    else if (arg === '--frame' && args[i + 1]) opts.frames.push(parseInt(args[++i]));
    else if (arg === '--range' && args[i + 1]) {
      const [start, end] = args[++i].split('-').map(Number);
      opts.frames.push(...Array.from({ length: end - start + 1 }, (_, i) => start + i));
    }
    else if (arg === '--save') opts.save = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--jsonl') opts.jsonl = true;
    else if (arg === '--width' && args[i + 1]) opts.width = parseInt(args[++i]);
    else if (arg === '--height' && args[i + 1]) opts.height = parseInt(args[++i]);
    else if (arg === '--theme' && args[i + 1]) {
      const themeName = args[++i] as ThemeKey;
      if (THEME_ORDER.includes(themeName)) opts.theme = themeName;
    }
  }

  if (opts.frames.length === 0) {
    opts.frames = [0, 6, 18, 36, 60, 90, 105, 119, 120, 130, 145, 160, 179];
  }
  return opts;
}

function main() {
  const opts = parseArgs();
  if (opts.help) { showHelp(); return; }

  const { frames, save, json, jsonl, width, height, theme } = opts;
  const validFrames = frames.filter(f => f >= 0 && f < ANIM.TOTAL_FRAMES);

  if (save && !existsSync(FRAMES_DIR)) mkdirSync(FRAMES_DIR, { recursive: true });

  if (json) {
    const data = validFrames.map(f => getFrameMetadata(f, width, height, theme));
    console.log(JSON.stringify(data, null, 2));
    if (save) {
      writeFileSync(resolve(FRAMES_DIR, 'frames.json'), JSON.stringify(data, null, 2));
      console.error(`Saved ${data.length} frames to ${FRAMES_DIR}/frames.json`);
    }
    return;
  }

  if (jsonl) {
    for (const frame of validFrames) {
      console.log(JSON.stringify(getFrameMetadata(frame, width, height, theme)));
    }
    if (save) {
      const lines = validFrames.map(f => JSON.stringify(getFrameMetadata(f, width, height, theme)));
      writeFileSync(resolve(FRAMES_DIR, 'frames.jsonl'), lines.join('\n') + '\n');
      console.error(`Saved ${validFrames.length} frames to ${FRAMES_DIR}/frames.jsonl`);
    }
    return;
  }

  const outputs: string[] = [];
  for (const frame of validFrames) {
    const meta = getFrameMetadata(frame, width, height, theme);
    const rendered = renderFrameText(meta);
    outputs.push(rendered);
    console.log(rendered + '\n');
    if (save) writeFileSync(resolve(FRAMES_DIR, `frame-${String(frame).padStart(3, '0')}.txt`), rendered);
  }

  if (save) {
    writeFileSync(resolve(FRAMES_DIR, 'all-frames.txt'), outputs.join('\n\n'));
    console.log(`Saved ${validFrames.length} frames to ${FRAMES_DIR}/`);
  }
}

main();
