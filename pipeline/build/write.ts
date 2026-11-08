import fs from 'node:fs';
import path from 'node:path';
import type { AdapterOutput } from '../adapters/types';
import { readJson, stableStringify, writeFileEnsuringDir } from '../lib/json';
import { generatedDir, reviewDir, snapshotsDir, type Visibility } from '../paths';
import {
  SCHEMA_VERSION,
  type SourceStatus,
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
  buildTags: t.buildTags,
  sourceIds: [...new Set(t.observations.map((o) => o.sourceId))].sort(),
});

export function writeDataset(
  visibility: Visibility,
  dataset: Dataset,
  statuses: SourceStatus[],
  now = new Date().toISOString(),
): WriteReport {
  const report: WriteReport = { written: [], removed: [] };
  const out = generatedDir(visibility);
  writeEnvelope(path.join(out, 'cars.json'), dataset.cars, now, report);
  writeEnvelope(path.join(out, 'tuners.json'), dataset.tuners, now, report);
  writeEnvelope(path.join(out, 'laptimes.json'), dataset.lapTimes, now, report);
  writeEnvelope(path.join(out, 'custom-events.json'), dataset.customEvents, now, report);
  writeEnvelope(path.join(out, 'sources-status.json'), statuses, now, report);
  writeEnvelope(
    path.join(out, 'tunes', 'index.json'),
    dataset.tunes.map(toIndexEntry),
    now,
    report,
  );

  const byCar = new Map<string, Tune[]>();
  for (const t of dataset.tunes) byCar.set(t.carId, [...(byCar.get(t.carId) ?? []), t]);
  const byCarDir = path.join(out, 'tunes', 'by-car');
  for (const [carId, tunes] of byCar) {
    writeEnvelope(path.join(byCarDir, `${carId}.json`), tunes, now, report);
  }
  if (fs.existsSync(byCarDir)) {
    for (const file of fs.readdirSync(byCarDir)) {
      if (!byCar.has(path.basename(file, '.json'))) {
        fs.rmSync(path.join(byCarDir, file));
        report.removed.push(path.join(byCarDir, file));
      }
    }
  }

  const review = reviewDir(visibility);
  writeEnvelope(
    path.join(review, 'unmatched-cars.json'),
    dataset.review.filter((r) => r.kind === 'unmatched-car'),
    now,
    report,
  );
  writeEnvelope(
    path.join(review, 'unknown-values.json'),
    dataset.review.filter((r) => r.kind !== 'unmatched-car'),
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
