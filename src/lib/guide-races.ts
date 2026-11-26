import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { localePath, type Locale } from '../i18n';
import { buildBrowseData } from './browse';

/**
 * Festival races in a guide (ADR-0024). Every race accepts one car group in one class, and the
 * guide suggests a car that enters it. The races, their restrictions, the wristband that unlocks
 * each one and the suggested cars live in data/guides/festival-races.yaml; a guide writes
 * `<festival-races unlock="green"></festival-races>` and gets, at build time, the table of the
 * races that wristband unlocks followed by a tune box for each suggested car.
 */

export const UNLOCKS = [
  'start',
  'yellow',
  'green',
  'blue',
  'pink',
  'orange',
  'purple',
  'gold',
] as const;
export const RACE_CLASSES = ['C', 'B', 'A', 'S1', 'S2', 'R'] as const;
const SERIES = ['road', 'dirt', 'cross-country'] as const;

const Text = z.object({ 'pt-br': z.string().min(1), en: z.string().min(1) }).strict();

export const CarGroup = z
  .object({
    types: z.array(z.string()).min(1).optional(),
    country: z.string().optional(),
    drivetrain: z.enum(['FWD', 'RWD', 'AWD']).optional(),
    /** A pattern on the car's name (case-insensitive). */
    model: z.string().optional(),
    /** false: deduced from the group's name, still to check in game. */
    confirmed: z.boolean().optional(),
  })
  .strict();
export type CarGroup = z.infer<typeof CarGroup>;

const RaceCar = z.union([
  z.string().min(1),
  z
    .object({
      id: z.string().min(1),
      class: z.enum(RACE_CLASSES).optional(),
      surface: z.enum(SERIES).optional(),
      pick: z.array(z.string()).min(1).optional(),
      skip: z.array(z.string()).min(1).optional(),
    })
    .strict(),
]);

const Race = z
  .object({
    name: z.string().min(1),
    series: z.enum(SERIES),
    /** Absent when the source does not say: the race is kept but shown in no table. */
    unlock: z.enum(UNLOCKS).optional(),
    class: z.enum(RACE_CLASSES).optional(),
    group: z.string().min(1),
    /** The day the owner saw the restriction in game. */
    checked: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    cars: z.array(RaceCar).min(1),
    why: Text,
  })
  .strict();
export type Race = z.infer<typeof Race>;

export const FestivalRaces = z
  .object({ groups: z.record(z.string(), CarGroup), races: z.array(Race).min(1) })
  .strict()
  .superRefine((doc, ctx) => {
    const names = new Set<string>();
    doc.races.forEach((race, i) => {
      if (!doc.groups[race.group])
        ctx.addIssue({ code: 'custom', path: ['races', i, 'group'], message: 'unknown group' });
      if (names.has(race.name))
        ctx.addIssue({ code: 'custom', path: ['races', i, 'name'], message: 'duplicate race' });
      names.add(race.name);
      if (!race.unlock && !race.class)
        ctx.addIssue({
          code: 'custom',
          path: ['races', i, 'class'],
          message: 'a race without unlock needs a class',
        });
    });
  });
export type FestivalRaces = z.infer<typeof FestivalRaces>;

const FILE = 'data/guides/festival-races.yaml';

export function loadFestivalRaces(file = FILE): FestivalRaces {
  const text = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  return FestivalRaces.parse(parse(text));
}

/** The facts a group is checked against (data/generated/cars.json). */
export interface GroupCar {
  name: string;
  types: string[];
  country?: string;
  drivetrain?: string;
}

/** A car enters a group when it passes every test the group sets. */
export function inGroup(group: CarGroup, car: GroupCar): boolean {
  if (group.types && !group.types.some((t) => car.types.includes(t))) return false;
  if (group.country && car.country !== group.country) return false;
  if (group.drivetrain && car.drivetrain !== group.drivetrain) return false;
  if (group.model && !new RegExp(group.model, 'i').test(car.name)) return false;
  return true;
}

/** A race without a class takes the tune box of its wristband's class. */
const BAND_CLASS: Readonly<Record<(typeof UNLOCKS)[number], (typeof RACE_CLASSES)[number]>> = {
  start: 'C',
  yellow: 'B',
  green: 'B',
  blue: 'A',
  pink: 'A',
  orange: 'S1',
  purple: 'S2',
  gold: 'R',
};

export interface TuneBox {
  car: string;
  cls: string;
  surface: string;
  pick: string[];
  skip: string[];
}

/** The tune box for one suggested car of a race. */
export function tuneBox(race: Race, car: Race['cars'][number]): TuneBox {
  const c = typeof car === 'string' ? { id: car } : car;
  return {
    car: c.id,
    cls: c.class ?? race.class ?? BAND_CLASS[race.unlock ?? 'start'],
    surface: c.surface ?? race.series,
    pick: c.pick ?? [],
    skip: c.skip ?? [],
  };
}

const TEXT = {
  'pt-br': {
    head: ['Corrida', 'Piso', 'Restrição', 'Carro sugerido', 'Por quê'],
    or: 'ou',
    series: { road: 'Asfalto', dirt: 'Terra', 'cross-country': 'Cross country' },
  },
  en: {
    head: ['Race', 'Surface', 'Restriction', 'Suggested car', 'Why'],
    or: 'or',
    series: { road: 'Tarmac', dirt: 'Dirt', 'cross-country': 'Cross country' },
  },
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The table and the tune boxes of the races one wristband unlocks. */
function section(locale: Locale, unlock: string, doc: FestivalRaces): string {
  const text = TEXT[locale];
  const races = doc.races.filter((r) => r.unlock === unlock);
  if (!races.length) throw new Error(`<festival-races>: no race unlocked by "${unlock}"`);
  const cars = new Map(buildBrowseData().cars.map((c) => [c.id, c]));
  const carName = (id: string) => {
    const car = cars.get(id);
    if (!car) throw new Error(`<festival-races>: unknown car "${id}"`);
    return car.name;
  };

  const rows = races.map((race) => {
    const restriction = race.class ? `${race.class} · ${race.group}` : race.group;
    const suggested = race.cars
      .map((car) => {
        const id = typeof car === 'string' ? car : car.id;
        return `<a href="${localePath(locale, `/cars/${id}/`)}">${esc(carName(id))}</a>`;
      })
      .join(` ${text.or} `);
    const cells = [
      esc(race.name),
      text.series[race.series],
      esc(restriction),
      suggested,
      esc(race.why[locale]),
    ];
    return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  });

  // One box per car, class and surface, listing the races it serves.
  const boxes = new Map<string, { box: TuneBox; races: string[] }>();
  for (const race of races) {
    for (const car of race.cars) {
      const box = tuneBox(race, car);
      const key = [box.car, box.cls, box.surface, box.pick.join(), box.skip.join()].join('|');
      const entry = boxes.get(key) ?? { box, races: [] };
      entry.races.push(race.name);
      boxes.set(key, entry);
    }
  }
  const tags = [...boxes.values()].map(
    ({ box, races: served }) =>
      `<tune-picks car="${box.car}" class="${box.cls}" surface="${box.surface}"` +
      (box.pick.length ? ` pick="${box.pick.join(',')}"` : '') +
      (box.skip.length ? ` skip="${box.skip.join(',')}"` : '') +
      // The box escapes it; a race name never has a quote.
      ` for="${served.join(', ').replace(/"/g, '')}"></tune-picks>`,
  );

  return (
    `<div class="table-wrap"><table><thead><tr>` +
    text.head.map((h) => `<th>${h}</th>`).join('') +
    `</tr></thead><tbody>${rows.join('')}</tbody></table></div>` +
    tags.join('')
  );
}

/** Replaces every `<festival-races unlock="…"></festival-races>` (and the paragraph around it). */
export function fillRaceTables(html: string, locale: Locale): string {
  if (!html.includes('<festival-races')) return html;
  const doc = loadFestivalRaces();
  return html.replace(
    /(?:<p>\s*)?<festival-races\s+unlock="([^"]+)"\s*>\s*<\/festival-races>(?:\s*<\/p>)?/g,
    (_, unlock: string) => section(locale, unlock, doc),
  );
}
