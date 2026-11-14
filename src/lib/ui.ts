import type { CarClass, Difficulty, PlatformTier, Rarity, Tier } from '../../pipeline/schema/enums';

/** In-game class colours (also used by kleis' sheet). */
export const CLASS_COLORS: Readonly<Record<CarClass, string>> = {
  D: '#3d9be0',
  C: '#d9a400',
  B: '#e8742a',
  A: '#e23b3b',
  S1: '#8f4fd6',
  S2: '#1f6fd6',
  R: '#d6339b',
  X: '#2ea043',
};

export const TIER_COLORS: Readonly<Record<Tier, string>> = {
  'meta-plus': '#d6336c',
  meta: '#e8742a',
  't0.5': '#2ea043',
  t1: '#1f6fd6',
  't1.5': '#0f9aa8',
  t2: '#6e7781',
  t3: '#9aa1a9',
};

/** The platform's own tiers (ADR-0017): the site's main ranking. */
export const PLATFORM_TIER_ORDER: readonly PlatformTier[] = [
  'meta-plus',
  'meta',
  'off-meta',
  'niche',
  'other',
];
export const PLATFORM_TIER_COLORS: Readonly<Record<PlatformTier, string>> = {
  'meta-plus': '#d6336c',
  meta: '#e8742a',
  'off-meta': '#2ea043',
  niche: '#8957e5',
  other: '#6e7781',
};

export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  'meta-plus': 'Meta+',
  meta: 'Meta',
  't0.5': 'T0.5',
  t1: 'T1',
  't1.5': 'T1.5',
  t2: 'T2',
  t3: 'T3',
};

/** Rarity tag colours, close to the game's tags. */
export const RARITY_COLORS: Readonly<Record<Rarity, string>> = {
  common: '#3fb950',
  rare: '#2f81f7',
  epic: '#a371f7',
  legendary: '#e3a008',
  'forza-edition': '#ff3d9a',
};

/** Tune difficulty, from relaxed (green) to demanding (red). */
export const DIFFICULTY_COLORS: Readonly<Record<Difficulty, string>> = {
  'brain-afk': '#22d3ee',
  'very-easy': '#4ade80',
  easy: '#a3e635',
  medium: '#facc15',
  hard: '#fb923c',
  death: '#f87171',
};

export const CLASS_ORDER: readonly CarClass[] = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'];

/** "773309331" → "773 309 331" */
export const formatShareCode = (code: string): string => code.replace(/(\d{3})(?=\d)/g, '$1 ');

export const formatLapTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(3).padStart(6, '0');
  return `${minutes}:${seconds}`;
};
