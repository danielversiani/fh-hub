import type { Dataset } from '../build/dataset';
import type { CarClass, ListLevel, Surface, Tier, TuneStyle } from '../schema/enums';
import type { CarRole } from '../schema/entities';

/**
 * "Competitive alternatives" formula (ADR-0017, docs/CURATION.md §Alternativas).
 *
 * For every car × class × surface it gathers:
 * - opinions: the meta table (Noa Miyako) and the community lists (fhstats online list,
 *   LogikJ, Attax Johnson…), each turned into a 0–1 score;
 * - objective data: Rivals statistics (top-10 appearances) and the Rivals Meta Sheet picks.
 * Then it gives the car the platform's tier (the site's main ranking): Meta+ / Meta (what you meet
 * online), Off-meta (competitive beyond the obvious), Other (cited but weaker, or mostly pure
 * handling / speed builds) and Niche (only by hand). Tags on top: rivals, recent, sleeper,
 * featured. Everything is automatic except data/manual/tier-overrides.yaml and featured-picks.yaml.
 */

const TIER_SCORE: Readonly<Record<Tier, number>> = {
  'meta-plus': 1,
  meta: 0.85,
  't0.5': 0.75,
  t1: 0.65,
  't1.5': 0.55,
  t2: 0.45,
  t3: 0.3,
};
const TIER_LABEL: Readonly<Record<Tier, string>> = {
  'meta-plus': 'Meta+',
  meta: 'Meta',
  't0.5': 'T0.5',
  t1: 'T1',
  't1.5': 'T1.5',
  t2: 'T2',
  t3: 'T3',
};
const LEVEL_SCORE: Readonly<Record<ListLevel, number>> = {
  'meta-plus': 1,
  meta: 0.85,
  strong: 0.7,
  offmeta: 0.6,
  pick: 0.65,
};

/** Alternatives need at least this strength (0–1). */
const MIN_ALTERNATIVE = 0.55;
/** A car listed for this many days by 3+ sources is "well known" (manjado). */
const WELL_KNOWN_DAYS = 90;
/** First listed within this many days of the newest data, by 2+ sources: a recent find. */
const RECENT_DAYS = 21;
/** Rivals strength (0–1) that makes a car cited by a single list a "sleeper". */
const SLEEPER_RIVALS = 0.35;

interface Opinion {
  sourceId: string;
  label: string;
  score: number;
  top: boolean;
  style?: TuneStyle;
  extreme?: boolean;
  /** Says "good online" explicitly (the fhstats list is online by definition, so it doesn't count). */
  onlineNote?: boolean;
  noaT1?: boolean;
  date?: string;
  /** false for lists without a ranking (Attax Johnson's "picks"): they count as a source but
   * stay out of the average, where a neutral score would pull ranked cars down. */
  ranked: boolean;
}

const keyOf = (car: string, cls: CarClass, surface: Surface) => `${car}|${cls}|${surface}`;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/** Meta+: ranked sources average at least this (0–1), with at least one Meta+ vote. */
const META_PLUS = 0.9;
/** Tiebreaker for a Meta+ / Meta split: Rivals strength (0–1, leader = 1) at least this. */
const META_PLUS_RIVALS = 0.8;

const ROLE_OF_TIER: Readonly<Record<CarRole['tier'], CarRole['role']>> = {
  'meta-plus': 'meta',
  meta: 'meta',
  'off-meta': 'alternative',
  niche: 'niche',
  other: 'other',
};

function tierOf(role: CarRole['role'], metaPlus: boolean): CarRole['tier'] {
  if (role === 'meta') return metaPlus ? 'meta-plus' : 'meta';
  if (role === 'alternative') return 'off-meta';
  return role;
}

function tagsOf(
  s: { role?: CarRole['role']; recent: boolean; sleeper: boolean; rivalsBuild: boolean },
  pick: Dataset['featured'][number] | undefined,
  override: Dataset['tierOverrides'][number] | undefined,
): Pick<CarRole, 'tags' | 'note'> {
  const tags: NonNullable<CarRole['tags']> = [];
  if (pick) tags.push('featured');
  if (s.role === 'alternative' && s.recent) tags.push('recent');
  if (s.role === 'alternative' && s.sleeper) tags.push('sleeper');
  if (s.rivalsBuild) tags.push('rivals');
  return { tags: tags.length ? tags : undefined, note: pick?.note ?? override?.note };
}

export function computeRoles(dataset: Dataset): CarRole[] {
  const opinions = new Map<string, Opinion[]>();
  const add = (k: string, o: Opinion) => opinions.set(k, [...(opinions.get(k) ?? []), o]);

  // Meta table: the best row per car × class × surface.
  const bestMeta = new Map<string, Dataset['meta'][number]>();
  for (const m of dataset.meta) {
    const k = keyOf(m.carId, m.class, m.surface);
    const cur = bestMeta.get(k);
    if (!cur || TIER_SCORE[m.tier] > TIER_SCORE[cur.tier]) bestMeta.set(k, m);
  }
  for (const [k, m] of bestMeta) {
    add(k, {
      sourceId: m.sourceId,
      label: TIER_LABEL[m.tier],
      score: TIER_SCORE[m.tier],
      top: m.tier === 'meta-plus' || m.tier === 'meta',
      style: m.role,
      onlineNote: /线上/.test(m.notes ?? '') || undefined,
      noaT1: m.tier === 't1' || undefined,
      ranked: true,
    });
  }
  for (const e of dataset.lists) {
    add(keyOf(e.carId, e.class, e.surface), {
      sourceId: e.sourceId,
      label: e.label,
      score: LEVEL_SCORE[e.level],
      top: e.level === 'meta-plus' || e.level === 'meta',
      style: e.style,
      extreme: e.extreme,
      onlineNote: (e.online && e.sourceId !== 'fhstats') || undefined,
      date: e.date,
      ranked: e.level !== 'pick',
    });
  }

  const rivals = new Map(dataset.rivalsStats.map((r) => [keyOf(r.carId, r.class, r.surface), r]));
  const picks = new Map<string, number>();
  for (const p of dataset.rivals) {
    const k = keyOf(p.carId, p.class, p.surface);
    picks.set(k, (picks.get(k) ?? 0) + (p.choice === 1 ? 2 : 1));
  }
  // Dates: tune dates and meta-table update news complete the lists' own dates.
  const dates = new Map<string, string[]>();
  const addDate = (k: string, d: string | undefined) => {
    if (d) dates.set(k, [...(dates.get(k) ?? []), d]);
  };
  for (const t of dataset.tunes) {
    if (t.class && t.surface) addDate(keyOf(t.carId, t.class, t.surface), t.createdAt);
  }
  for (const h of dataset.highlights) addDate(keyOf(h.carId, h.class, h.surface), h.date);
  for (const [k, ops] of opinions) for (const o of ops) addDate(k, o.date);
  const newest = [...dates.values()].flat().reduce((max, d) => (d > max ? d : max), '');
  const today = dataset.today ?? newest;

  // Leader's top-10 count per class × surface, to scale the Rivals signal.
  const maxTop10 = new Map<string, number>();
  for (const r of dataset.rivalsStats) {
    const g = `${r.class}|${r.surface}`;
    maxTop10.set(g, Math.max(maxTop10.get(g) ?? 1, r.top10));
  }

  const keys = new Set([...opinions.keys(), ...rivals.keys(), ...picks.keys()]);
  const scored = [...keys].map((k) => {
    const [carId, cls, surface] = k.split('|') as [string, CarClass, Surface];
    const ops = opinions.get(k) ?? [];
    const rv = rivals.get(k);
    const pickPoints = picks.get(k) ?? 0;
    const ranked = ops.some((o) => o.ranked) ? ops.filter((o) => o.ranked) : ops;
    const consensus = ranked.length ? ranked.reduce((a, o) => a + o.score, 0) / ranked.length : 0;
    // sqrt: the leader takes most top-10s, so the rest would otherwise look like zero.
    const rivalsScore = rv ? Math.sqrt(rv.top10 / (maxTop10.get(`${cls}|${surface}`) ?? 1)) : 0;
    // Rivals only adds when the car actually reaches top-10s: absence from the top-10 of a
    // leaderboard dominated by one or two cars says little about online racing.
    const strength = ops.length
      ? rv && rv.top10 > 0
        ? 0.65 * consensus + 0.35 * rivalsScore
        : consensus
      : 0.8 * rivalsScore;
    const sources = ops.length + (rv && rv.top10 > 0 ? 1 : 0) + (pickPoints > 0 ? 1 : 0);
    const topVotes = ops.filter((o) => o.top).length;
    // Only an explicit "pure handling" / "pure speed" label counts: a powerbuild can be the online
    // meta in some classes (e.g. B dirt), so the build style alone is not enough.
    const extremeCount = ops.filter((o) => o.extreme && o.sourceId !== 'fhstats').length;
    const onlineNote = ops.some((o) => o.onlineNote);
    const ds = [...new Set(dates.get(k) ?? [])].sort();
    // The site's own record: the date it first saw the car here (kept from sync to sync).
    // On the record's first run every car already listed counts from the baseline (not new).
    const firstSeen = dataset.firstSeen?.[k] ?? dataset.firstSeenBaseline ?? today;
    const since = ds[0];
    const updated = ds.at(-1);
    const wellKnown =
      sources >= 3 && Boolean(since && newest && days(since, newest) >= WELL_KNOWN_DAYS);
    // Mostly pure handling / speed builds (half the sources or more): strong in time trials, not
    // something to expect online. A single such build only adds the "rivals" tag.
    const rivalsOnly = extremeCount > 0 && extremeCount * 2 >= ops.length && !onlineNote;
    const rivalsBuild = extremeCount > 0;
    // A recent find: the site first saw it in the last weeks (with the record), or, without the
    // record, every list dates it recently (an undated list may have had it for months). It stops
    // being "recent" after RECENT_DAYS, and "well known" sends it down the list later on.
    const newHere = dataset.firstSeen
      ? Boolean(firstSeen && today && days(firstSeen, today) <= RECENT_DAYS) &&
        (!since || days(since, today) <= RECENT_DAYS || ops.some((o) => !o.date))
      : ops.every((o) => o.date) && Boolean(since && today && days(since, today) <= RECENT_DAYS);
    const recent = sources >= 2 && !wellKnown && newHere;
    const sleeper = ops.length === 1 && rivalsScore >= SLEEPER_RIVALS && !wellKnown;

    let role: CarRole['role'] | undefined;
    if (topVotes >= 2 || (topVotes >= 1 && (rivalsScore >= 0.6 || pickPoints >= 10))) {
      role = rivalsOnly ? 'other' : 'meta';
    } else if (ops.length >= 1 && strength >= MIN_ALTERNATIVE) {
      role = rivalsOnly ? 'other' : 'alternative';
    } else if (ops.length >= 1) {
      role = 'other';
    }
    // Meta+ candidates: ranked sources average 0.9+ with a Meta+ vote. Unanimous Meta+ is Meta+;
    // a Meta+ / Meta split needs the Rivals tiebreaker (second pass below).
    const metaPlusVote =
      role === 'meta' && consensus >= META_PLUS && ranked.some((o) => o.ranked && o.score >= 1);
    const metaPlusSplit = metaPlusVote && !ranked.every((o) => o.score >= 1);
    const metaPlus = metaPlusVote && !metaPlusSplit;
    // Ordering of alternatives: more sources first; Noa's T1 confirmed by another source is the
    // owner's "sweet spot"; well-known cars go down.
    const confirmedT1 = ops.some((o) => o.noaT1) && ops.length >= 2;
    const order = sources + (confirmedT1 ? 0.5 : 0) - (wellKnown ? 1 : 0);
    return {
      carId,
      cls,
      surface,
      role,
      order,
      strength,
      sources,
      ops,
      rv,
      pickPoints,
      since,
      updated,
      wellKnown,
      recent,
      sleeper,
      firstSeen,
      metaPlus,
      metaPlusSplit,
      rivalsBuild,
      override: undefined as CarRole['tier'] | undefined,
    };
  });

  // Rivals tiebreaker for a Meta+ / Meta split: top-10 appearances compared with the strongest
  // meta car of the class × surface (not the leaderboard's leader, often a time-trial specialist).
  const bestMetaTop10 = new Map<string, number>();
  for (const s of scored) {
    if (s.role !== 'meta') continue;
    const g = `${s.cls}|${s.surface}`;
    bestMetaTop10.set(g, Math.max(bestMetaTop10.get(g) ?? 0, s.rv?.top10 ?? 0));
  }
  for (const s of scored) {
    if (!s.metaPlusSplit) continue;
    const best = bestMetaTop10.get(`${s.cls}|${s.surface}`) ?? 0;
    s.metaPlus = best > 0 && Math.sqrt((s.rv?.top10 ?? 0) / best) >= META_PLUS_RIVALS;
  }

  // The platform's own picks: tagged on the car's entry, or added as an alternative.
  const featured = new Map(dataset.featured.map((p) => [keyOf(p.carId, p.class, p.surface), p]));
  for (const [k, p] of featured) {
    const s = scored.find((x) => keyOf(x.carId, x.cls, x.surface) === k);
    if (s) {
      s.role ??= 'alternative';
      continue;
    }
    scored.push({
      carId: p.carId,
      cls: p.class,
      surface: p.surface,
      role: 'alternative',
      order: -Infinity,
      strength: 0,
      sources: 0,
      ops: [],
      rv: undefined,
      pickPoints: 0,
      since: undefined,
      updated: p.date,
      wellKnown: false,
      recent: false,
      sleeper: false,
      firstSeen: dataset.firstSeen?.[k] ?? dataset.firstSeenBaseline ?? today,
      metaPlus: false,
      metaPlusSplit: false,
      rivalsBuild: false,
      override: undefined,
    });
  }

  // The platform's tier set by hand (e.g. Niche: strong in specific events), ADR-0017.
  const overrides = new Map(
    dataset.tierOverrides.map((o) => [keyOf(o.carId, o.class, o.surface), o]),
  );
  for (const [k, o] of overrides) {
    let s = scored.find((x) => keyOf(x.carId, x.cls, x.surface) === k);
    if (!s) {
      s = {
        carId: o.carId,
        cls: o.class,
        surface: o.surface,
        role: undefined,
        order: -Infinity,
        strength: 0,
        sources: 0,
        ops: [],
        rv: undefined,
        pickPoints: 0,
        since: undefined,
        updated: undefined,
        wellKnown: false,
        recent: false,
        sleeper: false,
        firstSeen: dataset.firstSeen?.[k] ?? dataset.firstSeenBaseline ?? today,
        metaPlus: false,
        metaPlusSplit: false,
        rivalsBuild: false,
        override: undefined,
      };
      scored.push(s);
    }
    s.override = o.tier;
    s.role = ROLE_OF_TIER[o.tier];
  }

  const out: CarRole[] = [];
  const groups = new Map<string, typeof scored>();
  for (const s of scored) {
    if (!s.role) continue;
    const g = `${s.cls}|${s.surface}|${s.role}`;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  for (const list of groups.values()) {
    list
      .sort((a, b) =>
        a.role === 'alternative'
          ? b.order - a.order || b.strength - a.strength || a.carId.localeCompare(b.carId)
          : b.strength - a.strength || a.carId.localeCompare(b.carId),
      )
      .forEach((s, i) =>
        out.push({
          carId: s.carId,
          class: s.cls,
          surface: s.surface,
          role: s.role!,
          rank: i + 1,
          tier: s.override ?? tierOf(s.role!, s.metaPlus),
          sources: s.sources,
          evidence: s.ops.map((o) => ({ sourceId: o.sourceId, label: o.label })),
          rivalsTop10: s.rv?.top10 || undefined,
          rivalsWins: s.rv?.wins || undefined,
          rivalsPicks: s.pickPoints || undefined,
          firstSeen: s.firstSeen || undefined,
          since: s.since,
          updated: s.updated,
          wellKnown: s.wellKnown || undefined,
          ...tagsOf(
            s,
            featured.get(keyOf(s.carId, s.cls, s.surface)),
            overrides.get(keyOf(s.carId, s.cls, s.surface)),
          ),
        }),
      );
  }
  return out.sort(
    (a, b) =>
      a.surface.localeCompare(b.surface) ||
      a.class.localeCompare(b.class) ||
      a.role.localeCompare(b.role) ||
      a.rank - b.rank,
  );
}
