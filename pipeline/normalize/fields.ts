import {
  CAR_CLASSES,
  type BuildTag,
  type CarClass,
  type Difficulty,
  type Drivetrain,
  type Surface,
  type Tier,
  type TireCompound,
} from '../schema/enums';

const CLASS_SET = new Set<string>(CAR_CLASSES);

/** Explicit class fields: "A", "S1 800", "Class S1", "100 D", "A700". */
export function parseClass(text: string | undefined): CarClass | undefined {
  for (const raw of (text ?? '').toUpperCase().split(/[^A-Z0-9]+/)) {
    const token = raw.replace(/^\d{3}(?=[A-Z])/, '').replace(/(?<=[A-Z0-9])\d{3}$/, '');
    if (CLASS_SET.has(token)) return token as CarClass;
  }
  return undefined;
}

/** Class written as the first word of a tune name: "C Road Purist", "S1 Dirt", "A700 Grip". */
export function parseClassPrefix(name: string | undefined): CarClass | undefined {
  const match = /^\s*(S1|S2|[DCBARX])(?=\s|\d{3}\b|$)/i.exec(name ?? '');
  return match ? (match[1]!.toUpperCase() as CarClass) : undefined;
}

export function parseDrivetrain(text: string | undefined): Drivetrain | undefined {
  const match = /\b(AWD|RWD|FWD)\b/i.exec(text ?? '');
  return match ? (match[1]!.toUpperCase() as Drivetrain) : undefined;
}

/** Share codes have exactly 9 digits; sources write them with or without spaces. */
export function parseShareCode(text: string | undefined): string | undefined {
  const digits = (text ?? '').replace(/\D/g, '');
  return /^\d{9}$/.test(digits) && /^[\d\s]+$/.test((text ?? '').trim()) ? digits : undefined;
}

const TIRES: Record<string, TireCompound> = {
  stock: 'stock',
  standard: 'stock',
  street: 'street',
  sport: 'sport',
  'semi slick': 'semi-slick',
  'semi slicks': 'semi-slick',
  slick: 'slick',
  slicks: 'slick',
  race: 'slick',
  'super slick': 'super-slick',
  'super slicks': 'super-slick',
  rally: 'rally',
  offroad: 'offroad',
  'off road': 'offroad',
  snow: 'snow',
  drift: 'drift',
  drag: 'drag',
  vintage: 'vintage',
  'vintage race': 'vintage-race',
  // Noa Miyako's sheet (Chinese). 热熔 ("hot-melt") is the community word for slicks.
  原厂胎: 'stock',
  街车胎: 'street',
  半热熔: 'semi-slick',
  全热熔: 'slick',
  赛用热熔: 'super-slick',
  拉力胎: 'rally',
  越野胎: 'offroad',
  雪地胎: 'snow',
  漂移胎: 'drift',
  复古白胎: 'vintage',
  怀旧胎: 'vintage',
};

export function parseTires(text: string | undefined): TireCompound | undefined {
  const key = (text ?? '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!key) return undefined;
  return TIRES[key] ?? 'other';
}

const ROAD_TIRES = new Set<TireCompound>([
  'stock',
  'street',
  'sport',
  'semi-slick',
  'slick',
  'super-slick',
  'vintage',
  'vintage-race',
  'drag',
]);

/**
 * Surface from (1) an explicit column, (2) keywords in the tune name, (3) road-only tyres.
 * Returns null when the data is genuinely ambiguous (e.g. "Dirt/CC" with no hint in the name):
 * an honest "unknown" is better than a wrong guess.
 */
export function inferSurface(input: {
  explicit?: string | undefined;
  name?: string | undefined;
  tires?: TireCompound | undefined;
}): Surface | null {
  const explicit = (input.explicit ?? '').toLowerCase();
  const mentionsDirt = /dirt|rally|gravel/.test(explicit);
  const mentionsCross = /cross|off-?road|\bcc\b/.test(explicit);
  if (mentionsCross && !mentionsDirt) return 'cross-country';
  if (mentionsDirt && !mentionsCross) return 'dirt';
  if (/road|street|asphalt|tarmac/.test(explicit)) return 'road';

  const name = (input.name ?? '').toLowerCase();
  if (/\b(cc|cross ?country|off-?road|xc)\b/.test(name)) return 'cross-country';
  if (/\b(dirt|rally|gravel)\b/.test(name)) return 'dirt';
  if (/\b(road|street|circuit|touge|track|grip|highway|drag)\b/.test(name)) return 'road';

  if (!explicit && input.tires && ROAD_TIRES.has(input.tires)) return 'road';
  // Rally tires mean dirt. Off-road tires stay ambiguous (dirt or cross country): no guess.
  if (!explicit && input.tires === 'rally') return 'dirt';
  return null;
}

export function parseBuildTags(...texts: (string | undefined)[]): BuildTag[] {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  const tags = new Set<BuildTag>();
  if (/purist/.test(text)) tags.add('purist');
  if (/stock ?look/.test(text)) tags.add('stock-look');
  if (/full ?aero/.test(text)) tags.add('full-aero');
  if (/power ?build/.test(text)) tags.add('powerbuild');
  if (/engine swap/.test(text)) tags.add('engine-swap');
  if (/\b(awd|rwd|fwd|drivetrain) swap/.test(text)) tags.add('drivetrain-swap');
  return [...tags].sort();
}

const DIFFICULTY: Record<string, Difficulty> = {
  'brain afk': 'easy',
  'very easy': 'easy',
  easy: 'easy',
  medium: 'normal',
  normal: 'normal',
  'slightly hard': 'slightly-hard',
  hard: 'hard',
  'very hard': 'very-hard',
  // Noa Miyako's sheet (Chinese)
  非常简单: 'easy',
  简单: 'easy',
  普通: 'normal',
  中等: 'normal',
  稍微困难: 'slightly-hard',
  困难: 'hard',
  非常困难: 'very-hard',
};

export const parseDifficulty = (text: string | undefined): Difficulty | undefined =>
  DIFFICULTY[(text ?? '').trim().toLowerCase()];

const TIERS: Record<string, Tier> = {
  'meta+': 'meta-plus',
  meta: 'meta',
  't0.5': 't0.5',
  t1: 't1',
  't1.5': 't1.5',
  t2: 't2',
  t3: 't3',
};

/** "Meta+", "T0.5"… → Tier. Unknown values (e.g. Noa's 未知 = "not rated yet") → undefined. */
export const parseTier = (text: string | undefined): Tier | undefined =>
  TIERS[(text ?? '').trim().toLowerCase().replace(/\s+/g, '')];

export type TuneRole = 'allround' | 'power' | 'handling';
const ROLES: Record<string, TuneRole> = {
  全能: 'allround',
  动力: 'power',
  操控: 'handling',
  allround: 'allround',
  power: 'power',
  handling: 'handling',
};
export const parseRole = (text: string | undefined): TuneRole | undefined =>
  ROLES[(text ?? '').trim().toLowerCase()];

/** "0:59.227" or "59.2" → milliseconds. */
export function parseLapTime(text: string | undefined): number | undefined {
  const match = /^(?:(\d+):)?(\d{1,2})\.(\d{1,3})$/.exec((text ?? '').trim());
  if (!match) return undefined;
  const [, minutes = '0', seconds = '0', fraction = '0'] = match;
  return (Number(minutes) * 60 + Number(seconds)) * 1000 + Number(fraction.padEnd(3, '0'));
}

/** "26/07/2026" (day first, as used by GBR Ozzy) → "2026-07-26". */
export function parseDayFirstDate(text: string | undefined): string | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((text ?? '').trim());
  if (!match) return undefined;
  const [, d = '', m = '', y = ''] = match;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

export function parseInteger(text: string | undefined): number | undefined {
  const digits = (text ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}
