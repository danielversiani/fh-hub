import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../lib/json';
import { generatedDir, type Visibility } from '../paths';
import type { Tier } from '../schema/enums';
import type { ChangeLogEntry, Highlight } from '../schema/entities';

/** Points per tier: the better the tier, the more a piece of news stands out. */
const TIER_POINTS: Readonly<Record<Tier, number>> = {
  'meta-plus': 7,
  meta: 6,
  't0.5': 5,
  t1: 4,
  't1.5': 3,
  t2: 2,
  t3: 1,
};

/**
 * How much a piece of news stands out on the home page (owner's rule: "the bigger the upgrade,
 * the bigger the highlight"). A jump of several tiers beats any single update.
 */
export function magnitude(kind: Highlight['kind'], tier: Tier, previous?: Tier): number {
  const points = TIER_POINTS[tier];
  if (kind === 'tier-up' && previous) return (points - TIER_POINTS[previous]) * 3 + points;
  if (kind === 'tier-down' && previous)
    return (TIER_POINTS[previous] - points) * 3 + TIER_POINTS[previous];
  if (kind === 'new-car') return points + 1;
  return points;
}

/** News from the sync's own change log: meta tiers that moved or appeared. */
export function highlightsFromChanges(entries: readonly ChangeLogEntry[]): Highlight[] {
  const out: Highlight[] = [];
  for (const e of entries) {
    if (e.entity.type !== 'meta-ranking' || !e.class || !e.surface || !e.sourceId) continue;
    const tier = e.after as Tier | undefined;
    if (!tier || !(tier in TIER_POINTS)) continue;
    const kind: Highlight['kind'] =
      e.kind === 'added'
        ? 'new-entry'
        : e.kind === 'tier-up'
          ? 'tier-up'
          : e.kind === 'tier-down'
            ? 'tier-down'
            : 'new-entry';
    if (e.kind === 'removed') continue;
    const previous = e.before as Tier | undefined;
    out.push({
      id: `changelog--${e.entity.id}--${e.at}`,
      kind,
      date: e.at.slice(0, 10),
      carId: e.carId,
      class: e.class,
      surface: e.surface,
      tier,
      previousTier: previous && previous in TIER_POINTS ? previous : undefined,
      tunerIds: [],
      sourceId: e.sourceId,
      magnitude: magnitude(kind, tier, previous),
    });
  }
  return out;
}

export function readChangelog(visibility: Visibility): ChangeLogEntry[] {
  const dir = path.join(generatedDir(visibility), 'changelog');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => readJson<{ items: ChangeLogEntry[] }>(path.join(dir, f))?.items ?? []);
}

/** Newest first; ties by magnitude. Keeps the last `days` days before the newest item. */
export function mergeHighlights(
  lists: readonly Highlight[][],
  days = 45,
  limit = 120,
): Highlight[] {
  const all = lists.flat();
  const newest = all.reduce((max, h) => (h.date > max ? h.date : max), '');
  if (!newest) return [];
  const cutoff = new Date(Date.parse(newest) - days * 86_400_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  return all
    .filter((h) => h.date >= cutoff)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.magnitude - a.magnitude || a.id.localeCompare(b.id),
    )
    .filter((h) => {
      const key = `${h.kind}|${h.carId}|${h.class}|${h.surface}|${h.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
