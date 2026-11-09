import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BrowseData, BrowseLap, BrowseMeta, BrowseRole, BrowseTune } from '../lib/browse';
import { CLASS_ORDER } from '../lib/ui';
import CarCard, {
  buildsFor,
  carTypeName,
  formatDay,
  obtainText,
  RarityChip,
  PlatformChip,
  platformIndex,
  type CarCardLabels,
} from './CarCard';

export interface TuneBrowserLabels extends CarCardLabels {
  search: string;
  all: string;
  classLabel: string;
  surfaceLabel: string;
  categoryLabel: string;
  results: string;
  loading: string;
  empty: string;
  showMore: string;
  tunesCount: string;
  orderHint: string;
  alt: {
    title: string;
    lead: string;
    pickClass: string;
    sources: string;
    rivals: string;
    updated: string;
    how: string;
    howText: string;
    highlights: string;
    showAll: string;
    showLess: string;
    none: string;
    tags: Record<AltTag, string>;
    tagHelp: Record<AltTag, string>;
  };
}

type AltTag = 'recent' | 'sleeper' | 'featured' | 'rivals';
/** Alternatives listed before "show all". */
const ALT_PAGE = 10;

interface Props {
  labels: TuneBrowserLabels;
  base: string;
  dataUrl: string;
  /** Tuner page: show only this tuner's tunes (same list and filters as the tune list). */
  tuner?: string;
}

const PAGE = 60;

const group = <T,>(items: readonly T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
};

/**
 * Tunes, listed by car (owner's request: one tab instead of "Cars" + "Tunes"). Without a class
 * filter the list is alphabetical; with a class, cars come in the platform's ranking (ADR-0017):
 * Meta+, Meta, Off-meta, Niche, Other, then the rank inside the tier; uncited cars come last.
 */
export default function TuneBrowser({ labels, base, dataUrl, tuner }: Props) {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [surface, setSurface] = useState('');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [allAlts, setAllAlts] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setCls(params.get('class') ?? '');
    setSurface(params.get('surface') ?? '');
    void fetch(dataUrl)
      .then((r) => r.json() as Promise<BrowseData>)
      .then(setData);
  }, [dataUrl]);

  const index = useMemo(() => {
    if (!data) return null;
    const tunes = tuner ? data.tunes.filter((t) => t.tuner === tuner) : data.tunes;
    return {
      tunesByCar: group<BrowseTune>(tunes, (t) => t.car),
      metaByCar: group<BrowseMeta>(data.meta, (m) => m.car),
      lapsByCar: group<BrowseLap>(data.laps, (l) => l.car),
      roles: new Map<string, BrowseRole>(
        data.roles.map((r) => [`${r.car}|${r.cls}|${r.surface}`, r]),
      ),
    };
  }, [data, tuner]);

  const rows = useMemo(() => {
    if (!data || !index) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return data.cars
      .map((car) => {
        const tunes = (index.tunesByCar.get(car.id) ?? []).filter(
          (t) => !category || t.cats.includes(category as never),
        );
        const builds = buildsFor(
          tunes,
          index.metaByCar.get(car.id) ?? [],
          { cls, surface },
          index.lapsByCar.get(car.id) ?? [],
        );
        const shown = builds.reduce((n, b) => n + b.tunes.length, 0);
        return { car, tunes, builds, best: builds[0], shown };
      })
      .filter(({ car, tunes, builds }) => {
        if (builds.length === 0) return false;
        const text =
          `${car.name} ${car.types.join(' ')} ${car.types.map((ty) => carTypeName(ty, labels)).join(' ')} ${tunes.map((t) => `${t.tunerName} ${t.name}`).join(' ')}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort((a, b) => {
        if (!cls) return a.car.name.localeCompare(b.car.name);
        // The platform's ranking (ADR-0017): tier, then the rank inside the tier.
        return (
          platformIndex(a.best?.tier) - platformIndex(b.best?.tier) ||
          (a.best?.rank ?? 9999) - (b.best?.rank ?? 9999) ||
          a.car.name.localeCompare(b.car.name)
        );
      });
  }, [data, index, query, cls, surface, category, labels]);

  // Competitive alternatives to the current meta for the chosen class (owner's focus, ADR-0017):
  // the whole ranked list, plus a few highlights (platform picks, recent finds, sleepers).
  const altSurface = surface || 'road';
  const alternatives = useMemo(() => {
    if (!data || !cls || tuner) return [];
    return data.roles
      .filter((r) => r.cls === cls && r.surface === altSurface && r.role === 'alternative')
      .sort((a, b) => a.rank - b.rank);
  }, [data, cls, altSurface, tuner]);
  const highlights = useMemo(() => {
    const has = (tag: AltTag) => alternatives.filter((r) => r.tags?.includes(tag));
    const picked = [
      ...has('featured'),
      ...has('recent').slice(0, 2),
      ...has('sleeper').slice(0, 2),
    ];
    return [...new Map(picked.map((r) => [r.car, r])).values()].slice(0, 6);
  }, [alternatives]);
  const carById = useMemo(() => new Map((data?.cars ?? []).map((c) => [c.id, c])), [data]);
  const openCar = (id: string) => {
    setOpen(new Set(open).add(id));
    requestAnimationFrame(() =>
      document.getElementById(`car-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  const pill = (active: boolean) => `pill ${active ? 'pill-on' : ''}`;

  return (
    <div>
      <input
        type="search"
        class="w-full rounded border border-border bg-surface px-4 py-2.5"
        placeholder={labels.search}
        value={query}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setLimit(PAGE);
        }}
      />
      {/* Fixed under the menu while scrolling (like fhstats); one scrolling line each on phones. */}
      <div class="sticky-filters mt-3 flex flex-col gap-2">
        <div class="filter-row">
          <span class="label mr-2">{labels.classLabel}</span>
          <button type="button" class={pill(!cls)} onClick={() => setCls('')}>
            {labels.all}
          </button>
          {CLASS_ORDER.map((c) => (
            <button
              type="button"
              class={pill(cls === c)}
              onClick={() => setCls(cls === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div class="filter-row">
          <span class="label mr-2">{labels.surfaceLabel}</span>
          <button type="button" class={pill(!surface)} onClick={() => setSurface('')}>
            {labels.all}
          </button>
          {['road', 'dirt', 'cross-country'].map((s) => (
            <button
              type="button"
              class={pill(surface === s)}
              onClick={() => setSurface(surface === s ? '' : s)}
            >
              {labels.surfaces[s]}
            </button>
          ))}
          <span class="label ml-4 mr-2">{labels.categoryLabel}</span>
          {Object.entries(labels.categories).map(([value, label]) => (
            <button
              type="button"
              class={pill(category === value)}
              onClick={() => setCategory(category === value ? '' : value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p class="mt-8 text-muted">{labels.loading}</p>
      ) : (
        <>
          {!tuner && (
            <section class="alt-box mt-6">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 class="display text-xl text-accent">{labels.alt.title}</h2>
                <details class="text-xs text-muted">
                  <summary class="underline">{labels.alt.how}</summary>
                  <p class="mt-2 max-w-xl">{labels.alt.howText}</p>
                </details>
              </div>
              {!cls ? (
                <p class="mt-1 text-sm text-muted">{labels.alt.pickClass}</p>
              ) : (
                <>
                  <p class="mt-1 text-sm text-muted">
                    {labels.alt.lead} · {cls} · {labels.surfaces[altSurface]}
                  </p>
                  {highlights.length > 0 && (
                    <div class="alt-highlights mt-4">
                      <p class="label">{labels.alt.highlights}</p>
                      <ul class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {highlights.map((r) => {
                          const car = carById.get(r.car);
                          if (!car) return null;
                          return (
                            <li>
                              <button type="button" class="alt-card" onClick={() => openCar(r.car)}>
                                <AltTags tags={r.tags} labels={labels} />
                                <span class="mt-1 block font-semibold">{car.model}</span>
                                <span class="block text-xs text-muted">
                                  {car.make} · {car.year}
                                </span>
                                {r.note && (
                                  <span class="mt-1.5 block text-sm">
                                    {r.note[labels.lang === 'en' ? 'en' : 'pt-br']}
                                  </span>
                                )}
                                <AltFacts r={r} labels={labels} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {alternatives.length === 0 ? (
                    <p class="mt-3 text-sm text-muted">{labels.alt.none}</p>
                  ) : (
                    <ol class="alt-list mt-4">
                      {(allAlts ? alternatives : alternatives.slice(0, ALT_PAGE)).map((r, i) => {
                        const car = carById.get(r.car);
                        if (!car) return null;
                        return (
                          <li>
                            <button type="button" class="alt-row" onClick={() => openCar(r.car)}>
                              <span class="alt-rank">{i + 1}</span>
                              <span class="min-w-0">
                                <span class="font-semibold">{car.model}</span>{' '}
                                <span class="text-xs text-muted">
                                  {car.make} · {car.year}
                                </span>{' '}
                                <AltTags tags={r.tags} labels={labels} />
                                <AltFacts r={r} labels={labels} />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {alternatives.length > ALT_PAGE && (
                    <button type="button" class="pill mt-3" onClick={() => setAllAlts(!allAlts)}>
                      {allAlts
                        ? labels.alt.showLess
                        : labels.alt.showAll.replace('{n}', String(alternatives.length))}
                    </button>
                  )}
                </>
              )}
            </section>
          )}
          <p class="mt-5 text-sm text-muted">
            {labels.results.replace('{n}', String(rows.length))}
            {cls && ` · ${labels.orderHint}`}
          </p>
          {rows.length === 0 && <p class="mt-4 text-muted">{labels.empty}</p>}
          <ul class="mt-3 flex flex-col gap-1">
            {rows.slice(0, limit).map(({ car, builds, best, shown }) => {
              const rowRole =
                best?.cls && best.surface
                  ? index?.roles.get(`${car.id}|${best.cls}|${best.surface}`)
                  : undefined;
              const isOpen = open.has(car.id);
              const obtain = obtainText(car.obtain, labels);
              return (
                <li id={`car-${car.id}`} class="row relative overflow-hidden" data-open={isOpen}>
                  {car.image && (
                    <img
                      src={car.image}
                      alt=""
                      class="row-photo"
                      loading="lazy"
                      decoding="async"
                      referrerpolicy="no-referrer"
                    />
                  )}
                  <button
                    type="button"
                    class="grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-left sm:px-4"
                    aria-expanded={isOpen}
                    onClick={() => toggle(car.id)}
                  >
                    <span>
                      {best?.tier && (
                        <PlatformChip tier={best.tier} label={labels.tiers[best.tier]} />
                      )}
                    </span>
                    {/* Phone: name on one line, details below. Wider screens: one line. */}
                    <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span class="font-semibold">{car.model}</span>
                      <RarityChip
                        rarity={car.rarity}
                        label={car.rarity ? labels.rarities[car.rarity]! : ''}
                      />
                      {rowRole && <AltTags tags={rowRole.tags} labels={labels} />}
                      <span class="w-full text-xs text-muted sm:ml-1 sm:w-auto sm:text-sm">
                        {car.make} · {car.year}
                        {obtain.text && ` · ${obtain.text}`}
                        {obtain.auction && ` · ${labels.auction}`}
                      </span>
                    </span>
                    <span class="flex items-center gap-2 text-xs text-muted tabular-nums sm:gap-3 sm:text-sm">
                      {labels.tunesCount.replace('{n}', String(shown))}
                      <span>{isOpen ? '▴' : '▾'}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div class="border-t border-border px-3 py-4 sm:px-4">
                      <CarCard
                        car={car}
                        builds={builds}
                        labels={labels}
                        base={base}
                        href={`${base}/cars/${car.id}/`}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {rows.length > limit && (
            <button type="button" class="pill mt-4" onClick={() => setLimit(limit + PAGE)}>
              {labels.showMore}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** "Escolha do Forza Paddock", "Achado recente", "Sleeper" chips. */
function AltTags({ tags, labels }: { tags?: AltTag[]; labels: TuneBrowserLabels }) {
  if (!tags?.length) return null;
  return (
    <span class="inline-flex flex-wrap gap-1 align-middle">
      {tags.map((tag) => (
        <span class={`alt-tag alt-tag-${tag}`} title={labels.alt.tagHelp[tag] || undefined}>
          {labels.alt.tags[tag]}
        </span>
      ))}
    </span>
  );
}

/** Sources, evidence, Rivals top-10 count and last update of one alternative. */
function AltFacts({ r, labels }: { r: BrowseRole; labels: TuneBrowserLabels }) {
  const extra = [
    r.rivalsTop10 ? labels.alt.rivals.replace('{n}', String(r.rivalsTop10)) : '',
    r.updated ? labels.alt.updated.replace('{date}', formatDay(r.updated, labels.lang)) : '',
  ].filter(Boolean);
  return (
    <>
      {r.sources > 0 && (
        <span class="mt-1 block text-xs">
          {labels.alt.sources.replace('{n}', String(r.sources))}: {r.evidence.join(' · ')}
        </span>
      )}
      {extra.length > 0 && <span class="mt-0.5 block text-xs text-muted">{extra.join(' · ')}</span>}
    </>
  );
}
