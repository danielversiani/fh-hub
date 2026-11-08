import type { CarClass, Surface } from '../schema/enums';
import type { SourceDef } from '../schema/source';
import type { Table } from '../lib/table';

/** How a source refers to a car. The resolver turns it into a canonical car id (ADR-0006). */
export interface CarRef {
  text: string;
  year?: number;
  make?: string;
  model?: string;
}

/** A tune as read from a source, before normalization. Values are kept as source text. */
export interface RawTune {
  tab: string;
  row: number;
  car: CarRef;
  tuner: string;
  name: string;
  /** Class already known with certainty (e.g. from the tab or the cell colour). */
  carClass?: CarClass | null;
  classText?: string;
  surfaceText?: string;
  drivetrain?: string;
  tires?: string;
  engine?: string;
  build?: string;
  notes?: string;
  shareCode?: string;
  createdAt?: string;
  raw: Record<string, string>;
}

export interface CatalogCar {
  year: number;
  make: string;
  model: string;
  displayName: string;
  carTypes: string[];
  country?: string;
  stockClass?: CarClass;
  stockPi?: number;
  acquisitionRaw?: string;
  addOns?: string;
}

export interface RawLapTime {
  tab: string;
  row: number;
  car: CarRef;
  track: string;
  carClass: CarClass;
  time: string;
  driver: string;
  tuner?: string;
  tuneName?: string;
  tierLabel?: string;
  build?: string;
  difficulty?: string;
  tires?: string;
  drivetrain?: string;
  engine?: string;
  aero?: string;
  notes?: string;
}

export interface RawCustomEventEntry {
  row: number;
  /** `route`: an event blueprint (track) shared by code, not a car. */
  kind: 'car' | 'route';
  label: string;
  car: CarRef;
  tuneCode?: string;
  livery?: string;
  pi?: string;
  adjustableAero?: string;
  drivetrain?: string;
  tunedBy?: string;
}

export interface RawCustomEvent {
  id: string;
  organizer: string;
  name: string;
  groups: { name: string; entries: RawCustomEventEntry[] }[];
}

/** One row of the official Festival Playlist table (forza.net/fh6playlists). */
export interface RawPlaylistRow {
  row: number;
  /** "S07 City Life - Summer" (a season) or "S07 City Life" (series-wide rows). */
  seasonLabel: string;
  reward: string;
  type: string;
  name: string;
  requirement: string;
  route: string;
}

export interface RawPlaylist {
  /** Season the page says is live, e.g. "City Life - Summer". */
  currentSeasonLabel?: string;
  /** Last day of the live season as written on the page, e.g. "November 12". */
  currentSeasonEnds?: string;
  /** When forza.net last updated the page (ISO). */
  updatedAt?: string;
  rows: RawPlaylistRow[];
}

/** One car in a meta ranking (e.g. Noa Miyako's table for "S1 800 Road"). */
export interface RawMetaEntry {
  tab: string;
  row: number;
  carClass: CarClass;
  surface: Surface;
  car: CarRef;
  /** Tier as written: "Meta+", "Meta", "T0.5", "T1"… */
  tier: string;
  /** Position inside the table (1 = best). */
  rank: number;
  drivetrain?: string;
  difficulty?: string;
  tires?: string;
  /** Tune profile as written ("全能" all-round, "动力" power, "操控" handling). */
  role?: string;
  /** Tuners whose tune for this car is recommended (search them in game by gamertag). */
  tuners: string[];
  shareCode?: string;
  notes?: string;
  raw: Record<string, string>;
}

/** A fact about an existing car from a non-catalog source (e.g. its rarity from the wiki). */
export interface RawCarAttribute {
  tab: string;
  row: number;
  car: CarRef;
  rarity?: string;
  /** Stock drivetrain: FWD, RWD or AWD. */
  drivetrain?: string;
  /** Photo of the car (thumbnail URL), ADR-0013. */
  image?: string;
}

/** A dated "news" row of a meta table: a car whose tune/tier was updated, or a new car. */
export interface RawMetaUpdate {
  tab: string;
  row: number;
  kind: 'update' | 'new-car';
  carClass: CarClass;
  surface: Surface;
  car: CarRef;
  tier: string;
  tuners: string[];
  /** ISO date when the table states it (Noa's update log does; the new-cars tab does not). */
  date?: string;
  notes?: string;
}

/** Everything an adapter can extract. This object is also the per-source snapshot. */
export interface AdapterOutput {
  catalog: CatalogCar[];
  tunes: RawTune[];
  lapTimes: RawLapTime[];
  customEvents: RawCustomEvent[];
  playlists: RawPlaylist[];
  meta: RawMetaEntry[];
  metaUpdates: RawMetaUpdate[];
  carAttributes: RawCarAttribute[];
  warnings: string[];
}

export type TabPayload =
  | { kind: 'table'; rows: Table }
  | { kind: 'workbook'; bytes: Buffer }
  | { kind: 'json'; data: unknown };

export interface AdapterInput {
  source: SourceDef;
  tabs: Record<string, TabPayload>;
}

export interface Adapter {
  id: string;
  parse(input: AdapterInput): AdapterOutput | Promise<AdapterOutput>;
}

export const emptyOutput = (): AdapterOutput => ({
  catalog: [],
  tunes: [],
  lapTimes: [],
  customEvents: [],
  playlists: [],
  meta: [],
  metaUpdates: [],
  carAttributes: [],
  warnings: [],
});

/** Fills fields added after a snapshot was written, so old snapshots stay readable. */
export const withDefaults = (o: Partial<AdapterOutput>): AdapterOutput => ({
  ...emptyOutput(),
  ...o,
});

export const countRecords = (o: AdapterOutput): number =>
  o.catalog.length +
  o.tunes.length +
  o.lapTimes.length +
  o.customEvents.reduce((n, e) => n + e.groups.reduce((m, g) => m + g.entries.length, 0), 0) +
  o.playlists.reduce((n, p) => n + p.rows.length, 0) +
  o.meta.length +
  o.metaUpdates.length +
  o.carAttributes.length;

export function requireTab<K extends TabPayload['kind']>(
  input: AdapterInput,
  tabId: string,
  kind: K,
): Extract<TabPayload, { kind: K }> {
  const payload = input.tabs[tabId];
  if (!payload) throw new Error(`[${input.source.id}] missing tab payload "${tabId}"`);
  if (payload.kind !== kind) {
    throw new Error(`[${input.source.id}/${tabId}] expected ${kind} payload, got ${payload.kind}`);
  }
  return payload as Extract<TabPayload, { kind: K }>;
}
