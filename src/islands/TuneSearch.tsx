import { useEffect, useMemo, useState } from 'preact/hooks';
import { CLASS_COLORS, CLASS_ORDER, formatShareCode } from '../lib/ui';

/** [id, shareCode, carId, carName, tunerId, tunerName, name, class, surface, categories, score] */
type TuneRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
];

export interface TuneSearchLabels {
  placeholder: string;
  all: string;
  class: string;
  surface: string;
  category: string;
  codedOnly: string;
  results: string;
  empty: string;
  loading: string;
  copy: string;
  copied: string;
  noCode: string;
  by: string;
  surfaces: Record<string, string>;
  categories: Record<string, string>;
}

interface Props {
  labels: TuneSearchLabels;
  /** '' for PT-BR, '/en' for English. */
  base: string;
  dataUrl: string;
}

const PAGE = 100;

export default function TuneSearch({ labels, base, dataUrl }: Props) {
  const [rows, setRows] = useState<TuneRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('');
  const [surface, setSurface] = useState('');
  const [category, setCategory] = useState('');
  const [codedOnly, setCodedOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    void fetch(dataUrl)
      .then((r) => r.json() as Promise<TuneRow[]>)
      .then(setRows);
  }, [dataUrl]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter((r) => {
        const text = `${r[3]} ${r[5]} ${r[6]}`.toLowerCase();
        return (
          words.every((w) => text.includes(w)) &&
          (!cls || r[7] === cls) &&
          (!surface || r[8] === surface) &&
          (!category || r[9].split(',').includes(category)) &&
          (!codedOnly || r[1] !== '')
        );
      })
      .sort((a, b) => b[10] - a[10] || a[3].localeCompare(b[3]));
  }, [rows, query, cls, surface, category, codedOnly]);

  const select = 'rounded-md border border-border bg-surface px-3 py-2';
  return (
    <div>
      <form class="flex flex-wrap items-end gap-3 text-sm" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          class={`${select} min-w-64 flex-1`}
          placeholder={labels.placeholder}
          value={query}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setLimit(PAGE);
          }}
        />
        <select
          class={select}
          aria-label={labels.class}
          value={cls}
          onChange={(e) => setCls(e.currentTarget.value)}
        >
          <option value="">{`${labels.class}: ${labels.all}`}</option>
          {CLASS_ORDER.map((c) => (
            <option value={c}>{c}</option>
          ))}
        </select>
        <select
          class={select}
          aria-label={labels.surface}
          value={surface}
          onChange={(e) => setSurface(e.currentTarget.value)}
        >
          <option value="">{`${labels.surface}: ${labels.all}`}</option>
          {Object.entries(labels.surfaces).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>
        <select
          class={select}
          aria-label={labels.category}
          value={category}
          onChange={(e) => setCategory(e.currentTarget.value)}
        >
          <option value="">{`${labels.category}: ${labels.all}`}</option>
          {Object.entries(labels.categories).map(([value, label]) => (
            <option value={value}>{label}</option>
          ))}
        </select>
        <label class="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={codedOnly}
            onChange={(e) => setCodedOnly(e.currentTarget.checked)}
          />
          {labels.codedOnly}
        </label>
      </form>

      {!rows ? (
        <p class="mt-6 text-muted">{labels.loading}</p>
      ) : (
        <>
          <p class="mt-4 text-sm text-muted">
            {labels.results.replace('{n}', String(filtered.length))}
          </p>
          {filtered.length === 0 && <p class="mt-4 text-muted">{labels.empty}</p>}
          <ul class="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {filtered.slice(0, limit).map((r) => (
              <li
                key={r[0]}
                class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
              >
                {r[7] && (
                  <span
                    class="rounded px-1.5 py-0.5 text-xs font-bold text-white"
                    style={{ background: CLASS_COLORS[r[7] as keyof typeof CLASS_COLORS] }}
                  >
                    {r[7]}
                  </span>
                )}
                <a href={`${base}/cars/${r[2]}/`} class="font-medium hover:underline">
                  {r[3]}
                </a>
                <span>{r[6]}</span>
                <span class="text-muted">
                  {labels.by}{' '}
                  <a href={`${base}/tuners/${r[4]}/`} class="hover:underline">
                    {r[5]}
                  </a>
                </span>
                {r[8] && <span class="text-xs text-muted">{labels.surfaces[r[8]] ?? r[8]}</span>}
                <span class="ml-auto">
                  {r[1] ? (
                    <button
                      type="button"
                      data-copy={r[1]}
                      data-copied-label={labels.copied}
                      title={labels.copy}
                      class="rounded-md border border-border bg-bg px-2 py-1 font-mono font-semibold tabular-nums hover:border-accent"
                    >
                      {formatShareCode(r[1])}
                    </button>
                  ) : (
                    <span class="text-xs text-muted">{labels.noCode.replace('{tuner}', r[5])}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {filtered.length > limit && (
            <button
              type="button"
              class="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:border-accent"
              onClick={() => setLimit(limit + PAGE)}
            >
              +{Math.min(PAGE, filtered.length - limit)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
