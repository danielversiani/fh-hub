import { getAdapter } from '../adapters';
import { countRecords, withDefaults, type AdapterOutput, type TabPayload } from '../adapters/types';
import { appendChangelog, diffDataset } from '../build/changelog';
import { highlightsFromChanges, mergeHighlights, readChangelog } from '../build/highlights';
import { buildDataset, datasetStats, type SourceResult } from '../build/dataset';
import { readSnapshot, readStatuses, writeDataset, writeSnapshot } from '../build/write';
import { loadManual, loadSources } from '../config';
import { loadCurationConfig } from '../curate/config';
import { curate } from '../curate';
import { downloadSource, readSavedSource, saveSource, toPayload, type RawTab } from '../fetchers';
import { HeaderMismatchError } from '../lib/table';
import { paths, VISIBILITIES, type Visibility } from '../paths';
import type { SourceStatus } from '../schema/entities';
import { isPublic, type SourceDef } from '../schema/source';

/** live = download; offline = reuse .cache/raw; fixtures = test fixtures (always a dry run). */
export type InputMode = 'live' | 'offline' | 'fixtures';

export interface SyncOptions {
  sourceIds?: string[];
  mode: InputMode;
  dryRun: boolean;
  /** Accept a large drop in rows (intentional clean-up by the tuner). */
  acceptDrop: boolean;
  /** Skip sources that cannot be published (used by the scheduled GitHub workflow). */
  publicOnly: boolean;
}

/** Below this fraction of the previous row count, removals are not trusted (ADR-0005). */
const DROP_LIMIT = 0.7;

export class RowDropError extends Error {
  constructor(sourceId: string, before: number, after: number) {
    super(`[${sourceId}] rows dropped from ${before} to ${after}; keeping the last good data`);
    this.name = 'RowDropError';
  }
}

const inCi = Boolean(process.env.CI);
const log = (message: string) => console.log(message);
const warn = (sourceId: string, message: string) =>
  console.log(inCi ? `::warning title=${sourceId}::${message}` : `  ! ${message}`);

async function loadRawTabs(source: SourceDef, mode: InputMode): Promise<RawTab[]> {
  if (mode === 'live') {
    const tabs = await downloadSource(source);
    saveSource(paths.rawCache, source.id, tabs);
    return tabs;
  }
  return readSavedSource(mode === 'offline' ? paths.rawCache : paths.fixtures, source);
}

export async function runAdapter(source: SourceDef, tabs: RawTab[]): Promise<AdapterOutput> {
  const payloads: Record<string, TabPayload> = Object.fromEntries(
    tabs.map((t) => [t.tabId, toPayload(t)]),
  );
  return getAdapter(source.adapter).parse({ source, tabs: payloads });
}

export async function sync(options: SyncOptions): Promise<{ ok: boolean }> {
  const { sources } = loadSources();
  const manual = loadManual();
  const curation = loadCurationConfig();
  const now = new Date().toISOString();
  const dryRun = options.dryRun || options.mode === 'fixtures';
  const active = sources.filter((s) => s.active && (!options.publicOnly || isPublic(s)));
  const unknown = (options.sourceIds ?? []).filter((id) => !active.some((s) => s.id === id));
  if (unknown.length) throw new Error(`unknown or inactive source(s): ${unknown.join(', ')}`);
  const selected = new Set(options.sourceIds ?? active.map((s) => s.id));

  const results: SourceResult[] = [];
  const statuses: SourceStatus[] = [];
  let catalogMissing = false;

  for (const source of active) {
    const visibility: Visibility = isPublic(source) ? 'public' : 'preview';
    // Fixtures are small samples: comparing them with the real snapshots would trip the
    // row-drop guard, so a fixtures run ignores previous data entirely.
    const usePrevious = options.mode !== 'fixtures';
    const previous = usePrevious ? readSnapshot(visibility, source.id) : undefined;
    const previousStatus = usePrevious
      ? readStatuses(visibility).find((s) => s.id === source.id)
      : undefined;
    const base = {
      id: source.id,
      name: source.name,
      url: source.url,
      permission: source.permission,
      public: isPublic(source),
    };
    const isCatalog = source.tabs.some((t) => t.role === 'catalog');

    if (!selected.has(source.id)) {
      if (previous) {
        results.push({ source, output: withDefaults(previous.output) });
        statuses.push(
          previousStatus ?? {
            ...base,
            status: 'healthy',
            records: previous.records,
            usedSnapshot: true,
          },
        );
      } else if (isCatalog) catalogMissing = true;
      continue;
    }

    try {
      const output = await runAdapter(source, await loadRawTabs(source, options.mode));
      const records = countRecords(output);
      if (records === 0) throw new Error(`[${source.id}] adapter returned no records`);
      if (previous && !options.acceptDrop && records < previous.records * DROP_LIMIT) {
        throw new RowDropError(source.id, previous.records, records);
      }
      const changed =
        !dryRun &&
        writeSnapshot(visibility, { schemaVersion: 1, sourceId: source.id, records, output });
      results.push({ source, output });
      statuses.push({
        ...base,
        status: 'healthy',
        records,
        usedSnapshot: false,
        lastChangedAt: changed ? now : (previousStatus?.lastChangedAt ?? now),
      });
      log(`✓ ${source.id}: ${records} records`);
      for (const w of output.warnings) warn(source.id, w);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const degraded = error instanceof HeaderMismatchError || error instanceof RowDropError;
      log(
        `✗ ${source.id}: ${degraded ? 'degraded' : 'failing'}${previous ? ' (using last good data)' : ''}`,
      );
      warn(source.id, message);
      if (previous) results.push({ source, output: withDefaults(previous.output) });
      else if (isCatalog) catalogMissing = true;
      statuses.push({
        ...base,
        status: degraded ? 'degraded' : 'failing',
        records: previous?.records ?? 0,
        usedSnapshot: Boolean(previous),
        error: message,
        lastChangedAt: previousStatus?.lastChangedAt,
      });
    }
  }

  if (catalogMissing) {
    log('✗ no master car list available (catalog source failed and has no snapshot); aborting');
    return { ok: false };
  }

  for (const visibility of VISIBILITIES) {
    if (visibility === 'preview' && options.publicOnly) continue;
    const visible = visibility === 'public' ? results.filter((r) => isPublic(r.source)) : results;
    const base = buildDataset(visible, manual);
    const curated = curate(base, curation, sources);
    const dataset = { ...base, tunes: curated.tunes };
    const s = datasetStats(dataset);
    log(
      `\n[${visibility}] ${s.cars} cars · ${s.tunes} tunes (${s.codedTunes} with share code) · ` +
        `${s.tuners} tuners · ${s.lapTimes} lap times · ${s.metaRankings} meta rankings`,
    );
    const current = dataset.seasons.find((season) => season.current);
    log(
      `[${visibility}] playlist: ${dataset.events.length} events in ${dataset.seasons.length} seasons` +
        (current ? `, live: ${current.id} (until ${current.endsOn})` : ', live season unknown') +
        ` · ${curated.suggestions.length} suggestions`,
    );
    if (s.cars > 0) {
      log(
        `[${visibility}] coverage: ${s.carsWithCodedTune}/${s.cars} cars with a coded tune ` +
          `(${Math.round((s.carsWithCodedTune / s.cars) * 100)}%), ${s.carsWithAnyTune} with any tune`,
      );
    }
    if (s.unmatchedCarNames > 0) {
      log(
        `[${visibility}] review: ${s.unmatchedCarNames} unmatched car names (${s.unmatchedCarRows} rows)`,
      );
    }
    if (!dryRun) {
      // Diff against what is on disk BEFORE overwriting it.
      const changes = diffDataset(visibility, dataset, now);
      if (changes.length) {
        appendChangelog(visibility, changes, now);
        log(`[${visibility}] changelog: ${changes.length} changes`);
      }
      const news = mergeHighlights([
        dataset.highlights,
        highlightsFromChanges(readChangelog(visibility)),
      ]);
      const report = writeDataset(
        visibility,
        dataset,
        visibility === 'public' ? statuses.filter((st) => st.public) : statuses,
        curated.suggestions,
        news,
        now,
      );
      log(
        `[${visibility}] ${report.written.length} files written, ${report.removed.length} removed`,
      );
    }
  }
  return { ok: true };
}
