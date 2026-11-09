import { z } from 'zod';

/** Lowercase slug used for every stable identifier (ADR-0006). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const Slug = z.string().regex(SLUG_PATTERN, 'must be a lowercase slug');

export const CAR_CLASSES = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'] as const;
export const CarClass = z.enum(CAR_CLASSES);
export type CarClass = z.infer<typeof CarClass>;

/** Upper PI bound of each class. */
export const CLASS_MAX_PI: Readonly<Record<CarClass, number>> = {
  D: 400,
  C: 500,
  B: 600,
  A: 700,
  S1: 800,
  S2: 900,
  R: 998,
  X: 999,
};

export const Surface = z.enum(['road', 'dirt', 'cross-country']);
export type Surface = z.infer<typeof Surface>;

/** Event format, separate from the surface (DATA_MODEL §2). */
export const Discipline = z.enum([
  'circuit',
  'sprint',
  'street',
  'touge',
  'drag',
  'drift',
  'speed-trap',
  'speed-zone',
  'danger-sign',
  'trailblazer',
  'time-attack',
  'other',
]);
export type Discipline = z.infer<typeof Discipline>;

export const Season = z.enum(['summer', 'autumn', 'winter', 'spring']);
export type Season = z.infer<typeof Season>;

export const Drivetrain = z.enum(['FWD', 'RWD', 'AWD']);
export type Drivetrain = z.infer<typeof Drivetrain>;

export const TireCompound = z.enum([
  'stock',
  'street',
  'sport',
  'semi-slick',
  'slick',
  'super-slick',
  'rally',
  'offroad',
  'snow',
  'drift',
  'drag',
  'vintage',
  'vintage-race',
  'other',
]);
export type TireCompound = z.infer<typeof TireCompound>;

export const BuildTag = z.enum([
  'purist',
  'stock-look',
  'full-aero',
  'powerbuild',
  'engine-swap',
  'drivetrain-swap',
]);
export type BuildTag = z.infer<typeof BuildTag>;

/** How a community list rates a car (lists without tiers just "pick" it). */
export const ListLevel = z.enum(['meta-plus', 'meta', 'strong', 'offmeta', 'pick']);
export type ListLevel = z.infer<typeof ListLevel>;

export const TuneStyle = z.enum(['allround', 'power', 'handling']);
export type TuneStyle = z.infer<typeof TuneStyle>;

export const Tier = z.enum(['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3']);
export type Tier = z.infer<typeof Tier>;

/**
 * The platform's own ranking of a car in a class × surface (ADR-0017), replacing the meta table's
 * tiers as the site's main ranking: Meta+, Meta, Off-meta (competitive alternative), Niche (strong
 * in specific events; set by hand, data/manual/tier-overrides.yaml) and Other (cited, but below the
 * others, or mostly pure handling / speed builds). "Good for Rivals" is a tag on top of the tier.
 */
export const PlatformTier = z.enum(['meta-plus', 'meta', 'off-meta', 'niche', 'other']);
export type PlatformTier = z.infer<typeof PlatformTier>;

export const Difficulty = z.enum(['easy', 'normal', 'slightly-hard', 'hard', 'very-hard']);
export type Difficulty = z.infer<typeof Difficulty>;

export const Category = z.enum(['meta', 'off-meta', 'purist', 'meme']);
export type Category = z.infer<typeof Category>;

/** In-game car rarity (Autoshow / Wheelspin). Some playlist events restrict it. */
export const Rarity = z.enum(['common', 'rare', 'epic', 'legendary', 'forza-edition']);
export type Rarity = z.infer<typeof Rarity>;

export const SourceKind = z.enum([
  'wiki',
  'google-sheet',
  'google-xlsx',
  'qq-doc',
  'forza-official',
  'website',
  'manual',
]);
export type SourceKind = z.infer<typeof SourceKind>;

/** `public`: public community source, published with credit; authors can opt out (ADR-0016). */
export const Permission = z.enum(['granted', 'public', 'pending', 'denied', 'not-required']);
export type Permission = z.infer<typeof Permission>;

export const SourceHealth = z.enum(['healthy', 'degraded', 'failing']);
export type SourceHealth = z.infer<typeof SourceHealth>;
