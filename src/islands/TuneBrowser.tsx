import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BrowseData, BrowseLap, BrowseMeta, BrowseTune } from '../lib/browse';
import { CLASS_ORDER } from '../lib/ui';
import type { Tier } from '../../pipeline/schema/enums';
import CarCard, {
  buildsFor,
  obtainText,
  RarityChip,
  TierChip,
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
}

interface Props {
  labels: TuneBrowserLabels;
  base: string;
  dataUrl: string;
  /** Tuner page: show only this tuner's tunes (same list and filters as the tune list). */
  tuner?: string;
}

const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];
const PAGE = 60;

const group = <T,>(items: readonly T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
};

/**
 * Tunes, listed by car (owner's request: one tab instead of "Cars" + "Tunes"). Without a class
 * filter the list is alphabetical; with a class, cars come in the meta table's order — best tier
 * first, then the table's rank — and cars the table does not list come last (T3).
 */
export default function TuneBrowser({ labels, base, dataUrl, tuner }: Props) {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [surface, setSurface] = useState('');
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

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
          `${car.name} ${car.types.join(' ')} ${tunes.map((t) => `${t.tunerName} ${t.name}`).join(' ')}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort((a, b) => {
        if (!cls) return a.car.name.localeCompare(b.car.name);
        const ta = TIER_ORDER.indexOf(a.best?.tier ?? 't3');
        const tb = TIER_ORDER.indexOf(b.best?.tier ?? 't3');
        return (
          ta - tb ||
          Number(Boolean(b.best?.listed)) - Number(Boolean(a.best?.listed)) ||
          (a.best?.rank ?? 9999) - (b.best?.rank ?? 9999) ||
          a.car.name.localeCompare(b.car.name)
        );
      });
  }, [data, index, query, cls, surface, category]);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  const pill = (active: boolean) => `pill ${active ? 'pill-on' : ''}`;

  return (
    <div>
      <div class="flex flex-col gap-3">
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
        <div class="flex flex-wrap items-center gap-1.5">
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
        <div class="flex flex-wrap items-center gap-1.5">
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
          <p class="mt-5 text-sm text-muted">
            {labels.results.replace('{n}', String(rows.length))}
            {cls && ` · ${labels.orderHint}`}
          </p>
          {rows.length === 0 && <p class="mt-4 text-muted">{labels.empty}</p>}
          <ul class="mt-3 flex flex-col gap-1">
            {rows.slice(0, limit).map(({ car, builds, best, shown }) => {
              const isOpen = open.has(car.id);
              const obtain = obtainText(car.obtain, labels);
              return (
                <li class="row" data-open={isOpen}>
                  <button
                    type="button"
                    class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left"
                    aria-expanded={isOpen}
                    onClick={() => toggle(car.id)}
                  >
                    <span class="w-12 shrink-0">
                      {best && <TierChip tier={best.tier} muted={!best.listed} />}
                    </span>
                    <span class="font-semibold">{car.model}</span>
                    <RarityChip
                      rarity={car.rarity}
                      label={car.rarity ? labels.rarities[car.rarity]! : ''}
                    />
                    <span class="text-sm text-muted">
                      {car.make} · {car.year}
                      {obtain.text && ` · ${obtain.text}`}
                      {obtain.auction && ` · ${labels.auction}`}
                    </span>
                    <span class="ml-auto flex items-center gap-3 text-sm text-muted tabular-nums">
                      {labels.tunesCount.replace('{n}', String(shown))}
                      <span>{isOpen ? '▴' : '▾'}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div class="border-t border-border px-4 py-4">
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
