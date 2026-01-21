/**
 * Shared animation constants and functions
 * Used by both Animation.tsx and render-frames.ts
 */

export type Point = [number, number]; // [row, col] offset from center
export type CharLevel = 0 | 1 | 2 | 3 | 4;

// Character brightness levels
export const CHARS = [' ', '·', '•', '○', '●'] as const;

// Ring point generators
const RING_CARDINAL = (d: number): Point[] => [[0, -d], [0, d], [-d, 0], [d, 0]];
const RING_DIAGONAL = (d: number): Point[] => [[-d, -d], [-d, d], [d, -d], [d, d]];

// Ray characters for outer rings (lines instead of dots)
export const RAY_CHARS = {
  H: '─',  // horizontal
  V: '│',  // vertical
  D1: '╲', // diagonal \
  D2: '╱', // diagonal /
};

// Ring definitions - inner rings use dots, outer rings use lines
export const RING_DEFS: { distance: number; points: Point[]; baseLevel: CharLevel; isRay?: boolean }[] = [
  { distance: 0, points: [[0, 0]] as Point[], baseLevel: 4 as CharLevel },
  { distance: 1, points: [...RING_CARDINAL(1), ...RING_DIAGONAL(1)], baseLevel: 4 as CharLevel },
  { distance: 2, points: [...RING_CARDINAL(2), ...RING_DIAGONAL(2)], baseLevel: 4 as CharLevel },
  { distance: 3, points: [...RING_CARDINAL(3), ...RING_DIAGONAL(3)], baseLevel: 3 as CharLevel },
  { distance: 4, points: [...RING_CARDINAL(4), ...RING_DIAGONAL(4)], baseLevel: 3 as CharLevel },
  { distance: 5, points: [...RING_CARDINAL(5), ...RING_DIAGONAL(5)], baseLevel: 2 as CharLevel },
  { distance: 6, points: [...RING_CARDINAL(6), ...RING_DIAGONAL(6)], baseLevel: 2 as CharLevel },
  // Ray rings - use line characters
  { distance: 7, points: [...RING_CARDINAL(7), ...RING_DIAGONAL(7)], baseLevel: 1 as CharLevel, isRay: true },
  { distance: 8, points: [...RING_CARDINAL(8), ...RING_DIAGONAL(8)], baseLevel: 1 as CharLevel, isRay: true },
  { distance: 9, points: [...RING_CARDINAL(9), ...RING_DIAGONAL(9)], baseLevel: 1 as CharLevel, isRay: true },
  { distance: 10, points: [...RING_CARDINAL(10), ...RING_DIAGONAL(10)], baseLevel: 1 as CharLevel, isRay: true },
];

// Animation timing
export const ANIM = {
  TOTAL_FRAMES: 180,
  RISE_FRAMES: 120,
  MORPH_START: 120,
  MORPH_FRAMES: 60,
  PULSE_PERIOD: 18,
  PULSE_SPEED: 5,
  MAX_RING: 10,
  RING_BIRTH_FRAMES: [0, 6, 14, 24, 36, 50, 64, 78, 90, 102, 112],
  RING_FADE_DURATION: 10,
  FRAME_DELAY_MS: 50,
} as const;

// Theme types
export type ThemeKey = 'blood_red' | 'forest_green' | 'royal_blue' | 'royal_purple' | 'claude_orange';

export const THEME_NAMES: Record<ThemeKey, string> = {
  blood_red: 'Blood Red',
  forest_green: 'Forest Green',
  royal_blue: 'Royal Blue',
  royal_purple: 'Royal Purple',
  claude_orange: 'Claude Orange',
};

export const THEME_ORDER: ThemeKey[] = ['blood_red', 'forest_green', 'royal_blue', 'royal_purple', 'claude_orange'];

interface PaletteStep {
  t: number;
  sky: string;
  core: string;
  inner: string;
  outer: string;
}

interface GlowStep {
  t: number;
  glow: string;
}

// Blood Red - deep reds to orange/yellow (original sunrise)
const PALETTE_BLOOD_RED: PaletteStep[] = [
  { t: 0.00, sky: '#020101', core: '#180303', inner: '#100202', outer: '#080101' },
  { t: 0.10, sky: '#020101', core: '#1a0404', inner: '#120303', outer: '#0a0202' },
  { t: 0.15, sky: '#030201', core: '#2a0505', inner: '#1a0404', outer: '#0f0303' },
  { t: 0.22, sky: '#040302', core: '#3d0606', inner: '#280505', outer: '#160303' },
  { t: 0.30, sky: '#050403', core: '#550808', inner: '#380606', outer: '#1e0404' },
  { t: 0.38, sky: '#060504', core: '#700a08', inner: '#4a0808', outer: '#280505' },
  { t: 0.45, sky: '#080605', core: '#8a1008', inner: '#5e0a08', outer: '#320606' },
  { t: 0.50, sky: '#0a0706', core: '#a81808', inner: '#72100a', outer: '#3e0808' },
  { t: 0.55, sky: '#0c0807', core: '#c02808', inner: '#88180c', outer: '#4a0a0a' },
  { t: 0.62, sky: '#0e0a08', core: '#d83810', inner: '#a02410', outer: '#5a1010' },
  { t: 0.70, sky: '#100c09', core: '#e84c18', inner: '#b83214', outer: '#6c1414' },
  { t: 0.78, sky: '#140e0a', core: '#f56020', inner: '#cc4218', outer: '#801818' },
  { t: 0.85, sky: '#18100b', core: '#ff7428', inner: '#de521c', outer: '#942020' },
  { t: 0.90, sky: '#1c120c', core: '#ff9040', inner: '#ee6824', outer: '#aa2828' },
  { t: 0.95, sky: '#20140d', core: '#ffb060', inner: '#fc8030', outer: '#c03030' },
  { t: 1.00, sky: '#24160e', core: '#ffd080', inner: '#ffa040', outer: '#d84040' },
];

const GLOW_BLOOD_RED: GlowStep[] = [
  { t: 0.00, glow: '#2a0606' },
  { t: 0.10, glow: '#3a0808' },
  { t: 0.50, glow: '#aa2010' },
  { t: 0.85, glow: '#ff6030' },
  { t: 1.00, glow: '#ffe0a0' },
];

// Forest Green - deep forest to bright emerald
const PALETTE_FOREST_GREEN: PaletteStep[] = [
  { t: 0.00, sky: '#010201', core: '#031803', inner: '#021002', outer: '#010801' },
  { t: 0.10, sky: '#010201', core: '#041a04', inner: '#031203', outer: '#020a02' },
  { t: 0.15, sky: '#010302', core: '#052a05', inner: '#041a04', outer: '#030f03' },
  { t: 0.22, sky: '#020403', core: '#063d06', inner: '#052805', outer: '#031603' },
  { t: 0.30, sky: '#030504', core: '#085508', inner: '#063806', outer: '#041e04' },
  { t: 0.38, sky: '#040605', core: '#0a7008', inner: '#084a08', outer: '#052805' },
  { t: 0.45, sky: '#050806', core: '#108a10', inner: '#0a5e08', outer: '#063206' },
  { t: 0.50, sky: '#060a07', core: '#18a818', inner: '#107210', outer: '#083e08' },
  { t: 0.55, sky: '#070c08', core: '#28c028', inner: '#188818', outer: '#0a4a0a' },
  { t: 0.62, sky: '#080e0a', core: '#38d838', inner: '#24a020', outer: '#105a10' },
  { t: 0.70, sky: '#09100c', core: '#48e848', inner: '#32b830', outer: '#146c14' },
  { t: 0.78, sky: '#0a140e', core: '#60f560', inner: '#42cc40', outer: '#188018' },
  { t: 0.85, sky: '#0b1810', core: '#78ff78', inner: '#52de50', outer: '#209420' },
  { t: 0.90, sky: '#0c1c12', core: '#90ff90', inner: '#68ee68', outer: '#28aa28' },
  { t: 0.95, sky: '#0d2014', core: '#b0ffb0', inner: '#80fc80', outer: '#30c030' },
  { t: 1.00, sky: '#0e2416', core: '#d0ffd0', inner: '#a0ffa0', outer: '#40d840' },
];

const GLOW_FOREST_GREEN: GlowStep[] = [
  { t: 0.00, glow: '#062a06' },
  { t: 0.10, glow: '#083a08' },
  { t: 0.50, glow: '#20aa20' },
  { t: 0.85, glow: '#60ff60' },
  { t: 1.00, glow: '#a0ffe0' },
];

// Royal Blue - deep navy to bright azure
const PALETTE_ROYAL_BLUE: PaletteStep[] = [
  { t: 0.00, sky: '#010102', core: '#030318', inner: '#020210', outer: '#010108' },
  { t: 0.10, sky: '#010102', core: '#04041a', inner: '#030312', outer: '#02020a' },
  { t: 0.15, sky: '#010203', core: '#05052a', inner: '#04041a', outer: '#03030f' },
  { t: 0.22, sky: '#020304', core: '#06063d', inner: '#050528', outer: '#030316' },
  { t: 0.30, sky: '#030405', core: '#080855', inner: '#060638', outer: '#04041e' },
  { t: 0.38, sky: '#040506', core: '#0a0a70', inner: '#08084a', outer: '#050528' },
  { t: 0.45, sky: '#050608', core: '#10108a', inner: '#080a5e', outer: '#060632' },
  { t: 0.50, sky: '#06070a', core: '#1818a8', inner: '#101072', outer: '#08083e' },
  { t: 0.55, sky: '#07080c', core: '#2828c0', inner: '#181888', outer: '#0a0a4a' },
  { t: 0.62, sky: '#080a0e', core: '#3838d8', inner: '#2024a0', outer: '#10105a' },
  { t: 0.70, sky: '#090c10', core: '#4848e8', inner: '#3032b8', outer: '#14146c' },
  { t: 0.78, sky: '#0a0e14', core: '#6060f5', inner: '#4042cc', outer: '#181880' },
  { t: 0.85, sky: '#0b1018', core: '#7878ff', inner: '#5052de', outer: '#202094' },
  { t: 0.90, sky: '#0c121c', core: '#9090ff', inner: '#6868ee', outer: '#2828aa' },
  { t: 0.95, sky: '#0d1420', core: '#b0b0ff', inner: '#8080fc', outer: '#3030c0' },
  { t: 1.00, sky: '#0e1624', core: '#d0d0ff', inner: '#a0a0ff', outer: '#4040d8' },
];

const GLOW_ROYAL_BLUE: GlowStep[] = [
  { t: 0.00, glow: '#06062a' },
  { t: 0.10, glow: '#08083a' },
  { t: 0.50, glow: '#2020aa' },
  { t: 0.85, glow: '#6060ff' },
  { t: 1.00, glow: '#a0e0ff' },
];

// Royal Purple - deep violet to bright magenta
const PALETTE_ROYAL_PURPLE: PaletteStep[] = [
  { t: 0.00, sky: '#020102', core: '#180318', inner: '#100210', outer: '#080108' },
  { t: 0.10, sky: '#020102', core: '#1a041a', inner: '#120312', outer: '#0a020a' },
  { t: 0.15, sky: '#030103', core: '#2a052a', inner: '#1a041a', outer: '#0f030f' },
  { t: 0.22, sky: '#040204', core: '#3d063d', inner: '#280528', outer: '#160316' },
  { t: 0.30, sky: '#050305', core: '#550855', inner: '#380638', outer: '#1e041e' },
  { t: 0.38, sky: '#060406', core: '#700a70', inner: '#4a084a', outer: '#280528' },
  { t: 0.45, sky: '#080508', core: '#8a108a', inner: '#5e0a5e', outer: '#320632' },
  { t: 0.50, sky: '#0a060a', core: '#a818a8', inner: '#721072', outer: '#3e083e' },
  { t: 0.55, sky: '#0c070c', core: '#c028c0', inner: '#881888', outer: '#4a0a4a' },
  { t: 0.62, sky: '#0e080e', core: '#d838d8', inner: '#a024a0', outer: '#5a105a' },
  { t: 0.70, sky: '#100910', core: '#e848e8', inner: '#b832b8', outer: '#6c146c' },
  { t: 0.78, sky: '#140a14', core: '#f560f5', inner: '#cc42cc', outer: '#801880' },
  { t: 0.85, sky: '#180b18', core: '#ff78ff', inner: '#de52de', outer: '#942094' },
  { t: 0.90, sky: '#1c0c1c', core: '#ff90ff', inner: '#ee68ee', outer: '#aa28aa' },
  { t: 0.95, sky: '#200d20', core: '#ffb0ff', inner: '#fc80fc', outer: '#c030c0' },
  { t: 1.00, sky: '#240e24', core: '#ffd0ff', inner: '#ffa0ff', outer: '#d840d8' },
];

const GLOW_ROYAL_PURPLE: GlowStep[] = [
  { t: 0.00, glow: '#2a062a' },
  { t: 0.10, glow: '#3a083a' },
  { t: 0.50, glow: '#aa20aa' },
  { t: 0.85, glow: '#ff60ff' },
  { t: 1.00, glow: '#ffa0ff' },
];

// Claude Orange - deep burnt orange to bright Anthropic orange
const PALETTE_CLAUDE_ORANGE: PaletteStep[] = [
  { t: 0.00, sky: '#020101', core: '#180a03', inner: '#100602', outer: '#080301' },
  { t: 0.10, sky: '#020101', core: '#1a0c04', inner: '#120803', outer: '#0a0502' },
  { t: 0.15, sky: '#030201', core: '#2a1205', inner: '#1a0c04', outer: '#0f0703' },
  { t: 0.22, sky: '#040302', core: '#3d1a06', inner: '#281205', outer: '#160a03' },
  { t: 0.30, sky: '#050403', core: '#552408', inner: '#381a06', outer: '#1e1004' },
  { t: 0.38, sky: '#060504', core: '#70300a', inner: '#4a2408', outer: '#281605' },
  { t: 0.45, sky: '#080605', core: '#8a4010', inner: '#5e300a', outer: '#321c06' },
  { t: 0.50, sky: '#0a0706', core: '#a85018', inner: '#724010', outer: '#3e2408' },
  { t: 0.55, sky: '#0c0807', core: '#c06020', inner: '#885018', outer: '#4a2c0a' },
  { t: 0.62, sky: '#0e0a08', core: '#d87028', inner: '#a06020', outer: '#5a3410' },
  { t: 0.70, sky: '#100c09', core: '#e88030', inner: '#b87028', outer: '#6c3c14' },
  { t: 0.78, sky: '#140e0a', core: '#f59038', inner: '#cc8030', outer: '#804818' },
  { t: 0.85, sky: '#18100b', core: '#ffa040', inner: '#de9038', outer: '#945020' },
  { t: 0.90, sky: '#1c120c', core: '#ffb050', inner: '#eea040', outer: '#aa5828' },
  { t: 0.95, sky: '#20140d', core: '#ffc060', inner: '#fcb050', outer: '#c06030' },
  { t: 1.00, sky: '#24160e', core: '#ffd080', inner: '#ffc060', outer: '#d87040' },
];

const GLOW_CLAUDE_ORANGE: GlowStep[] = [
  { t: 0.00, glow: '#2a1206' },
  { t: 0.10, glow: '#3a1a08' },
  { t: 0.50, glow: '#aa5020' },
  { t: 0.85, glow: '#ff8040' },
  { t: 1.00, glow: '#ffc080' },
];

// Theme lookup tables
export const PALETTES: Record<ThemeKey, PaletteStep[]> = {
  blood_red: PALETTE_BLOOD_RED,
  forest_green: PALETTE_FOREST_GREEN,
  royal_blue: PALETTE_ROYAL_BLUE,
  royal_purple: PALETTE_ROYAL_PURPLE,
  claude_orange: PALETTE_CLAUDE_ORANGE,
};

export const GLOWS: Record<ThemeKey, GlowStep[]> = {
  blood_red: GLOW_BLOOD_RED,
  forest_green: GLOW_FOREST_GREEN,
  royal_blue: GLOW_ROYAL_BLUE,
  royal_purple: GLOW_ROYAL_PURPLE,
  claude_orange: GLOW_CLAUDE_ORANGE,
};

// Default exports for backwards compatibility
export const PALETTE = PALETTE_BLOOD_RED;
export const PULSE_GLOW = GLOW_BLOOD_RED;

// Clean 3x5 pixel font - compact and readable
export const BOLD_FONT: Record<string, string[]> = {
  'A': [' ● ', '● ●', '●●●', '● ●', '● ●'],
  'C': [' ●●', '●  ', '●  ', '●  ', ' ●●'],
  'E': ['●●●', '●  ', '●● ', '●  ', '●●●'],
  'G': [' ●●', '●  ', '● ●', '● ●', ' ●●'],
  'H': ['● ●', '● ●', '●●●', '● ●', '● ●'],
  'I': ['●●●', ' ● ', ' ● ', ' ● ', '●●●'],
  'J': ['  ●', '  ●', '  ●', '● ●', ' ● '],
  'K': ['● ●', '●● ', '●  ', '●● ', '● ●'],
  'L': ['●  ', '●  ', '●  ', '●  ', '●●●'],
  'M': ['● ●', '●●●', '● ●', '● ●', '● ●'],
  'N': ['● ●', '●●●', '●●●', '● ●', '● ●'],
  'O': [' ● ', '● ●', '● ●', '● ●', ' ● '],
  'S': ['●●●', '●  ', '●●●', '  ●', '●●●'],
  'T': ['●●●', ' ● ', ' ● ', ' ● ', ' ● '],
  'U': ['● ●', '● ●', '● ●', '● ●', '●●●'],
  'W': ['● ●', '● ●', '●●●', '●●●', '● ●'],
  ' ': [' ', ' ', ' ', ' ', ' '],
};

// Crescent moon shape (for countdown animation)
export function getMoonPoints(radius: number): Point[] {
  const points: Point[] = [];
  const innerRadius = radius * 0.75;
  const offsetC = radius * 0.5; // Offset the inner circle to the right

  for (let r = -radius; r <= radius; r++) {
    for (let c = -radius; c <= radius; c++) {
      const distOuter = r * r + c * c;
      const distInner = r * r + (c - offsetC) * (c - offsetC);

      // Point is in outer circle but not in offset inner circle
      if (distOuter <= radius * radius && distInner > innerRadius * innerRadius) {
        points.push([r, c]);
      }
    }
  }
  return points;
}

// 7-segment display font for time (classic alarm clock style)
// Segments: top, top-left, top-right, middle, bottom-left, bottom-right, bottom
export const SEGMENT_FONT: Record<string, string[]> = {
  '0': ['┌───┐', '│   │', '│   │', '│   │', '└───┘'],
  '1': ['    ╷', '    │', '    │', '    │', '    ╵'],
  '2': ['╶───┐', '    │', '┌───┘', '│    ', '└───╴'],
  '3': ['╶───┐', '    │', '╶───┤', '    │', '╶───┘'],
  '4': ['╷   ╷', '│   │', '└───┤', '    │', '    ╵'],
  '5': ['┌───╴', '│    ', '└───┐', '    │', '╶───┘'],
  '6': ['┌───╴', '│    ', '├───┐', '│   │', '└───┘'],
  '7': ['╶───┐', '    │', '    │', '    │', '    ╵'],
  '8': ['┌───┐', '│   │', '├───┤', '│   │', '└───┘'],
  '9': ['┌───┐', '│   │', '└───┤', '    │', '╶───┘'],
  ':': ['     ', '  ●  ', '     ', '  ●  ', '     '],
  ' ': ['     ', '     ', '     ', '     ', '     '],
};

// Color utilities
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

export function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

export interface Colors {
  sky: string;
  core: string;
  inner: string;
  outer: string;
  glow: string;
}

export function getColors(progress: number, theme: ThemeKey = 'blood_red'): Colors {
  const palette = PALETTES[theme];
  const glow = GLOWS[theme];

  let lo = palette[0], hi = palette[palette.length - 1];
  for (let i = 0; i < palette.length - 1; i++) {
    if (progress >= palette[i].t && progress <= palette[i + 1].t) {
      lo = palette[i]; hi = palette[i + 1]; break;
    }
  }
  const span = hi.t - lo.t;
  const local = span > 0 ? (progress - lo.t) / span : 0;

  let gLo = glow[0], gHi = glow[glow.length - 1];
  for (let i = 0; i < glow.length - 1; i++) {
    if (progress >= glow[i].t && progress <= glow[i + 1].t) {
      gLo = glow[i]; gHi = glow[i + 1]; break;
    }
  }
  const gSpan = gHi.t - gLo.t;
  const gLocal = gSpan > 0 ? (progress - gLo.t) / gSpan : 0;

  return {
    sky: lerpColor(lo.sky, hi.sky, local),
    core: lerpColor(lo.core, hi.core, local),
    inner: lerpColor(lo.inner, hi.inner, local),
    outer: lerpColor(lo.outer, hi.outer, local),
    glow: lerpColor(gLo.glow, gHi.glow, gLocal),
  };
}

// Animation functions
export function getRingVisibility(ringIndex: number, frame: number): number {
  if (ringIndex >= ANIM.RING_BIRTH_FRAMES.length) return 0;
  const birthFrame = ANIM.RING_BIRTH_FRAMES[ringIndex];
  if (frame < birthFrame) return 0;
  return Math.min(1, (frame - birthFrame) / ANIM.RING_FADE_DURATION);
}

export function getPulseIntensity(ringIndex: number, frame: number): number {
  const pulsePositions: number[] = [];
  for (let pulseStart = 0; pulseStart <= frame; pulseStart += ANIM.PULSE_PERIOD) {
    const pulseAge = frame - pulseStart;
    const pulseRing = pulseAge / ANIM.PULSE_SPEED;
    if (pulseRing <= ANIM.MAX_RING + 1) pulsePositions.push(pulseRing);
  }
  let maxIntensity = 0;
  for (const pulsePos of pulsePositions) {
    const distance = Math.abs(ringIndex - pulsePos);
    if (distance < 1.5) maxIntensity = Math.max(maxIntensity, 1 - distance / 1.5);
  }
  return maxIntensity;
}

// Get character for a ring point based on position (for ray rings)
export function getRayChar(dr: number, dc: number): string {
  if (dr === 0) return RAY_CHARS.H;           // horizontal
  if (dc === 0) return RAY_CHARS.V;           // vertical
  if (dr === dc) return RAY_CHARS.D1;         // diagonal \
  return RAY_CHARS.D2;                         // diagonal /
}

export function getRingChar(ringIndex: number, frame: number): string {
  const visibility = getRingVisibility(ringIndex, frame);
  if (visibility === 0) return ' ';
  const baseLevel = RING_DEFS[ringIndex]?.baseLevel ?? 1;
  const pulseBoost = Math.round(getPulseIntensity(ringIndex, frame) * 2);
  const fadeReduction = Math.round((1 - visibility) * 2);
  const finalLevel = Math.max(1, Math.min(4, baseLevel + pulseBoost - fadeReduction)) as CharLevel;
  return CHARS[finalLevel];
}

export function getRingColor(ringIndex: number, frame: number, colors: Colors): string {
  const pulseIntensity = getPulseIntensity(ringIndex, frame);
  const baseColor = ringIndex <= 1 ? colors.core : ringIndex <= 4 ? colors.inner : colors.outer;
  return pulseIntensity > 0 ? lerpColor(baseColor, colors.glow, pulseIntensity * 0.6) : baseColor;
}

export function buildSunForFrame(frame: number): string[] {
  const cappedFrame = Math.min(frame, ANIM.RISE_FRAMES);
  let maxVisibleRing = 0;
  for (let i = 0; i <= ANIM.MAX_RING; i++) {
    if (getRingVisibility(i, cappedFrame) > 0) maxVisibleRing = i;
  }
  const size = maxVisibleRing === 0 ? 1 : maxVisibleRing * 2 + 1;
  const center = Math.floor(size / 2);
  const grid: string[][] = [];
  for (let r = 0; r < size; r++) grid[r] = Array(size).fill(' ');

  for (let ringIdx = 0; ringIdx <= maxVisibleRing; ringIdx++) {
    const ringDef = RING_DEFS[ringIdx];
    if (!ringDef) continue;

    const visibility = getRingVisibility(ringIdx, cappedFrame);
    if (visibility === 0) continue;

    for (const [dr, dc] of ringDef.points) {
      const r = center + dr, c = center + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) {
        if (ringDef.isRay) {
          // Use line characters for ray rings, fade with visibility
          const char = visibility > 0.5 ? getRayChar(dr, dc) : '·';
          grid[r][c] = char;
        } else {
          const char = getRingChar(ringIdx, cappedFrame);
          if (char !== ' ') grid[r][c] = char;
        }
      }
    }
  }
  return grid.map(row => row.join(''));
}

// Text utilities
export function textToPointsBold(text: string, startCol = 0): Point[] {
  const points: Point[] = [];
  let col = startCol;
  for (const char of text.toUpperCase()) {
    const glyph = BOLD_FONT[char] || BOLD_FONT[' '];
    for (let row = 0; row < glyph.length; row++) {
      for (let c = 0; c < glyph[row].length; c++) {
        if (glyph[row][c] === '●') points.push([row, col + c]);
      }
    }
    col += (glyph[0]?.length || 3) + 1; // 1 column spacing between characters
  }
  return points;
}

export function timeToSegmentPoints(text: string, startCol = 0): { point: Point; char: string }[] {
  const points: { point: Point; char: string }[] = [];
  let col = startCol;
  for (const char of text) {
    const glyph = SEGMENT_FONT[char] || SEGMENT_FONT[' '];
    for (let row = 0; row < glyph.length; row++) {
      for (let c = 0; c < glyph[row].length; c++) {
        const ch = glyph[row][c];
        if (ch !== ' ') points.push({ point: [row, col + c], char: ch });
      }
    }
    col += (glyph[0]?.length || 5) + 1;
  }
  return points;
}

export function easeOutQuad(t: number): number {
  return 1 - Math.pow(1 - t, 2);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
