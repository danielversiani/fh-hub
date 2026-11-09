import fs from 'node:fs';
import path from 'node:path';
import { readJson, stableStringify, writeFileEnsuringDir } from '../lib/json';
import { generatedDir, type Visibility } from '../paths';
import type { Tier } from '../schema/enums';
import {
  SCHEMA_VERSION,
  type ChangeLogEntry,
  type ListEntry,
  type MetaRanking,
  type TuneIndexEntry,
} from '../schema/entities';
import type { Dataset } from './dataset';

const TIER_ORDER: readonly Tier[] = ['t3', 't2', 't1.5', 't1', 't0.5', 'meta', 'meta-plus'];
const rankingKey = (m: Pick<MetaRanking, 'sourceId' | 'carId' | 'class' | 'surface'>) =>
  `${m.sourceId}|${m.carId}|${m.class}|${m.surface}`;

function readItems<T>(file: string): T[] | undefined {
  return readJson<{ items: T[] }>(file)?.items;
}

/** Community list levels, worst to best (fhstats, LogikJ, Attax Johnson…). */
const LEVEL_ORDER: readonly ListEntry['level'][] = [
  'offmeta',
  'pick',
  'strong',
  'meta',
  'meta-plus',
];
const listKey = (e: Pick<ListEntry, 'sourceId' | 'carId' | 'class' | 'surface'>) =>
  `${e.sourceId}|${e.carId}|${e.class}|${e.surface}`;

function previousLists(dir: string): ListEntry[] | undefined {
  const listsDir = path.join(dir, 'lists');
  if (!fs.existsSync(listsDir)) return undefined;
  return fs
    .readdirSync(listsDir)
    .flatMap((f) => readItems<ListEntry>(path.join(listsDir, f)) ?? []);
}

/** Entries added, removed or moved in each community list (shown per list on the home page). */
function diffLists(dir: string, next: Dataset, now: string): ChangeLogEntry[] {
  const before = previousLists(dir);
  if (!before || before.length === 0) return [];
  const entries: ChangeLogEntry[] = [];
  const old = new Map(before.map((e) => [listKey(e), e]));
  const current = new Map(next.lists.map((e) => [listKey(e), e]));
  const base = (e: ListEntry) => ({
    at: now,
    sourceId: e.sourceId,
    entity: { type: 'list-entry' as const, id: listKey(e) },
    carId: e.carId,
    class: e.class,
    surface: e.surface,
  });
  for (const [key, e] of current) {
    const prev = old.get(key);
    if (!prev) entries.push({ ...base(e), kind: 'added', after: e.label });
    else if (prev.level !== e.level) {
      const up = LEVEL_ORDER.indexOf(e.level) > LEVEL_ORDER.indexOf(prev.level);
      entries.push({
        ...base(e),
        kind: up ? 'tier-up' : 'tier-down',
        before: prev.label,
        after: e.label,
      });
    }
  }
  for (const [key, e] of old) {
    if (!current.has(key)) entries.push({ ...base(e), kind: 'removed', before: e.label });
  }
  return entries;
}

function previousMeta(dir: string): MetaRanking[] | undefined {
  const metaDir = path.join(dir, 'meta');
  if (!fs.existsSync(metaDir)) return undefined;
  return fs
    .readdirSync(metaDir)
    .flatMap((f) => readItems<MetaRanking>(path.join(metaDir, f)) ?? []);
}

/**
 * Differences between the data already on disk and the new dataset (ARCHITECTURE §3.4):
 * tunes added/removed and meta tiers added/removed/moved. Without a previous dataset there is
 * no baseline, so nothing is reported (avoids thousands of "added" on the first run).
 */
export function diffDataset(visibility: Visibility, next: Dataset, now: string): ChangeLogEntry[] {
  const dir = generatedDir(visibility);
  const entries: ChangeLogEntry[] = [];

  const before = readItems<TuneIndexEntry>(path.join(dir, 'tunes', 'index.json'));
  if (before && before.length > 0) {
    const old = new Map(before.map((t) => [t.id, t]));
    const current = new Map(next.tunes.map((t) => [t.id, t]));
    for (const t of next.tunes) {
      if (!old.has(t.id)) {
        entries.push({
          at: now,
          sourceId: t.observations[0]?.sourceId,
          kind: 'added',
          entity: { type: 'tune', id: t.id },
          carId: t.carId,
          class: t.class,
          surface: t.surface,
          after: t.name,
        });
      }
    }
    for (const t of before) {
      if (!current.has(t.id)) {
        entries.push({
          at: now,
          sourceId: t.sourceIds[0],
          kind: 'removed',
          entity: { type: 'tune', id: t.id },
          carId: t.carId,
          class: t.class,
          surface: t.surface,
          before: t.name,
        });
      }
    }
  }

  const metaBefore = previousMeta(dir);
  if (metaBefore && metaBefore.length > 0) {
    const old = new Map(metaBefore.map((m) => [rankingKey(m), m]));
    const current = new Map(next.meta.map((m) => [rankingKey(m), m]));
    for (const [key, m] of current) {
      const prev = old.get(key);
      const base = {
        at: now,
        sourceId: m.sourceId,
        entity: { type: 'meta-ranking' as const, id: key },
        carId: m.carId,
        class: m.class,
        surface: m.surface,
      };
      if (!prev) entries.push({ ...base, kind: 'added', after: m.tier });
      else if (prev.tier !== m.tier) {
        const up = TIER_ORDER.indexOf(m.tier) > TIER_ORDER.indexOf(prev.tier);
        entries.push({
          ...base,
          kind: up ? 'tier-up' : 'tier-down',
          before: prev.tier,
          after: m.tier,
        });
      }
    }
    for (const [key, m] of old) {
      if (!current.has(key)) {
        entries.push({
          at: now,
          sourceId: m.sourceId,
          kind: 'removed',
          entity: { type: 'meta-ranking', id: key },
          carId: m.carId,
          class: m.class,
          surface: m.surface,
          before: m.tier,
        });
      }
    }
  }
  entries.push(...diffLists(dir, next, now));
  return entries.sort(
    (a, b) => a.entity.type.localeCompare(b.entity.type) || a.entity.id.localeCompare(b.entity.id),
  );
}

/** Appends entries to `changelog/<YYYY-MM>.json`. Returns the file when something was written. */
export function appendChangelog(
  visibility: Visibility,
  entries: ChangeLogEntry[],
  now: string,
): string | undefined {
  if (entries.length === 0) return undefined;
  const file = path.join(generatedDir(visibility), 'changelog', `${now.slice(0, 7)}.json`);
  const items = [...(readItems<ChangeLogEntry>(file) ?? []), ...entries];
  writeFileEnsuringDir(
    file,
    stableStringify({ schemaVersion: SCHEMA_VERSION, generatedAt: now, items }),
  );
  return file;
}
