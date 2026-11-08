import type { CarClass } from '../schema/enums';
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

/** Everything an adapter can extract. This object is also the per-source snapshot. */
export interface AdapterOutput {
  catalog: CatalogCar[];
  tunes: RawTune[];
  lapTimes: RawLapTime[];
  customEvents: RawCustomEvent[];
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
  warnings: [],
});

export const countRecords = (o: AdapterOutput): number =>
  o.catalog.length +
  o.tunes.length +
  o.lapTimes.length +
  o.customEvents.reduce((n, e) => n + e.groups.reduce((m, g) => m + g.entries.length, 0), 0);

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
