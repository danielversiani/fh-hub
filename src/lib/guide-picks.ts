import { localePath, type Locale } from '../i18n';
import { buildBrowseData, type BrowseTune } from './browse';

/**
 * Tune boxes inside a guide (ADR-0024). A guide writes
 * `<tune-picks car="<car id>" class="C" surface="dirt" limit="3"></tune-picks>` where it recommends
 * a car; the box is filled from the site's catalogue at build time, so the tunes, codes and
 * credits stay current with every sync. An unknown car breaks the build.
 *
 * Order (owner, 2026-11-25): the tunes the guide pins (`pick="<tune id>,…"`), then the Forza
 * Paddock's own picks (ADR-0020), then tunes that keep the car's stock drivetrain (a swap makes
 * the upgrade expensive), then easy ones. Hard tunes and powerbuilds stay out unless pinned: a
 * beginner cannot drive them. Each tune says whether it keeps the drivetrain, which tyres it uses
 * and how easy it is, when the source says so.
 */

const TIER_ORDER = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3', 't4'];
const tierRank = (t?: string) => {
  const i = TIER_ORDER.indexOf(t ?? '');
  return i < 0 ? TIER_ORDER.length : i;
};

/** 0 = keeps the stock drivetrain, 1 = unknown, 2 = swaps it. */
export const swapRank = (tune?: string, stock?: string) =>
  !tune || !stock ? 1 : tune === stock ? 0 : 2;

const EASY = new Set(['brain-afk', 'very-easy', 'easy']);
const POWER = /\b(power|speed)\b/i;

type Pickable = Pick<
  BrowseTune,
  'id' | 'name' | 'drivetrain' | 'code' | 'tier' | 'score' | 'difficulty' | 'recommended'
>;

/** Hard tunes and powerbuilds are left out of a beginners' guide. */
export const tooHard = (t: Pick<BrowseTune, 'name' | 'difficulty'>) =>
  t.difficulty === 'hard' || t.difficulty === 'death' || /power\s*build/i.test(t.name);

/** 0 = easy or very easy, 1 = unknown, 2 = medium, or "power" / "speed" in the name. */
export const easeRank = (t: Pick<BrowseTune, 'name' | 'difficulty'>) =>
  t.difficulty && EASY.has(t.difficulty)
    ? 0
    : t.difficulty === 'medium' || POWER.test(t.name)
      ? 2
      : 1;

/**
 * The box's order: pinned tunes (in the guide's order), the Forza Paddock's picks, stock
 * drivetrain, easy, then tunes with a code, tier and score.
 */
export function orderPicks<T extends Pickable>(
  tunes: T[],
  stockDrivetrain?: string,
  pins: string[] = [],
): T[] {
  const pin = (t: T) => (pins.includes(t.id) ? pins.indexOf(t.id) : pins.length);
  return [...tunes].sort(
    (x, y) =>
      pin(x) - pin(y) ||
      Number(Boolean(y.recommended)) - Number(Boolean(x.recommended)) ||
      swapRank(x.drivetrain, stockDrivetrain) - swapRank(y.drivetrain, stockDrivetrain) ||
      easeRank(x) - easeRank(y) ||
      Number(Boolean(y.code)) - Number(Boolean(x.code)) ||
      tierRank(x.tier) - tierRank(y.tier) ||
      y.score - x.score,
  );
}

/**
 * The tunes a box shows. A pinned tune the catalogue no longer has is skipped (see the test);
 * `skip` leaves tunes out on purpose (an unfit name, say).
 */
export function selectPicks<T extends Pickable & Pick<BrowseTune, 'cls' | 'surface'>>(
  tunes: T[],
  opts: {
    cls?: string;
    surface?: string;
    stockDrivetrain?: string;
    pins?: string[];
    skip?: string[];
    limit: number;
  },
): T[] {
  const pins = opts.pins ?? [];
  const shown = tunes.filter(
    (t) =>
      pins.includes(t.id) ||
      (!tooHard(t) &&
        !opts.skip?.includes(t.id) &&
        (!opts.cls || t.cls === opts.cls) &&
        (!opts.surface || t.surface === opts.surface)),
  );
  return orderPicks(shown, opts.stockDrivetrain, pins).slice(0, opts.limit);
}

const TEXT = {
  'pt-br': {
    stock: 'De fábrica',
    by: 'de',
    noCode: 'sem código: busque o gamertag',
    inGame: 'no jogo',
    none: 'O catálogo ainda não tem tune desta classe e piso para este carro.',
    all: 'Ver todos os tunes deste carro',
    for: 'Para',
    keeps: 'tração original',
    swaps: (d: string) => `troca para ${d}`,
    paddock: 'escolha do Forza Paddock',
    ease: {
      'brain-afk': 'muito fácil',
      'very-easy': 'muito fácil',
      easy: 'fácil',
      medium: 'dificuldade média',
    } as Record<string, string>,
    tires: {
      rally: 'pneu de rali',
      offroad: 'pneu off-road',
      slick: 'pneu slick',
      'super-slick': 'pneu super slick',
      'semi-slick': 'pneu semi-slick',
      drift: 'pneu de drift',
      vintage: 'pneu vintage',
      street: 'pneu de rua',
      snow: 'pneu de neve',
      stock: 'pneu de fábrica',
    } as Record<string, string>,
    obtain: {
      autoshow: 'Autoshow',
      wheelspin: 'Wheelspin',
      'collection-journal': 'Collection Journal',
      seasonal: 'Playlist',
    } as Record<string, string>,
    surface: { road: 'asfalto', dirt: 'terra', 'cross-country': 'cross country' } as Record<
      string,
      string
    >,
  },
  en: {
    stock: 'Stock',
    by: 'by',
    noCode: 'no code: search the gamertag',
    inGame: 'in game',
    none: 'The catalogue has no tune for this class and surface on this car yet.',
    all: "See all of this car's tunes",
    for: 'For',
    keeps: 'stock drivetrain',
    swaps: (d: string) => `swaps to ${d}`,
    paddock: 'Forza Paddock pick',
    ease: {
      'brain-afk': 'very easy',
      'very-easy': 'very easy',
      easy: 'easy',
      medium: 'medium difficulty',
    } as Record<string, string>,
    tires: {
      rally: 'rally tyres',
      offroad: 'off-road tyres',
      slick: 'slick tyres',
      'super-slick': 'super slick tyres',
      'semi-slick': 'semi-slick tyres',
      drift: 'drift tyres',
      vintage: 'vintage tyres',
      street: 'street tyres',
      snow: 'snow tyres',
      stock: 'stock tyres',
    } as Record<string, string>,
    obtain: {
      autoshow: 'Autoshow',
      wheelspin: 'Wheelspin',
      'collection-journal': 'Collection Journal',
      seasonal: 'Playlist',
    } as Record<string, string>,
    surface: { road: 'road', dirt: 'dirt', 'cross-country': 'cross country' } as Record<
      string,
      string
    >,
  },
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const code = (c: string) => c.replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ');

const list = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

function attrs(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
}

/** The box for one car, class and surface. */
function box(locale: Locale, a: Record<string, string>): string {
  const text = TEXT[locale];
  const data = buildBrowseData();
  const car = data.cars.find((c) => c.id === a.car);
  if (!car) throw new Error(`<tune-picks>: unknown car "${a.car}"`);
  const picks = selectPicks(
    data.tunes.filter((t: BrowseTune) => t.car === car.id),
    {
      cls: a.class,
      surface: a.surface,
      stockDrivetrain: car.drivetrain,
      pins: list(a.pick),
      skip: list(a.skip),
      limit: Number(a.limit ?? 3),
    },
  );
  const href = localePath(locale, `/cars/${car.id}/`);
  const stock = [
    car.cls && car.pi
      ? `${text.stock}: ${car.cls} ${car.pi}${car.drivetrain ? `, ${car.drivetrain}` : ''}`
      : '',
    car.obtain.map((o) => text.obtain[o] ?? o).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
  const label = [a.class, a.surface ? text.surface[a.surface] : ''].filter(Boolean).join(' · ');
  const items = picks.length
    ? picks
        .map((t) => {
          const name = t.nameI18n?.[locale] ?? t.name;
          const how = t.code
            ? `<code>${esc(code(t.code))}</code>`
            : `<span class="tp-muted">${esc(text.noCode)} <strong>${esc(t.tunerName)}</strong> ${esc(text.inGame)}</span>`;
          // Without a code the gamertag already names the tuner, so it is not repeated.
          const by = t.code
            ? ` <span class="tp-muted">${esc(text.by)} ${esc(t.tunerName)}</span>`
            : '';
          const rank = swapRank(t.drivetrain, car.drivetrain);
          const tags = [
            t.recommended ? text.paddock : '',
            rank === 0 ? text.keeps : rank === 2 ? text.swaps(t.drivetrain!) : '',
            t.tires ? (text.tires[t.tires] ?? '') : '',
            t.difficulty ? (text.ease[t.difficulty] ?? '') : '',
          ].filter(Boolean);
          const tagLine = tags.length
            ? ` <span class="tp-tags">${esc(tags.join(' · '))}</span>`
            : '';
          return `<li><span class="tp-name">${esc(name)}</span>${by} ${how}${tagLine}</li>`;
        })
        .join('')
    : `<li class="tp-muted">${esc(text.none)}</li>`;
  return (
    `<div class="tune-picks">` +
    `<p class="tp-head"><a href="${href}">${esc(car.name)}</a>` +
    (label ? ` <span class="tp-chip">${esc(label)}</span>` : '') +
    `</p>` +
    (stock ? `<p class="tp-muted tp-stock">${esc(stock)}</p>` : '') +
    (a.for ? `<p class="tp-for">${esc(text.for)}: ${esc(a.for)}</p>` : '') +
    `<ul>${items}</ul>` +
    `<p class="tp-all"><a href="${href}">${esc(text.all)} →</a></p>` +
    `</div>`
  );
}

/** Replaces every `<tune-picks …></tune-picks>` in a guide's HTML with its box. */
export function fillTunePicks(html: string, locale: Locale): string {
  return html.replace(/<tune-picks\b([^>]*)>\s*<\/tune-picks>/g, (_, rest: string) =>
    box(locale, attrs(rest)),
  );
}
