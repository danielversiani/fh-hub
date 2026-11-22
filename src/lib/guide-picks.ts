import { localePath, type Locale } from '../i18n';
import { buildBrowseData, type BrowseTune } from './browse';

/**
 * Tune boxes inside a guide (ADR-0024). A guide writes
 * `<tune-picks car="<car id>" class="C" surface="dirt" limit="3"></tune-picks>` where it recommends
 * a car; the box is filled from the site's catalogue at build time, so the tunes, codes and
 * credits stay current with every sync. An unknown car breaks the build.
 */

const TIER_ORDER = ['meta-plus', 'meta', 't0.5', 't1', 't1.5', 't2', 't3', 't4'];
const tierRank = (t?: string) => {
  const i = TIER_ORDER.indexOf(t ?? '');
  return i < 0 ? TIER_ORDER.length : i;
};

const TEXT = {
  'pt-br': {
    stock: 'De fábrica',
    by: 'de',
    noCode: 'sem código: busque o gamertag',
    inGame: 'no jogo',
    none: 'O catálogo ainda não tem tune desta classe e piso para este carro.',
    all: 'Ver todos os tunes deste carro',
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

function attrs(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
}

/** The box for one car, class and surface. */
function box(locale: Locale, a: Record<string, string>): string {
  const text = TEXT[locale];
  const data = buildBrowseData();
  const car = data.cars.find((c) => c.id === a.car);
  if (!car) throw new Error(`<tune-picks>: unknown car "${a.car}"`);
  const limit = Number(a.limit ?? 3);
  const picks = data.tunes
    .filter(
      (t: BrowseTune) =>
        t.car === car.id &&
        (!a.class || t.cls === a.class) &&
        (!a.surface || t.surface === a.surface),
    )
    .sort(
      (x, y) =>
        Number(Boolean(y.code)) - Number(Boolean(x.code)) ||
        tierRank(x.tier) - tierRank(y.tier) ||
        y.score - x.score,
    )
    .slice(0, limit);
  const href = localePath(locale, `/cars/${car.id}/`);
  const stock = [
    car.cls && car.pi ? `${text.stock}: ${car.cls} ${car.pi}` : '',
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
          return `<li><span class="tp-name">${esc(name)}</span>${by} ${how}</li>`;
        })
        .join('')
    : `<li class="tp-muted">${esc(text.none)}</li>`;
  return (
    `<div class="tune-picks">` +
    `<p class="tp-head"><a href="${href}">${esc(car.name)}</a>` +
    (label ? ` <span class="tp-chip">${esc(label)}</span>` : '') +
    `</p>` +
    (stock ? `<p class="tp-muted tp-stock">${esc(stock)}</p>` : '') +
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
