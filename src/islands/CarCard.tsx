import type { BrowseCar, BrowseMeta, BrowseTune } from '../lib/browse';
import {
  CLASS_COLORS,
  CLASS_ORDER,
  formatShareCode,
  RARITY_COLORS,
  TIER_COLORS,
  TIER_LABELS,
} from '../lib/ui';
import type { CarClass, Rarity, Surface, Tier } from '../../pipeline/schema/enums';

export interface CarCardLabels {
  shareCode: string;
  copy: string;
  copied: string;
  noCode: string;
  by: string;
  recommended: string;
  recommendedWhy: string;
  defaultTier: string;
  metaTuners: string;
  otherTunes: string;
  noTunes: string;
  obtain: string;
  openPage: string;
  surfaces: Record<string, string>;
  categories: Record<string, string>;
  tires: Record<string, string>;
  rarities: Record<string, string>;
}

export interface Build {
  cls: CarClass | null;
  surface: Surface | null;
  tier: Tier;
  listed: boolean;
  rank?: number;
  metaTuners: string[];
  tunes: BrowseTune[];
}

const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];
const tierIndex = (t: Tier) => TIER_ORDER.indexOf(t);

/** Better tier, credited by the meta table, has a share code, table rank, internal score. */
export const compareTunes = (a: BrowseTune, b: BrowseTune) =>
  tierIndex(a.tier ?? 't3') - tierIndex(b.tier ?? 't3') ||
  Number(b.credited) - Number(a.credited) ||
  Number(Boolean(b.code)) - Number(Boolean(a.code)) ||
  (a.rank ?? 9999) - (b.rank ?? 9999) ||
  b.score - a.score ||
  a.id.localeCompare(b.id);

/**
 * One "build" per class × surface: the car's tier there (meta table, or T3 by default) and its
 * tunes, best first. This replaces the old separate "In the meta" and "Tunes" blocks.
 */
export function buildsFor(
  tunes: readonly BrowseTune[],
  meta: readonly BrowseMeta[],
  filter: { cls?: string; surface?: string } = {},
): Build[] {
  const builds = new Map<string, Build>();
  const keyOf = (cls: string | null, surface: string | null) => `${cls ?? '?'}|${surface ?? '?'}`;
  for (const m of meta) {
    builds.set(keyOf(m.cls, m.surface), {
      cls: m.cls,
      surface: m.surface,
      tier: m.tier,
      listed: true,
      rank: m.rank,
      metaTuners: m.tuners,
      tunes: [],
    });
  }
  for (const t of tunes) {
    const key = keyOf(t.cls, t.surface);
    const build = builds.get(key) ?? {
      cls: t.cls,
      surface: t.surface,
      tier: t.tier ?? 't3',
      listed: t.listed,
      rank: t.rank,
      metaTuners: [],
      tunes: [],
    };
    build.tunes.push(t);
    builds.set(key, build);
  }
  return [...builds.values()]
    .filter(
      (b) =>
        (!filter.cls || b.cls === filter.cls) && (!filter.surface || b.surface === filter.surface),
    )
    .map((b) => ({ ...b, tunes: [...b.tunes].sort(compareTunes) }))
    .sort(
      (a, b) =>
        tierIndex(a.tier) - tierIndex(b.tier) ||
        CLASS_ORDER.indexOf(b.cls ?? 'D') - CLASS_ORDER.indexOf(a.cls ?? 'D') ||
        (a.surface ?? 'z').localeCompare(b.surface ?? 'z'),
    );
}

export function ClassChip({
  cls,
  pi,
}: {
  cls: CarClass | null | undefined;
  pi?: number | undefined;
}) {
  if (!cls) return null;
  return (
    <span
      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold text-white tabular-nums"
      style={{ background: CLASS_COLORS[cls] }}
    >
      {cls}
      {pi !== undefined && <span class="font-semibold opacity-90">{pi}</span>}
    </span>
  );
}

export function RarityChip({ rarity, label }: { rarity: Rarity | undefined; label: string }) {
  if (!rarity) return null;
  return (
    <span
      class="eyebrow inline-block rounded px-1.5 py-0.5 text-black"
      style={{ background: RARITY_COLORS[rarity], fontSize: '0.65rem' }}
    >
      {label}
    </span>
  );
}

export function TierChip({ tier, muted = false }: { tier: Tier; muted?: boolean }) {
  return (
    <span
      class="inline-block rounded px-1.5 py-0.5 text-xs font-bold text-white"
      style={{ background: TIER_COLORS[tier], opacity: muted ? 0.55 : 1 }}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

function CopyButton({ code, labels }: { code: string; labels: CarCardLabels }) {
  return (
    <div class="code-box">
      <div>
        <p class="eyebrow text-muted" style={{ fontSize: '0.65rem' }}>
          {labels.shareCode}
        </p>
        <p class="code-digits">{formatShareCode(code)}</p>
      </div>
      <button
        type="button"
        data-copy={code}
        data-copied-label={labels.copied}
        title={labels.copy}
        aria-label={labels.copy}
        class="rounded-md border border-border px-2.5 py-1.5 text-sm text-muted hover:border-accent hover:text-text"
      >
        ⧉
      </button>
    </div>
  );
}

function BuildCard({ build, labels }: { build: Build; labels: CarCardLabels }) {
  const [top, ...others] = build.tunes;
  const surface = build.surface ? labels.surfaces[build.surface] : labels.surfaces.unknown;
  return (
    <div class="card flex flex-col gap-3 p-4" style={{ background: 'var(--color-surface-2)' }}>
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full border border-accent/60 px-2.5 py-0.5 text-xs font-semibold text-accent">
          {surface}
        </span>
        <TierChip tier={build.tier} muted={!build.listed} />
        {top && <span class="eyebrow text-accent">{labels.recommended}</span>}
        <span class="ml-auto">
          <ClassChip cls={build.cls} />
        </span>
      </div>
      {!build.listed && <p class="text-xs text-muted">{labels.defaultTier}</p>}
      {top ? (
        <>
          {top.code ? (
            <CopyButton code={top.code} labels={labels} />
          ) : (
            <p class="code-box text-sm text-muted">
              {labels.noCode.replace('{tuner}', top.tunerName)}
            </p>
          )}
          <div>
            <p class="font-semibold">{top.name}</p>
            <p class="eyebrow mt-1 text-muted">
              {labels.by} <span class="text-accent">{top.tunerName}</span>
              {top.drivetrain && ` · ${top.drivetrain}`}
              {top.tires && ` · ${labels.tires[top.tires] ?? top.tires}`}
            </p>
            {top.credited && <p class="mt-1 text-xs text-muted">{labels.recommendedWhy}</p>}
            {top.cats.length > 0 && (
              <p class="mt-2 flex flex-wrap gap-1.5">
                {top.cats.map((c) => (
                  <span class="rounded border border-border px-1.5 py-0.5 text-xs text-muted">
                    {labels.categories[c] ?? c}
                  </span>
                ))}
              </p>
            )}
          </div>
        </>
      ) : (
        <p class="text-sm text-muted">{labels.noTunes}</p>
      )}
      {build.metaTuners.length > 0 && (
        <p class="text-xs text-muted">
          {labels.metaTuners}: {build.metaTuners.join(', ')}
        </p>
      )}
      {others.length > 0 && (
        <details class="text-sm">
          <summary class="text-muted hover:text-text">
            {labels.otherTunes.replace('{n}', String(others.length))} ▾
          </summary>
          <ul class="mt-2 divide-y divide-border">
            {others.map((t) => (
              <li class="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                <span class="font-medium">{t.name}</span>
                <span class="text-xs text-muted">
                  {labels.by} {t.tunerName}
                  {t.drivetrain && ` · ${t.drivetrain}`}
                </span>
                <span class="ml-auto">
                  {t.code ? (
                    <button
                      type="button"
                      data-copy={t.code}
                      data-copied-label={labels.copied}
                      title={labels.copy}
                      class="rounded border border-border px-2 py-0.5 font-mono text-xs tabular-nums hover:border-accent"
                    >
                      {formatShareCode(t.code)}
                    </button>
                  ) : (
                    <span class="text-xs text-muted">—</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

interface Props {
  car: BrowseCar;
  builds: Build[];
  labels: CarCardLabels;
  /** Link to the car's own page (omitted on the car page itself). */
  href?: string;
}

/** The expanded view of a car: one card per class × surface build. */
export default function CarCard({ car, builds, labels, href }: Props) {
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>{car.types.join(', ')}</span>
        {car.obtain && (
          <span>
            {labels.obtain}: {car.obtain}
          </span>
        )}
        {href && (
          <a href={href} class="ml-auto text-accent hover:underline">
            {labels.openPage} →
          </a>
        )}
      </div>
      {builds.length === 0 ? (
        <p class="text-sm text-muted">{labels.noTunes}</p>
      ) : (
        <div class="grid gap-4 md:grid-cols-2">
          {builds.map((b) => (
            <BuildCard build={b} labels={labels} />
          ))}
        </div>
      )}
    </div>
  );
}
