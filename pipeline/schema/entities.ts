import { z } from 'zod';
import {
  BuildTag,
  CarClass,
  Difficulty,
  Drivetrain,
  Permission,
  Slug,
  SourceHealth,
  Surface,
  TireCompound,
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

export const Tune = z.object({
  /** `sc-<share code>` or `nc-<hash>` for tunes without a share code (ADR-0006). */
  id: z.string().regex(/^(sc-\d{9}|nc-[0-9a-f]{10})$/),
  shareCode: ShareCode.optional(),
  carId: Slug,
  tunerId: Slug,
  name: z.string(),
  class: CarClass.nullable(),
  surface: Surface.nullable(),
  drivetrain: Drivetrain.optional(),
  tires: TireCompound.optional(),
  engine: z.string().optional(),
  buildTags: z.array(BuildTag),
  notes: z.string().optional(),
  createdAt: z.iso.date().optional(),
  observations: z.array(Observation).min(1),
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
  buildTags: true,
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

export const ReviewKind = z.enum(['unmatched-car', 'unmatched-tuner', 'unknown-value']);
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
