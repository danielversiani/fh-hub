import fs from 'node:fs';
import path from 'node:path';
import type { AdapterOutput } from '../adapters/types';
import { readJson, stableStringify, writeFileEnsuringDir } from '../lib/json';
import { generatedDir, reviewDir, snapshotsDir, type Visibility } from '../paths';
import {
  SCHEMA_VERSION,
  type Highlight,
  type SourceStatus,
  type Suggestion,
  type Tune,
  type TuneIndexEntry,
} from '../schema/entities';
import type { Dataset } from './dataset';

interface Envelope<T> {
  schemaVersion: number;
  generatedAt: string;
  items: T[];
}

export interface WriteReport {
  written: string[];
  removed: string[];
}

/** Writes `{schemaVersion, generatedAt, items}` only when `items` changed (no empty commits). */
function writeEnvelope<T>(file: string, items: T[], now: string, report: WriteReport): void {
  const previous = readJson<Envelope<T>>(file);
  if (
    previous?.schemaVersion === SCHEMA_VERSION &&
    stableStringify(previous.items) === stableStringify(items)
  ) {
    return;
  }
  writeFileEnsuringDir(
    file,
    stableStringify({ schemaVersion: SCHEMA_VERSION, generatedAt: now, items }),
  );
  report.written.push(file);
}

const toIndexEntry = (t: Tune): TuneIndexEntry => ({
  id: t.id,
  shareCode: t.shareCode,
  carId: t.carId,
  tunerId: t.tunerId,
  name: t.name,
  class: t.class,
  surface: t.surface,
  drivetrain: t.drivetrain,
  tires: t.tires,
  buildTags: t.buildTags,
  tier: t.tier,
  tierSource: t.tierSource,
  metaRank: t.metaRank,
  credited: t.credited,
  score: t.score,
  categories: t.categories,
  fromMeta: t.fromMeta,
  difficulty: t.difficulty,
  role: t.role,
  metaNotes: t.metaNotes,
  metaNotesI18n: t.metaNotesI18n,
  nameI18n: t.nameI18n,
  lapRefs: t.lapRefs,
  sourceIds: [...new Set(t.observations.map((o) => o.sourceId))].sort(),
});

/** Groups items by key into `<dir>/<key>.json` and deletes files whose key disappeared. */
function writeGroups<T>(
  dir: string,
  items: readonly T[],
  keyOf: (item: T) => string,
  now: string,
  report: WriteReport,
): void {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  for (const [key, group] of groups)
    writeEnvelope(path.join(dir, `${key}.json`), group, now, report);
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.json') && !groups.has(path.basename(file, '.json'))) {
      fs.rmSync(path.join(dir, file));
      report.removed.push(path.join(dir, file));
    }
  }
}

export function writeDataset(
  visibility: Visibility,
  dataset: Dataset,
  statuses: SourceStatus[],
  suggestions: Suggestion[],
  highlights: Highlight[],
  now = new Date().toISOString(),
): WriteReport {
  const report: WriteReport = { written: [], removed: [] };
  const out = generatedDir(visibility);
  writeEnvelope(path.join(out, 'cars.json'), dataset.cars, now, report);
  writeEnvelope(path.join(out, 'tuners.json'), dataset.tuners, now, report);
  writeEnvelope(path.join(out, 'laptimes.json'), dataset.lapTimes, now, report);
  writeEnvelope(path.join(out, 'rivals.json'), dataset.rivals, now, report);
  writeEnvelope(path.join(out, 'custom-events.json'), dataset.customEvents, now, report);
  writeEnvelope(path.join(out, 'sources-status.json'), statuses, now, report);
  writeEnvelope(
    path.join(out, 'tunes', 'index.json'),
    dataset.tunes.map(toIndexEntry),
    now,
    report,
  );
  writeGroups(path.join(out, 'tunes', 'by-car'), dataset.tunes, (t) => t.carId, now, report);
  writeGroups(path.join(out, 'meta'), dataset.meta, (m) => m.sourceId, now, report);
  writeEnvelope(path.join(out, 'playlist', 'seasons.json'), dataset.seasons, now, report);
  writeEnvelope(path.join(out, 'highlights.json'), highlights, now, report);
  writeGroups(path.join(out, 'playlist', 'events'), dataset.events, (e) => e.seasonId, now, report);
  writeGroups(
    path.join(out, 'playlist', 'suggestions'),
    suggestions,
    (s) => s.seasonId,
    now,
    report,
  );

  const review = reviewDir(visibility);
  const byKind = (kind: string) => dataset.review.filter((r) => r.kind === kind);
  writeEnvelope(path.join(review, 'unmatched-cars.json'), byKind('unmatched-car'), now, report);
  writeEnvelope(
    path.join(review, 'untranslated-texts.json'),
    byKind('untranslated-text'),
    now,
    report,
  );
  writeEnvelope(
    path.join(review, 'unparsed-requirements.json'),
    byKind('unparsed-requirement'),
    now,
    report,
  );
  writeEnvelope(
    path.join(review, 'unknown-values.json'),
    dataset.review.filter((r) => r.kind === 'unknown-value' || r.kind === 'unmatched-tuner'),
    now,
    report,
  );
  return report;
}

// --- snapshots ("último dado bom", ADR-0005) -------------------------------------------------

export interface Snapshot {
  schemaVersion: number;
  sourceId: string;
  records: number;
  output: AdapterOutput;
}

const snapshotFile = (v: Visibility, sourceId: string) =>
  path.join(snapshotsDir(v), `${sourceId}.json`);

export const readSnapshot = (v: Visibility, sourceId: string): Snapshot | undefined =>
  readJson<Snapshot>(snapshotFile(v, sourceId));

/** Returns true when the snapshot content changed. */
export function writeSnapshot(v: Visibility, snapshot: Snapshot): boolean {
  const file = snapshotFile(v, snapshot.sourceId);
  const content = stableStringify(snapshot);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  writeFileEnsuringDir(file, content);
  return true;
}

export function readStatuses(v: Visibility): SourceStatus[] {
  return (
    readJson<Envelope<SourceStatus>>(path.join(generatedDir(v), 'sources-status.json'))?.items ?? []
  );
}
