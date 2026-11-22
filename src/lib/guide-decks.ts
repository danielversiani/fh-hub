import fs from 'node:fs';
import path from 'node:path';
import { localePath, type Locale } from '../i18n';
import { buildBrowseData } from './browse';

/**
 * Card decks inside a guide (ADR-0024): `<card-deck set="barns"></card-deck>` becomes a stack of
 * cards, one per barn find or treasure car, shuffled through with arrows or a swipe (the script is
 * in GuidePage.astro). Each card shows the place on the game map and in game when the screenshots
 * exist in `public/guides/collectibles/<id>-map.webp` and `<id>-game.webp`; until then it says so.
 */

type Stamp = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple' | 'gold';

interface Item {
  id: string;
  car: string;
  region: string;
  stamp?: Stamp;
  hint: { 'pt-br': string; en: string };
}

const BARNS: Item[] = [
  {
    id: 'barn-nsx',
    car: '2005-honda-nsx-r-gt',
    region: 'Ohtani',
    stamp: 'yellow',
    hint: {
      'pt-br': 'A sudeste do templo Kinkaku-ji (um guia diz Nangan).',
      en: 'South-east of Kinkaku-ji temple (one guide says Nangan).',
    },
  },
  {
    id: 'barn-sierra',
    car: '1987-ford-sierra-cosworth-rs500',
    region: 'Ito',
    stamp: 'green',
    hint: {
      'pt-br': 'Numa clareira a sudeste dos campos.',
      en: 'In a clearing south-east of the fields.',
    },
  },
  {
    id: 'barn-2000gt',
    car: '1969-toyota-2000gt',
    region: 'Ito',
    stamp: 'green',
    hint: {
      'pt-br': 'Perto da praia, na costa sudeste (um guia diz arredores ao norte de Tóquio).',
      en: "Near the beach on the south-east coast (one guide says Tokyo's northern outskirts).",
    },
  },
  {
    id: 'barn-skyline-71',
    car: '1971-nissan-skyline-2000gt-r',
    region: 'Nangan',
    stamp: 'blue',
    hint: { 'pt-br': 'Localização exata em breve.', en: 'Exact spot coming soon.' },
  },
  {
    id: 'barn-pao',
    car: '1989-nissan-pao',
    region: 'Minamino',
    stamp: 'blue',
    hint: { 'pt-br': 'Localização exata em breve.', en: 'Exact spot coming soon.' },
  },
  {
    id: 'barn-pennzoil',
    car: '1998-nissan-23-pennzoil-nismo-skyline-gt-r',
    region: 'Takashiro',
    stamp: 'pink',
    hint: { 'pt-br': 'Localização exata em breve.', en: 'Exact spot coming soon.' },
  },
  {
    id: 'barn-continental',
    car: '1962-lincoln-continental',
    region: 'Hokubu',
    stamp: 'pink',
    hint: { 'pt-br': 'Localização exata em breve.', en: 'Exact spot coming soon.' },
  },
  {
    id: 'barn-205',
    car: '1984-peugeot-205-turbo-16',
    region: 'Shimanoyama',
    stamp: 'pink',
    hint: { 'pt-br': 'A sudoeste de Narai-Juku.', en: 'South-west of Narai-Juku.' },
  },
  {
    id: 'barn-911',
    car: '1982-porsche-911-turbo-3-3',
    region: 'Ohtani',
    stamp: 'pink',
    hint: {
      'pt-br': 'Um guia diz Ohtani ou Tokyo City.',
      en: 'One guide says Ohtani or Tokyo City.',
    },
  },
  {
    id: 'barn-diablo',
    car: '1997-lamborghini-diablo-sv',
    region: 'Ito',
    stamp: 'orange',
    hint: { 'pt-br': 'Um guia diz Ohtani.', en: 'One guide says Ohtani.' },
  },
  {
    id: 'barn-montero',
    car: '1997-mitsubishi-montero-evolution',
    region: 'Shimanoyama',
    stamp: 'orange',
    hint: { 'pt-br': 'Localização exata em breve.', en: 'Exact spot coming soon.' },
  },
  {
    id: 'barn-sierra-evo',
    car: '2005-mitsubishi-1-sierra-sierra-enterprises-lancer-evolution-time-attack',
    region: 'Shimanoyama',
    stamp: 'purple',
    hint: { 'pt-br': 'Perto de Narai-Juku.', en: 'Near Narai-Juku.' },
  },
  {
    id: 'barn-r390',
    car: '1998-nissan-r390-gt1',
    region: 'Ohtani',
    stamp: 'purple',
    hint: { 'pt-br': 'Um guia diz Ito.', en: 'One guide says Ito.' },
  },
  {
    id: 'barn-787b',
    car: '1991-mazda-55-mazda-787b',
    region: 'Takashiro',
    stamp: 'gold',
    hint: {
      'pt-br': 'A oeste do castelo de Hirosaki. Meta nas classes S1, S2 e R.',
      en: 'West of Hirosaki Castle. Meta in S1, S2 and R.',
    },
  },
  {
    id: 'barn-tomica',
    car: '1983-nissan-11-tomica-skyline-turbo-super-silhouette',
    region: 'Ito',
    stamp: 'gold',
    hint: { 'pt-br': 'Meta na S1, no asfalto e na terra.', en: 'Meta in S1, on road and dirt.' },
  },
];

const TREASURES: Item[] = [
  {
    id: 'treasure-m1',
    car: '1981-bmw-m1',
    region: 'Hokubu',
    hint: {
      'pt-br': 'Embaixo da linha de trem, de frente para os campos.',
      en: 'Under the train tracks, overlooking the fields.',
    },
  },
  {
    id: 'treasure-safari',
    car: '1985-nissan-safari-turbo',
    region: 'Ito',
    hint: {
      'pt-br': 'Ponta norte de Ito, na base de uma turbina eólica.',
      en: 'Northern tip of Ito, at the base of a wind turbine.',
    },
  },
  {
    id: 'treasure-charger',
    car: '1969-dodge-charger-r-t',
    region: 'Minamino',
    hint: { 'pt-br': 'Atrás do prédio do campo de golfe.', en: 'Behind the golf course building.' },
  },
  {
    id: 'treasure-ford-gt',
    car: '2005-ford-gt',
    region: 'Nangan',
    hint: {
      'pt-br': 'Pequeno mirante na ponta sul. Excelente na classe A: pegue logo no começo.',
      en: 'Small lookout at the south end. Excellent in A class: grab it early.',
    },
  },
  {
    id: 'treasure-rx7',
    car: '1985-mazda-rx-7-gsl-se',
    region: 'Ohtani',
    hint: {
      'pt-br': 'Perto de um mascote, abaixo de uma torre de rádio, de frente para o Monte Fuji.',
      en: 'Near a mascot, below a radio tower facing Mt Fuji.',
    },
  },
  {
    id: 'treasure-959',
    car: '1987-porsche-959',
    region: 'Shimanoyama',
    hint: {
      'pt-br': 'Atrás da loja de conveniência, no grupo de prédios do norte.',
      en: 'Behind the convenience store in the northern building cluster.',
    },
  },
  {
    id: 'treasure-stratos',
    car: '1974-lancia-stratos-hf-stradale',
    region: 'Sotoyama',
    hint: {
      'pt-br': 'Ao norte da Tateyama Kurobe Alpine Route, ao lado de um hotel.',
      en: 'North of the Tateyama Kurobe Alpine Route, beside a hotel.',
    },
  },
  {
    id: 'treasure-evo3',
    car: '1995-mitsubishi-lancer-evolution-iii-gsr',
    region: 'Takashiro',
    hint: {
      'pt-br':
        'Ao norte do templo das cachoeiras de Nachi, no ponto de descanso ao pé da cachoeira.',
      en: 'North of the Nachi Falls temple, at the rest point at the foot of the falls.',
    },
  },
  {
    id: 'treasure-figaro',
    car: '1991-nissan-figaro',
    region: 'Tokyo City',
    hint: {
      'pt-br': 'Lado sul, perto da água, num estacionamento pequeno.',
      en: 'South side near the water, in a small car park.',
    },
  },
];

const SETS: Record<string, Item[]> = { barns: BARNS, treasures: TREASURES };

const TEXT = {
  'pt-br': {
    stamp: {
      yellow: 'Carimbo amarelo',
      green: 'Carimbo verde',
      blue: 'Carimbo azul',
      pink: 'Carimbo rosa',
      orange: 'Carimbo laranja',
      purple: 'Carimbo roxo',
      gold: 'Carimbo dourado',
    },
    treasure: 'Carro tesouro',
    map: 'No mapa',
    game: 'No jogo',
    soon: 'Screenshot em breve',
    prev: 'Anterior',
    next: 'Próximo',
    stock: 'De fábrica',
  },
  en: {
    stamp: {
      yellow: 'Yellow stamp',
      green: 'Green stamp',
      blue: 'Blue stamp',
      pink: 'Pink stamp',
      orange: 'Orange stamp',
      purple: 'Purple stamp',
      gold: 'Gold stamp',
    },
    treasure: 'Treasure car',
    map: 'On the map',
    game: 'In game',
    soon: 'Screenshot coming soon',
    prev: 'Previous',
    next: 'Next',
    stock: 'Stock',
  },
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PUBLIC = path.resolve(process.cwd(), 'public');
function shot(id: string, kind: 'map' | 'game', label: string, soon: string): string {
  const rel = `/guides/collectibles/${id}-${kind}.webp`;
  const body = fs.existsSync(path.join(PUBLIC, rel))
    ? `<img src="${rel}" alt="${esc(label)}" loading="lazy" decoding="async">`
    : `<span class="deck-soon">${esc(soon)}</span>`;
  return `<figure class="deck-shot"><figcaption>${esc(label)}</figcaption>${body}</figure>`;
}

function deck(locale: Locale, set: string): string {
  const items = SETS[set];
  if (!items) throw new Error(`<card-deck>: unknown set "${set}"`);
  const text = TEXT[locale];
  const cars = buildBrowseData().cars;
  const cards = items
    .map((item, i) => {
      const car = cars.find((c) => c.id === item.car);
      if (!car) throw new Error(`<card-deck>: unknown car "${item.car}"`);
      const chip = item.stamp
        ? `<span class="deck-chip deck-${item.stamp}">${esc(text.stamp[item.stamp])}</span>`
        : `<span class="deck-chip deck-treasure">${esc(text.treasure)}</span>`;
      const stock = car.cls && car.pi ? ` · ${text.stock}: ${car.cls} ${car.pi}` : '';
      return (
        `<article class="deck-card" data-card="${i}">` +
        `<header class="deck-head">${chip}<span class="deck-count">${i + 1} / ${items.length}</span></header>` +
        `<p class="deck-car"><a href="${localePath(locale, `/cars/${car.id}/`)}">${esc(car.name)}</a></p>` +
        `<p class="deck-where"><strong>${esc(item.region)}</strong>${esc(stock)}</p>` +
        `<p class="deck-hint">${esc(item.hint[locale])}</p>` +
        `<div class="deck-shots">${shot(item.id, 'map', text.map, text.soon)}${shot(item.id, 'game', text.game, text.soon)}</div>` +
        `</article>`
      );
    })
    .join('');
  return (
    `<div class="deck" data-deck tabindex="0">` +
    `<div class="deck-stage">${cards}</div>` +
    `<div class="deck-nav">` +
    `<button type="button" class="pill" data-deck-prev aria-label="${esc(text.prev)}">←</button>` +
    `<button type="button" class="pill" data-deck-next aria-label="${esc(text.next)}">→</button>` +
    `</div></div>`
  );
}

/** Replaces every `<card-deck set="…"></card-deck>` in a guide's HTML with its deck. */
export function fillDecks(html: string, locale: Locale): string {
  return html.replace(/<card-deck\b[^>]*\bset="([^"]+)"[^>]*>\s*<\/card-deck>/g, (_, set: string) =>
    deck(locale, set),
  );
}
