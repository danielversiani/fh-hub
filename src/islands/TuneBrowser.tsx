import { useEffect, useMemo, useState } from 'preact/hooks';
import type { BrowseData, BrowseMeta, BrowseTune } from '../lib/browse';
import { CLASS_ORDER } from '../lib/ui';
import type { Tier } from '../../pipeline/schema/enums';
import CarCard, { buildsFor, ClassChip, RarityChip, TierChip, type CarCardLabels } from './CarCard';

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
}

const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];
const PAGE = 60;

/**
 * Tunes, listed by car (owner's request: one tab instead of "Cars" + "Tunes"). Without a class
 * filter the list is alphabetical; with a class, cars come in the meta table's order — best tier
 * first, then the table's rank — and cars the table does not list come last (T3).
 */
export default function TuneBrowser({ labels, base, dataUrl }: Props) {
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
    const tunesByCar = new Map<string, BrowseTune[]>();
    for (const t of data.tunes) tunesByCar.set(t.car, [...(tunesByCar.get(t.car) ?? []), t]);
    const metaByCar = new Map<string, BrowseMeta[]>();
    for (const m of data.meta) metaByCar.set(m.car, [...(metaByCar.get(m.car) ?? []), m]);
    return { tunesByCar, metaByCar };
  }, [data]);

  const rows = useMemo(() => {
    if (!data || !index) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return data.cars
      .map((car) => {
        const tunes = (index.tunesByCar.get(car.id) ?? []).filter(
          (t) => !category || t.cats.includes(category as never),
        );
        const meta = index.metaByCar.get(car.id) ?? [];
        const builds = buildsFor(tunes, category ? [] : meta, { cls, surface });
        const best = builds[0];
        // Count only the tunes the current filters show.
        const shown = builds.reduce((n, b) => n + b.tunes.length, 0);
        return { car, tunes, builds, best, shown };
      })
      .filter(({ car, tunes, builds }) => {
        if (builds.length === 0 || (tunes.length === 0 && !builds.some((b) => b.listed)))
          return false;
        if (category === 'meme' && !car.meme) return false;
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

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? 'border-accent bg-accent text-white' : 'border-border text-muted hover:text-text'}`;

  return (
    <div>
      <div class="flex flex-col gap-3">
        <input
          type="search"
          class="w-full rounded-lg border border-border bg-surface px-4 py-3"
          placeholder={labels.search}
          value={query}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setLimit(PAGE);
          }}
        />
        <div class="flex flex-wrap items-center gap-2">
          <span class="eyebrow mr-1 text-muted">{labels.classLabel}</span>
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
        <div class="flex flex-wrap items-center gap-2">
          <span class="eyebrow mr-1 text-muted">{labels.surfaceLabel}</span>
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
          <span class="eyebrow ml-4 mr-1 text-muted">{labels.categoryLabel}</span>
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
          <ul class="mt-3 flex flex-col gap-2">
            {rows.slice(0, limit).map(({ car, builds, best, shown }) => {
              const isOpen = open.has(car.id);
              return (
                <li class="card overflow-hidden">
                  <button
                    type="button"
                    class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-surface-2"
                    aria-expanded={isOpen}
                    onClick={() => toggle(car.id)}
                  >
                    {best && <TierChip tier={best.tier} muted={!best.listed} />}
                    <span class="display text-xl">{car.model}</span>
                    <RarityChip
                      rarity={car.rarity}
                      label={car.rarity ? labels.rarities[car.rarity]! : ''}
                    />
                    <span class="text-sm text-muted">
                      {car.make} · {car.year}
                    </span>
                    <span class="ml-auto flex items-center gap-3">
                      <span class="text-sm text-muted tabular-nums">
                        {labels.tunesCount.replace('{n}', String(shown))}
                      </span>
                      <ClassChip cls={car.cls} pi={car.pi} />
                      <span class="text-muted">{isOpen ? '▴' : '▾'}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div class="border-t border-border px-4 py-4">
                      <CarCard
                        car={car}
                        builds={builds}
                        labels={labels}
                        href={`${base}/cars/${car.id}/`}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {rows.length > limit && (
            <button
              type="button"
              class="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:border-accent"
              onClick={() => setLimit(limit + PAGE)}
            >
              {labels.showMore}
            </button>
          )}
        </>
      )}
    </div>
  );
}
