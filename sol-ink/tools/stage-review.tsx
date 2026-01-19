#!/usr/bin/env bun
import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMENTS_FILE = resolve(__dirname, 'stage-comments.json');

// =============================================================================
// SUN ASCII ART - Same as Animation.tsx
// =============================================================================

const W0 = 3;
const W1 = 7;
const W2 = 11;
const W3 = 17;
const W4 = 25;

const pad = (s: string, w: number): string => {
  const left = Math.floor((w - s.length) / 2);
  const right = w - s.length - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
};

const SUN_STAGES = [
  { name: 'Stage 0: First Light', progress: '0-20%', art: [pad('.', W0)] },
  { name: 'Stage 1: Emerging', progress: '20-40%', art: [pad('.', W1), pad('(o)', W1), pad('.', W1)] },
  {
    name: 'Stage 2: Rising',
    progress: '40-60%',
    art: [
      pad('\\   /', W2),
      pad('\\ | /', W2),
      pad('--O--', W2),
      pad('/ | \\', W2),
      pad('/   \\', W2),
    ],
  },
  {
    name: 'Stage 3: Growing',
    progress: '60-80%',
    art: [
      pad('\\    |    /', W3),
      pad('\\   |   /', W3),
      pad('\\  |  /', W3),
      pad('-----O-----', W3),
      pad('/  |  \\', W3),
      pad('/   |   \\', W3),
      pad('/    |    \\', W3),
    ],
  },
  {
    name: 'Stage 4: Full Sun',
    progress: '80-100%',
    art: [
      pad('\\      |      /', W4),
      pad('\\     |     /', W4),
      pad('\\    |    /', W4),
      pad('\\   |   /', W4),
      pad('-----------@-----------', W4),
      pad('/   |   \\', W4),
      pad('/    |    \\', W4),
      pad('/     |     \\', W4),
      pad('/      |      \\', W4),
    ],
  },
];

// =============================================================================
// COLOR PALETTE
// =============================================================================

const PALETTE = [
  { t: 0.0, sky: '#030201', sun: '#3a0808', txt: '#2a1010' },
  { t: 0.15, sky: '#050302', sun: '#6a1010', txt: '#4a1818' },
  { t: 0.3, sky: '#0a0504', sun: '#aa3300', txt: '#883311' },
  { t: 0.5, sky: '#120806', sun: '#dd5500', txt: '#cc5522' },
  { t: 0.7, sky: '#1a0c08', sun: '#ff7700', txt: '#ff8844' },
  { t: 0.85, sky: '#22100a', sun: '#ffaa33', txt: '#ffcc66' },
  { t: 1.0, sky: '#2a180e', sun: '#ffdd66', txt: '#ffffff' },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

function getColors(progress: number): { sky: string; sun: string; txt: string } {
  let lo = PALETTE[0];
  let hi = PALETTE[PALETTE.length - 1];

  for (let i = 0; i < PALETTE.length - 1; i++) {
    if (progress >= PALETTE[i].t && progress <= PALETTE[i + 1].t) {
      lo = PALETTE[i];
      hi = PALETTE[i + 1];
      break;
    }
  }

  const span = hi.t - lo.t;
  const local = span > 0 ? (progress - lo.t) / span : 0;

  return {
    sky: lerpColor(lo.sky, hi.sky, local),
    sun: lerpColor(lo.sun, hi.sun, local),
    txt: lerpColor(lo.txt, hi.txt, local),
  };
}

// =============================================================================
// LOAD/SAVE COMMENTS
// =============================================================================

type Comments = Record<number, string[]>;

function loadComments(): Comments {
  try {
    if (existsSync(COMMENTS_FILE)) {
      return JSON.parse(readFileSync(COMMENTS_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveComments(comments: Comments) {
  writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

// =============================================================================
// COMPONENT
// =============================================================================

function StageReview() {
  const { exit } = useApp();
  const [stageIdx, setStageIdx] = useState(0);
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comments>(loadComments);

  const stageProgress = [0.1, 0.3, 0.5, 0.7, 0.9];
  const stage = SUN_STAGES[stageIdx];
  const progress = stageProgress[stageIdx];
  const colors = getColors(progress);
  const stageComments = comments[stageIdx] || [];

  useInput((input, key) => {
    if (isCommenting) {
      if (key.escape) {
        setIsCommenting(false);
        setCommentText('');
      }
      return; // TextInput handles the rest
    }

    if (input === 'q' || input === 'Q') {
      exit();
      return;
    }

    if (key.return) {
      setIsCommenting(true);
      setCommentText('');
      return;
    }

    if (key.leftArrow || input === 'h') {
      setStageIdx(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow || input === 'l') {
      setStageIdx(prev => Math.min(SUN_STAGES.length - 1, prev + 1));
    }

    // Number keys to jump to stage
    const num = parseInt(input);
    if (!isNaN(num) && num >= 0 && num <= 4) {
      setStageIdx(num);
    }

    // Delete last comment with 'd'
    if (input === 'd' || input === 'D') {
      if (stageComments.length > 0) {
        const newComments = { ...comments };
        newComments[stageIdx] = stageComments.slice(0, -1);
        setComments(newComments);
        saveComments(newComments);
      }
    }
  });

  const handleCommentSubmit = (value: string) => {
    if (value.trim()) {
      const newComments = { ...comments };
      if (!newComments[stageIdx]) newComments[stageIdx] = [];
      newComments[stageIdx].push(value.trim());
      setComments(newComments);
      saveComments(newComments);
    }
    setIsCommenting(false);
    setCommentText('');
    // Auto-advance to next stage
    if (stageIdx < SUN_STAGES.length - 1) {
      setStageIdx(prev => prev + 1);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="#FFD700">Sun Stage Review</Text>
        <Text color="#666"> - Stage {stageIdx + 1}/5</Text>
      </Box>

      {/* Stage selector */}
      <Box marginBottom={1}>
        {SUN_STAGES.map((s, i) => {
          const hasComments = (comments[i] || []).length > 0;
          return (
            <Box key={i} marginRight={1}>
              <Text
                color={i === stageIdx ? '#FFD700' : hasComments ? '#00FF00' : '#444'}
                bold={i === stageIdx}
                backgroundColor={i === stageIdx ? '#333' : undefined}
              >
                {` ${i}${hasComments ? '*' : ' '}`}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Stage info */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="#FFA500">{stage.name}</Text>
        <Text color="#666">Progress: {stage.progress}</Text>
      </Box>

      {/* Sun art preview with background */}
      <Box flexDirection="column" backgroundColor={colors.sky} paddingX={4} paddingY={1}>
        {stage.art.map((line, i) => (
          <Text key={i} color={colors.sun} bold backgroundColor={colors.sky}>
            {line}
          </Text>
        ))}
      </Box>

      {/* Existing comments */}
      {stageComments.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#888">Comments:</Text>
          {stageComments.map((c, i) => (
            <Box key={i}>
              <Text color="#444">  {i + 1}. </Text>
              <Text color="#FFA500">{c}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Comment input or prompt */}
      <Box marginTop={1}>
        {isCommenting ? (
          <Box>
            <Text color="#00FF00">Comment: </Text>
            <TextInput
              value={commentText}
              onChange={setCommentText}
              onSubmit={handleCommentSubmit}
            />
          </Box>
        ) : (
          <Text color="#555">
            [Enter] Add comment | [←→/0-4] Navigate | [D] Delete last | [Q] Quit
          </Text>
        )}
      </Box>

      {/* File location */}
      <Box marginTop={1}>
        <Text color="#333">Comments saved to: tools/stage-comments.json</Text>
      </Box>
    </Box>
  );
}

// Run
render(<StageReview />);
