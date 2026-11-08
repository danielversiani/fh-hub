import type { BrowseCar, BrowseLap, BrowseMeta, BrowseTune } from '../lib/browse';
import {
  CLASS_COLORS,
  CLASS_ORDER,
  DIFFICULTY_COLORS,
  formatShareCode,
  RARITY_COLORS,
  TIER_COLORS,
  TIER_LABELS,
} from '../lib/ui';
import { slugify } from '../../pipeline/lib/text';
import type { CarClass, Difficulty, Rarity, Surface, Tier } from '../../pipeline/schema/enums';

export interface CarCardLabels {
  shareCode: string;
  copy: string;
  copied: string;
  noCode: string;
  tuneBy: string;
  recommendedWhy: string;
  defaultTier: string;
  metaRank: string;
  otherTunes: string;
  noTunes: string;
  obtain: string;
  auction: string;
  openPage: string;
  stock: string;
  notes: string;
  /** Site language: picks the translated notes and names. */
  lang: 'pt-br' | 'en';
  worldRecord: string;
  lapBy: string;
  spec: { drivetrain: string; tires: string; style: string; difficulty: string };
  surfaces: Record<string, string>;
  categories: Record<string, string>;
  tires: Record<string, string>;
  rarities: Record<string, string>;
  roles: Record<string, string>;
  difficulties: Record<string, string>;
  obtainMethods: Record<string, string>;
  /** Car type slug → name in the site's language. */
  carTypes: Record<string, string>;
}

export interface Build {
  cls: CarClass | null;
  surface: Surface | null;
  tier: Tier;
  listed: boolean;
  rank?: number;
  tunes: BrowseTune[];
  /** Lap times from time sheets for this car in this class (road only). */
  laps: BrowseLap[];
}

const TIER_ORDER: readonly Tier[] = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3'];
const tierIndex = (t: Tier) => TIER_ORDER.indexOf(t);
const SURFACE_ORDER: readonly (Surface | null)[] = ['road', 'dirt', 'cross-country', null];

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
 * tunes, best first. Every tuner the meta table recommends has a tune (pipeline: "tunes known only
 * from the meta table"), so a listed build is never empty.
 */
export function buildsFor(
  tunes: readonly BrowseTune[],
  meta: readonly BrowseMeta[],
  filter: { cls?: string; surface?: string } = {},
  laps: readonly BrowseLap[] = [],
): Build[] {
  const builds = new Map<string, Build>();
  const keyOf = (cls: string | null, surface: string | null) => `${cls ?? '?'}|${surface ?? '?'}`;
  const metaByKey = new Map(meta.map((m) => [keyOf(m.cls, m.surface), m]));
  for (const t of tunes) {
    const key = keyOf(t.cls, t.surface);
    const m = metaByKey.get(key);
    const build = builds.get(key) ?? {
      cls: t.cls,
      surface: t.surface,
      tier: m?.tier ?? t.tier ?? 't3',
      listed: Boolean(m) || t.listed,
      rank: m?.rank ?? t.rank,
      tunes: [],
      laps: laps.filter((l) => t.surface === 'road' && l.cls === t.cls),
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

/** "Concessionária, Roleta" + whether the auction house is worth a look (owner's rule). */
export function obtainText(
  methods: readonly string[],
  labels: Pick<CarCardLabels, 'obtainMethods'>,
): { text: string; auction: boolean } {
  return {
    text: methods.map((m) => labels.obtainMethods[m] ?? m).join(', '),
    // Wheelspin / playlist cars that the Autoshow does not sell are traded at the auction house.
    auction:
      methods.some((m) => m === 'wheelspin' || m === 'seasonal') &&
      !methods.some((m) => m === 'autoshow' || m === 'autoshow-dlc'),
  };
}

/** The car's photo (Forza Wiki, ADR-0013), 16:9, loaded only when visible. */
export function CarPhoto({ car, class: className = '' }: { car: BrowseCar; class?: string }) {
  if (!car.image) return null;
  return (
    <div class={`car-photo ${className}`}>
      <img
        src={car.image}
        alt={car.name}
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />
    </div>
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
    <span class="chip text-white" style={{ background: CLASS_COLORS[cls] }}>
      {cls}
      {pi !== undefined && <span class="ml-1 font-semibold opacity-90">{pi}</span>}
    </span>
  );
}

export function RarityChip({ rarity, label }: { rarity: Rarity | undefined; label: string }) {
  if (!rarity) return null;
  return (
    <span class="chip chip-outline" style={{ color: RARITY_COLORS[rarity] }}>
      {label}
    </span>
  );
}

export function TierChip({ tier, muted = false }: { tier: Tier; muted?: boolean }) {
  return (
    <span
      class="chip text-white"
      style={{ background: TIER_COLORS[tier], opacity: muted ? 0.55 : 1 }}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

export function DifficultyText({ difficulty, label }: { difficulty: Difficulty; label: string }) {
  return (
    <span class="font-semibold" style={{ color: DIFFICULTY_COLORS[difficulty] }}>
      {label}
    </span>
  );
}

function CodeBox({ tune, labels }: { tune: BrowseTune; labels: CarCardLabels }) {
  if (!tune.code) {
    return (
      <p class="code-box text-sm text-muted">{labels.noCode.replace('{tuner}', tune.tunerName)}</p>
    );
  }
  return (
    <div class="code-box">
      <div>
        <p class="label">{labels.shareCode}</p>
        <p class="code-digits">{formatShareCode(tune.code)}</p>
      </div>
      <button
        type="button"
        data-copy={tune.code}
        data-copied-label={labels.copied}
        title={labels.copy}
        aria-label={labels.copy}
        class="rounded border border-border px-2.5 py-1.5 text-sm text-muted hover:border-accent hover:text-text"
      >
        ⧉
      </button>
    </div>
  );
}

/** The meta table's columns for a tune: drivetrain, tires, style, difficulty. */
function Specs({ tune, labels }: { tune: BrowseTune; labels: CarCardLabels }) {
  const specs: [string, preact.ComponentChildren][] = [];
  if (tune.drivetrain) specs.push([labels.spec.drivetrain, tune.drivetrain]);
  if (tune.tires) specs.push([labels.spec.tires, labels.tires[tune.tires] ?? tune.tires]);
  if (tune.role) specs.push([labels.spec.style, labels.roles[tune.role] ?? tune.role]);
  if (tune.difficulty)
    specs.push([
      labels.spec.difficulty,
      <DifficultyText
        difficulty={tune.difficulty}
        label={labels.difficulties[tune.difficulty] ?? tune.difficulty}
      />,
    ]);
  if (specs.length === 0) return null;
  return (
    <dl class="specs">
      {specs.map(([label, value]) => (
        <div>
          <dt class="label">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LapChips({
  tune,
  laps,
  labels,
}: {
  tune?: BrowseTune;
  laps: readonly BrowseLap[];
  labels: CarCardLabels;
}) {
  const refs = tune?.laps ?? [];
  if (refs.length === 0 && laps.length === 0) return null;
  return (
    <ul class="flex flex-wrap gap-1.5">
      {refs.map((r) => (
        <li class="lap-chip">
          <span class="tabular-nums">{r.time}</span> · {r.track}
          {r.worldRecord && <span class="ml-1 text-accent">{labels.worldRecord}</span>}
        </li>
      ))}
      {laps.map((l) => (
        <li class="lap-chip" title={l.tuner ? `${l.driver} · ${l.tuner}` : l.driver}>
          <span class="tabular-nums">{l.time}</span> · {l.track}
          <span class="ml-1 text-muted">{labels.lapBy.replace('{driver}', l.driver)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The meta table's note, already translated by the pipeline (ADR-0014); hidden when empty. */
function Notes({ tune, labels }: { tune: BrowseTune; labels: CarCardLabels }) {
  const text = tune.notes?.[labels.lang];
  if (!text) return null;
  return (
    <p class="text-sm">
      <span class="label mr-1.5">{labels.notes}</span>
      {text}
    </p>
  );
}

/** The tune's name in the site's language (a few tuners write it in Chinese). */
const tuneName = (tune: BrowseTune, labels: CarCardLabels) =>
  tune.nameI18n?.[labels.lang] || tune.name;

export const carTypeName = (type: string, labels: Pick<CarCardLabels, 'carTypes'>) =>
  labels.carTypes[slugify(type)] ?? type;

function BuildCard({ build, labels, base }: { build: Build; labels: CarCardLabels; base: string }) {
  const [top, ...others] = build.tunes;
  return (
    <div class="build-card flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <TierChip tier={build.tier} muted={!build.listed} />
        <ClassChip cls={build.cls} />
        {build.listed && build.rank && (
          <span class="text-xs text-muted">
            {labels.metaRank.replace('{n}', String(build.rank))}
          </span>
        )}
      </div>
      {!build.listed && <p class="text-xs text-muted">{labels.defaultTier}</p>}
      {top ? (
        <>
          <div>
            <p class="label">{labels.tuneBy}</p>
            <a href={`${base}/tuners/${top.tuner}/`} class="tuner-name">
              {top.tunerName}
            </a>
            {!top.fromMeta && <p class="mt-0.5 text-sm text-muted">{tuneName(top, labels)}</p>}
          </div>
          <CodeBox tune={top} labels={labels} />
          <Specs tune={top} labels={labels} />
          <LapChips tune={top} laps={build.laps} labels={labels} />
          <Notes tune={top} labels={labels} />
          {top.credited && !top.fromMeta && (
            <p class="text-xs text-muted">{labels.recommendedWhy}</p>
          )}
        </>
      ) : (
        <p class="text-sm text-muted">{labels.noTunes}</p>
      )}
      {others.length > 0 && (
        <details class="text-sm">
          <summary class="text-muted hover:text-text">
            {labels.otherTunes.replace('{n}', String(others.length))} ▾
          </summary>
          <ul class="mt-2 divide-y divide-border">
            {others.map((t) => (
              <li class="flex flex-col gap-1.5 py-2.5">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <a href={`${base}/tuners/${t.tuner}/`} class="font-semibold hover:text-accent">
                    {t.tunerName}
                  </a>
                  {!t.fromMeta && <span class="text-xs text-muted">{tuneName(t, labels)}</span>}
                  {t.listed && t.tier && t.tier !== build.tier && <TierChip tier={t.tier} />}
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
                      <span class="text-xs text-muted">
                        {labels.noCode.replace('{tuner}', t.tunerName)}
                      </span>
                    )}
                  </span>
                </div>
                <Specs tune={t} labels={labels} />
                {(t.laps?.length ?? 0) > 0 && <LapChips tune={t} laps={[]} labels={labels} />}
                <Notes tune={t} labels={labels} />
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
  /** "" for Portuguese, "/en" for English: links to tuner pages. */
  base: string;
  /** Link to the car's own page (omitted on the car page itself). */
  href?: string;
}

/** The expanded view of a car: its builds grouped by surface (asphalt, dirt, cross country). */
export default function CarCard({ car, builds, labels, base, href }: Props) {
  const obtain = obtainText(car.obtain, labels);
  const groups = SURFACE_ORDER.map((surface) => ({
    surface,
    builds: builds.filter((b) => b.surface === surface),
  })).filter((g) => g.builds.length > 0);
  // Stock class, PI and drivetrain: a footnote, since a tune changes all three (owner's request).
  const stock = [car.cls && `${car.cls} ${car.pi ?? ''} PI`, car.drivetrain]
    .filter(Boolean)
    .join(' · ');
  return (
    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        {car.image && <CarPhoto car={car} class="sm:w-64" />}
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>{car.types.map((type) => carTypeName(type, labels)).join(', ')}</span>
          {obtain.text && (
            <span>
              <span class="label mr-1.5">{labels.obtain}</span>
              {obtain.text}
              {obtain.auction && <span class="ml-1.5 text-text">· {labels.auction}</span>}
            </span>
          )}
        </div>
      </div>
      {groups.length === 0 ? (
        <p class="text-sm text-muted">{labels.noTunes}</p>
      ) : (
        groups.map((g) => (
          <section>
            <h4 class="surface-divider">
              <span>{g.surface ? labels.surfaces[g.surface] : labels.surfaces.unknown}</span>
            </h4>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              {g.builds.map((b) => (
                <BuildCard build={b} labels={labels} base={base} />
              ))}
            </div>
          </section>
        ))
      )}
      <p class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted">
        {stock && (
          <span>
            {labels.stock}: {stock}
          </span>
        )}
        {href && (
          <a href={href} class="ml-auto text-accent hover:underline">
            {labels.openPage} →
          </a>
        )}
      </p>
    </div>
  );
}
