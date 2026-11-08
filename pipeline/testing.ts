import type { SourceResult } from './build/dataset';
import { runAdapter } from './commands/sync';
import { loadSources } from './config';
import { readSavedSource } from './fetchers';
import { paths } from './paths';

let cached: Promise<SourceResult[]> | undefined;

/** Runs every active adapter on the committed fixtures (no network). Cached per test run. */
export function fixtureResults(): Promise<SourceResult[]> {
  cached ??= Promise.all(
    loadSources()
      .sources.filter((s) => s.active)
      .map(async (source) => ({
        source,
        output: await runAdapter(source, readSavedSource(paths.fixtures, source)),
      })),
  );
  return cached;
}

export async function fixtureOutput(sourceId: string) {
  const result = (await fixtureResults()).find((r) => r.source.id === sourceId);
  if (!result) throw new Error(`no fixture result for ${sourceId}`);
  return result.output;
}
