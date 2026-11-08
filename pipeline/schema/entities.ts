import { z } from 'zod';
import {
  BuildTag,
  CarClass,
  Category,
  Difficulty,
  Discipline,
  Drivetrain,
  Permission,
  Rarity,
  Season,
  Slug,
  SourceHealth,
  Surface,
  TireCompound,
  Tier,
} from './enums';

export const SCHEMA_VERSION = 1;

export const ShareCode = z.string().regex(/^\d{9}$/);

export const Car = z.object({
  id: Slug,
  year: z.number().int(),
  make: z.string(),
  model: z.string(),
  displayName: z.string(),
  carTypes: z.array(z.string()),
  country: z.string().optional(),
  stock: z.object({ class: CarClass, pi: z.number().int() }).optional(),
  rarity: Rarity.optional(),
  /** Stock drivetrain (Forza Wiki), used by "Total FWD/RWD/AWD" playlist restrictions. */
  drivetrain: Drivetrain.optional(),
  /** Photo (thumbnail URL on the Forza Wiki's image server), ADR-0013. */
  image: z.url().optional(),
  acquisition: z.object({ raw: z.string(), methods: z.array(Slug) }).optional(),
  addOns: z.string().optional(),
  sourceIds: z.array(Slug).min(1),
});
export type Car = z.infer<typeof Car>;

export const Tuner = z.object({
  id: Slug,
  displayName: z.string(),
  team: z.string().optional(),
  aliases: z.array(z.string()),
  tuneCount: z.number().int().nonnegative(),
});
export type Tuner = z.infer<typeof Tuner>;

/** Provenance of a record: which source, tab and row it came from (ADR-0005). */
export const Observation = z.object({
  sourceId: Slug,
  tab: Slug,
  row: z.number().int().positive(),
  raw: z.record(z.string(), z.string()),
});
export type Observation = z.infer<typeof Observation>;

/** A text in both site languages (translated from the source, ADR-0014). Empty = nothing to show. */
export const Localized = z.object({ 'pt-br': z.string(), en: z.string() });
export type Localized = z.infer<typeof Localized>;

/** A lap time quoted in a note ("白川1:04.3" → Shirakawa 1:04.3), track name in English. */
export const LapRef = z.object({
  track: z.string(),
  time: z.string(),
  worldRecord: z.boolean().optional(),
});
export type LapRef = z.infer<typeof LapRef>;

export const TuneRole = z.enum(['allround', 'power', 'handling']);

export const Tune = z.object({
  /** `sc-<share code>` or `nc-<hash>` for tunes without a share code (ADR-0006). */
  id: z.string().regex(/^(sc-\d{9}|nc-[0-9a-f]{10})$/),
  shareCode: ShareCode.optional(),
  carId: Slug,
  tunerId: Slug,
  name: z.string(),
  /** The name translated, when the tuner wrote it in another language (e.g. Chinese). */
  nameI18n: Localized.optional(),
  class: CarClass.nullable(),
  surface: Surface.nullable(),
  drivetrain: Drivetrain.optional(),
  tires: TireCompound.optional(),
  engine: z.string().optional(),
  buildTags: z.array(BuildTag),
  notes: z.string().optional(),
  createdAt: z.iso.date().optional(),
  observations: z.array(Observation).min(1),
  /**
   * Tier of the car in the tune's class × surface: from the meta table (Noa Miyako) or, when the
   * table does not list the car, the default tier (T3) until it does (owner's rule, CURATION.md).
   */
  tier: Tier.optional(),
  tierSource: z.enum(['meta-table', 'default']).optional(),
  /** Position of the car in the meta table for this class × surface. */
  metaRank: z.number().int().positive().optional(),
  /** The meta table credits this tune's tuner for this car. */
  credited: z.boolean().optional(),
  /** Internal 0–1 score, only used to break ties between tunes of the same tier. */
  score: z.number().min(0).max(1).optional(),
  /** Share of signal weight that had data (0–1). */
  confidence: z.number().min(0).max(1).optional(),
  categories: z.array(Category).optional(),
  /**
   * The tune exists only as a meta-table recommendation (car + tuner, no share code): players
   * find it in game by the tuner's gamertag.
   */
  fromMeta: z.boolean().optional(),
  /** From the meta-table row that credits this tune's tuner (difficulty, style, lap times). */
  difficulty: Difficulty.optional(),
  role: TuneRole.optional(),
  metaNotes: z.string().optional(),
  /** `metaNotes` translated (lap times left out: they are in `lapRefs`). */
  metaNotesI18n: Localized.optional(),
  lapRefs: z.array(LapRef).optional(),
});
export type Tune = z.infer<typeof Tune>;

/** Slim tune record for the global search index. */
export const TuneIndexEntry = Tune.pick({
  id: true,
  shareCode: true,
  carId: true,
  tunerId: true,
  name: true,
  class: true,
  surface: true,
  drivetrain: true,
  tires: true,
  buildTags: true,
  tier: true,
  tierSource: true,
  metaRank: true,
  credited: true,
  score: true,
  categories: true,
  fromMeta: true,
  difficulty: true,
  role: true,
  metaNotes: true,
  metaNotesI18n: true,
  nameI18n: true,
  lapRefs: true,
}).extend({ sourceIds: z.array(Slug).min(1) });
export type TuneIndexEntry = z.infer<typeof TuneIndexEntry>;

export const LapTime = z.object({
  sourceId: Slug,
  row: z.number().int().positive(),
  track: z.string(),
  class: CarClass,
  carId: Slug,
  timeMs: z.number().int().positive(),
  driver: z.string(),
  tunerId: Slug.optional(),
  tuneName: z.string().optional(),
  tierLabel: z.string().optional(),
  build: z.string().optional(),
  difficulty: Difficulty.optional(),
  tires: TireCompound.optional(),
  drivetrain: Drivetrain.optional(),
  engine: z.string().optional(),
  aero: z.string().optional(),
  notes: z.string().optional(),
});
export type LapTime = z.infer<typeof LapTime>;

export const CustomEventEntry = z.object({
  row: z.number().int().positive(),
  /** `route`: an event blueprint (track) shared by code; `carText` holds the route name. */
  kind: z.enum(['car', 'route']),
  label: z.string(),
  carText: z.string(),
  carId: Slug.nullable(),
  /** Tune share code for cars; event share code for routes. */
  tuneCode: ShareCode.optional(),
  liveryCode: ShareCode.optional(),
  liveryNote: z.string().optional(),
  pi: z.number().int().optional(),
  adjustableAero: z.boolean().optional(),
  drivetrain: Drivetrain.optional(),
  /** Tuner of the car, or creator of the route. */
  tunedBy: z.string().optional(),
});
export const CustomEvent = z.object({
  id: Slug,
  sourceId: Slug,
  organizer: z.string(),
  name: z.string(),
  groups: z.array(z.object({ name: z.string(), entries: z.array(CustomEventEntry) })),
});
export type CustomEvent = z.infer<typeof CustomEvent>;

/** One car in a meta ranking for a class × surface (e.g. Noa Miyako's "S1 800 Road"). */
export const MetaRanking = z.object({
  sourceId: Slug,
  tab: Slug,
  row: z.number().int().positive(),
  class: CarClass,
  surface: Surface,
  carId: Slug,
  tier: Tier,
  /** Position inside the ranking (1 = best). */
  rank: z.number().int().positive(),
  drivetrain: Drivetrain.optional(),
  difficulty: Difficulty.optional(),
  tires: TireCompound.optional(),
  role: TuneRole.optional(),
  /** Tuners whose tune is recommended for this car (search by gamertag in game). */
  tunerIds: z.array(Slug),
  shareCode: ShareCode.optional(),
  notes: z.string().optional(),
  /** Lap times quoted in the notes, with the track name translated (data/manual/track-aliases.yaml). */
  lapRefs: z.array(LapRef).optional(),
  /** `notes` translated (data/manual/translations.yaml); absent while not translated yet. */
  notesI18n: Localized.optional(),
});
export type MetaRanking = z.infer<typeof MetaRanking>;

export const PlaylistSeason = z.object({
  /** "s07-summer" */
  id: Slug,
  seriesId: Slug,
  series: z.number().int().positive(),
  seriesName: z.string(),
  season: Season,
  /** Position in the official table (chronological). */
  order: z.number().int().nonnegative(),
  startsOn: z.iso.date().optional(),
  endsOn: z.iso.date().optional(),
  /** Only the live season's dates are stated by forza.net; the rest are computed (1 week each). */
  datesDerived: z.boolean(),
  current: z.boolean(),
});
export type PlaylistSeason = z.infer<typeof PlaylistSeason>;

export const EventTarget = z.object({
  kind: z.enum(['speed', 'distance', 'time', 'score']),
  value: z.number(),
  unit: z.enum(['mph', 'ft', 's', 'pts']),
  raw: z.string(),
});
export type EventTarget = z.infer<typeof EventTarget>;

export const Requirement = z.object({
  status: z.enum(['parsed', 'partial', 'unparsed', 'no-car']),
  class: CarClass.optional(),
  scope: z.enum([
    'any',
    'car',
    'car-type',
    'make',
    'country',
    'family',
    'rarity',
    'drivetrain',
    'unknown',
  ]),
  scopeLabel: z.string().optional(),
  decade: z.number().int().optional(),
  drivetrain: Drivetrain.optional(),
  carIds: z.array(Slug).optional(),
  activities: z.array(z.string()).optional(),
  target: EventTarget.optional(),
  note: z.string().optional(),
});
export type Requirement = z.infer<typeof Requirement>;

export const PlaylistEvent = z.object({
  /** "<season id>--<type>--<name>" */
  id: z.string(),
  /** Season id, or the series id ("s07") for series-wide rows (series rewards, monthly rivals). */
  seasonId: Slug,
  seriesId: Slug,
  type: z.string(),
  category: z.enum([
    'championship',
    'trial',
    'weekly-challenge',
    'daily-challenge',
    'pr-stunt',
    'horizon-life',
    'rivals',
    'online',
    'photo',
    'treasure-hunt',
    'reward',
    'other',
  ]),
  name: z.string(),
  reward: z.string().optional(),
  requirementRaw: z.string(),
  /** The challenge text translated (data/manual/playlist-texts.yaml), for events without a car. */
  requirementI18n: Localized.optional(),
  requirement: Requirement,
  routeRaw: z.string(),
  routes: z.array(z.object({ name: z.string(), discipline: Discipline.optional() })),
  surface: Surface.nullable(),
  discipline: Discipline.optional(),
  /** Points shown for reward thresholds ("15 pts"). */
  points: z.number().int().optional(),
  row: z.number().int().positive(),
});
export type PlaylistEvent = z.infer<typeof PlaylistEvent>;

/**
 * A piece of news for the home page: a car whose tier went up, a new meta entry, a tune update
 * logged by the meta table, or a new car. Bigger upgrades get a bigger `magnitude` (more highlight).
 */
export const Highlight = z.object({
  id: z.string(),
  kind: z.enum(['tier-up', 'tier-down', 'new-entry', 'tune-update', 'new-car']),
  date: z.iso.date(),
  carId: Slug,
  class: CarClass,
  surface: Surface,
  tier: Tier,
  previousTier: Tier.optional(),
  tunerIds: z.array(Slug),
  sourceId: Slug,
  magnitude: z.number(),
});
export type Highlight = z.infer<typeof Highlight>;

/** One change between two syncs (DATA_MODEL: ChangeLogEntry). */
export const ChangeLogEntry = z.object({
  at: z.iso.datetime(),
  sourceId: Slug.optional(),
  kind: z.enum(['added', 'removed', 'tier-up', 'tier-down']),
  entity: z.object({ type: z.enum(['tune', 'meta-ranking']), id: z.string() }),
  carId: Slug,
  class: CarClass.nullable(),
  surface: Surface.nullable(),
  before: z.string().optional(),
  after: z.string().optional(),
});
export type ChangeLogEntry = z.infer<typeof ChangeLogEntry>;

/** A tune suggested for a Festival Playlist event, in one category (docs/CURATION.md §5). */
export const Suggestion = z.object({
  eventId: z.string(),
  seasonId: Slug,
  category: Category,
  tuneId: z.string(),
  carId: Slug,
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  /** i18n keys (+ params) explaining the pick, shown on the site. */
  reasons: z.array(
    z.object({
      key: z.string(),
      params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    }),
  ),
  origin: z.enum(['rules', 'ai']),
  /** No share code: find it in game by the tuner's gamertag. */
  needsGamertagSearch: z.boolean().optional(),
  commentary: z.object({ 'pt-br': z.string(), en: z.string() }).optional(),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const SourceStatus = z.object({
  id: Slug,
  name: z.string(),
  url: z.url(),
  permission: Permission,
  public: z.boolean(),
  status: SourceHealth,
  records: z.number().int().nonnegative(),
  usedSnapshot: z.boolean(),
  error: z.string().optional(),
  /** When this source's data last changed (not when it was last checked, to keep commits quiet). */
  lastChangedAt: z.iso.datetime().optional(),
});
export type SourceStatus = z.infer<typeof SourceStatus>;

export const ReviewKind = z.enum([
  'unmatched-car',
  'unmatched-tuner',
  'unknown-value',
  'unparsed-requirement',
  'untranslated-text',
]);
export const ReviewItem = z.object({
  kind: ReviewKind,
  sourceId: Slug,
  raw: z.string(),
  count: z.number().int().positive(),
  candidates: z.array(z.object({ id: Slug, similarity: z.number() })),
});
export type ReviewItem = z.infer<typeof ReviewItem>;

/** Envelope shared by every generated JSON file (DATA_MODEL §1). */
export const generatedFile = <T extends z.ZodType>(item: T) =>
  z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    generatedAt: z.iso.datetime(),
    items: z.array(item),
  });
