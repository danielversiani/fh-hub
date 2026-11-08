import { normalizeName, slugify } from '../lib/text';
import type { CarClass, Discipline, Drivetrain, Surface } from '../schema/enums';
import type { Car } from '../schema/entities';
import type { CarResolver } from './car-resolver';
import { parseClass, parseDrivetrain } from './fields';

export type ScopeKind =
  'any' | 'car' | 'car-type' | 'make' | 'country' | 'family' | 'rarity' | 'drivetrain' | 'unknown';

export interface EventTarget {
  kind: 'speed' | 'distance' | 'time' | 'score';
  value: number;
  unit: 'mph' | 'ft' | 's' | 'pts';
  raw: string;
}

export interface Requirement {
  /**
   * parsed   → eligible cars are known exactly
   * partial  → class known, but part of the restriction cannot be checked (rarity, stock drivetrain)
   * unparsed → restriction not understood (goes to review)
   * no-car   → the event does not restrict cars (daily challenges, photos, rewards…)
   */
  status: 'parsed' | 'partial' | 'unparsed' | 'no-car';
  class?: CarClass;
  scope: ScopeKind;
  /** The restriction as written, without class and target: "Retro Hot Hatch", "Ferrari"… */
  scopeLabel?: string;
  /** Decade restriction ("1980s"): first year of the decade. */
  decade?: number;
  drivetrain?: Drivetrain;
  /** Eligible car ids. Absent = any car of the class. */
  carIds?: string[];
  /** Weekly challenge activities: "Speed Zones", "Touge"… */
  activities?: string[];
  target?: EventTarget;
  note?: string;
}

/** Event types whose requirement column names cars/classes (the rest describe a task). */
const CAR_EVENT_TYPES = [
  /^Championship$/,
  /^Horizon Life - The Trial$/,
  /^Weekly Challenge$/,
  /^Monthly Rivals$/,
  /^PR Stunt - /,
  /^Horizon Life - (Time Attack|Drag Meet|Drift Attack)$/,
];

export const isCarEvent = (type: string): boolean => CAR_EVENT_TYPES.some((re) => re.test(type));

const num = (text: string) => Number(text.replace(/,/g, ''));

export function parseTarget(text: string): EventTarget | undefined {
  const raw = text.trim();
  if (!raw) return undefined;
  let m = /^([\d,.]+)\s*mph$/i.exec(raw);
  if (m) return { kind: 'speed', value: num(m[1]!), unit: 'mph', raw };
  m = /^([\d,.]+)\s*(feet|ft)$/i.exec(raw);
  if (m) return { kind: 'distance', value: num(m[1]!), unit: 'ft', raw };
  m = /^([\d,]+)\s*points$/i.exec(raw);
  if (m) return { kind: 'score', value: num(m[1]!), unit: 'pts', raw };
  m = /^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)(?:\s*seconds)?$/i.exec(raw);
  if (m) return { kind: 'time', value: Number(m[1] ?? 0) * 60 + Number(m[2]), unit: 's', raw };
  return undefined;
}

const singular = (value: string) => normalizeName(value).replace(/s$/, '');

/** Playlist names countries in full; the roster abbreviates some. */
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  'united kingdom': 'uk',
  'great britain': 'uk',
  'united states': 'usa',
  'united states of america': 'usa',
  'south korea': 'korea',
};

/**
 * Interprets the "Car / Requirement" column of the official Festival Playlist against the car
 * list. Known formats (2026-11):
 *   "Retro Hot Hatch - C Class"            car type + class
 *   "Ferrari - S1 Class"                   make + class
 *   "Dodge Challenger - A Class"           model family + class
 *   "1980s Retro Super Saloons - C Class"  decade (+ car type) + class
 *   "2010s S2 Class - 205.0 mph"           decade + class + target (no dash before the class)
 *   "1991 Toyota Sera - B Class - 19.000 seconds"   specific car + class + target
 *   "Japan - A Class - 1:06.000"           whole map + class + target
 *   "Rarity: Legendary - S2 Class"         rarity (not in the roster → partial)
 *   "2000s Total FWD - B Class"            stock drivetrain (not in the roster → partial)
 *   "1980s Total Rally - B Class"          every car type containing "Rally"
 *   "2022 Toyota GR86; Speed Zones; Touge" weekly challenge: car + activities
 */
export class RequirementParser {
  private readonly carTypes: string[];
  private readonly makes: Map<string, string>;

  constructor(
    private readonly cars: readonly Car[],
    private readonly resolver: CarResolver,
  ) {
    this.carTypes = [...new Set(cars.flatMap((c) => c.carTypes))].sort();
    this.makes = new Map(cars.map((c) => [normalizeName(c.make), c.make]));
  }

  parse(type: string, raw: string): Requirement {
    const text = raw.trim();
    if (!isCarEvent(type) || !text) return { status: 'no-car', scope: 'any' };

    if (type === 'Weekly Challenge' || text.includes(';')) {
      const [carText = '', ...activities] = text.split(';').map((s) => s.trim());
      const car = this.resolveCar(carText);
      return car
        ? {
            status: 'parsed',
            scope: 'car',
            scopeLabel: carText,
            carIds: [car],
            activities: activities.filter(Boolean),
          }
        : { status: 'unparsed', scope: 'unknown', scopeLabel: carText, note: 'car not found' };
    }

    const parts = text.split(/\s+-\s+/);
    // "S1 Class", "S1 class", or a bare class token as its own part ("… - A").
    const classIndex = parts.findIndex(
      (p) => /(?:^|\s)(S1|S2|[DCBARX]) Class$/i.test(p) || /^(S1|S2|[DCBARX])$/.test(p),
    );
    if (classIndex < 0) {
      // Monthly Rivals and similar: just a car. Otherwise "<subject> - <target>" without class
      // (e.g. "Anything Goes - 60,000 points").
      const car = this.resolveCar(text);
      if (car) return { status: 'parsed', scope: 'car', scopeLabel: text, carIds: [car] };
      const target = parseTarget(parts.slice(1).join(' - '));
      const subject = this.parseSubject(parts[0] ?? '');
      return subject.status === 'unparsed'
        ? { status: 'unparsed', scope: 'unknown', scopeLabel: text }
        : { ...subject, target };
    }

    const classPart = parts[classIndex]!;
    const carClass = parseClass(classPart.replace(/Class$/i, ''));
    const prefixInClassPart = classPart
      .replace(/(?:^|\s)(S1|S2|[DCBARX]) Class$/i, '')
      .replace(/^(S1|S2|[DCBARX])$/, '')
      .trim();
    const subject = [...parts.slice(0, classIndex), prefixInClassPart].filter(Boolean).join(' - ');
    const target = parseTarget(parts.slice(classIndex + 1).join(' - '));
    return { ...this.parseSubject(subject), class: carClass, target };
  }

  private resolveCar(text: string): string | undefined {
    const resolution = this.resolver.resolve({ text });
    return resolution.ok ? resolution.carId : undefined;
  }

  private parseSubject(subject: string): Omit<Requirement, 'class' | 'target'> {
    const label = subject.trim();
    if (!label || /^(japan|anything goes)$/i.test(label)) {
      return { status: 'parsed', scope: 'any', scopeLabel: label || undefined };
    }

    // "Honda & Acura", "Buggies & Offroad", "Evo vs Impreza": union of every part (all parts
    // must be understood).
    const joiner = /\s+(?:&|vs\.?)\s+/i;
    if (joiner.test(label) && !this.carTypes.some((t) => singular(t) === singular(label))) {
      const total = /^Total\s+/i.test(label);
      const pieces = label
        .replace(/^Total\s+/i, '')
        .split(joiner)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => this.parseSubject(total ? `Total ${p}` : p));
      if (pieces.length > 1 && pieces.every((p) => p.status === 'parsed' && p.carIds)) {
        return {
          status: 'parsed',
          scope: pieces.every((p) => p.scope === pieces[0]!.scope) ? pieces[0]!.scope : 'family',
          scopeLabel: label,
          carIds: [...new Set(pieces.flatMap((p) => p.carIds!))],
        };
      }
    }

    const rarity = /^Rarity:\s*(.+)$/i.exec(label);
    if (rarity) {
      const wanted = slugify(rarity[1]!);
      const known = this.cars.filter((c) => c.rarity);
      // Eligible = cars whose rarity we KNOW matches; cars with unknown rarity are left out.
      if (known.length > 0) {
        return {
          status: 'parsed',
          scope: 'rarity',
          scopeLabel: rarity[1],
          carIds: known.filter((c) => c.rarity === wanted).map((c) => c.id),
        };
      }
      return {
        status: 'partial',
        scope: 'rarity',
        scopeLabel: rarity[1],
        note: 'car rarity is not in the official roster; check eligibility in game',
      };
    }

    const decade = /^(\d{3}0)s\b\s*(.*)$/.exec(label);
    if (decade) {
      const from = Number(decade[1]);
      const inner = this.parseSubject(decade[2] ?? '');
      const pool = inner.carIds ? this.byIds(inner.carIds) : this.cars;
      const carIds = pool.filter((c) => c.year >= from && c.year <= from + 9).map((c) => c.id);
      return { ...inner, decade: from, scopeLabel: label, carIds };
    }

    const total = /^Total\s+(.+)$/i.exec(label);
    if (total) {
      const drivetrain = parseDrivetrain(total[1]);
      if (drivetrain) {
        // Stock drivetrain from the wiki: eligible = cars whose drivetrain we KNOW matches.
        const known = this.cars.filter((c) => c.drivetrain);
        if (known.length > 0) {
          return {
            status: 'parsed',
            scope: 'drivetrain',
            scopeLabel: label,
            drivetrain,
            carIds: known.filter((c) => c.drivetrain === drivetrain).map((c) => c.id),
          };
        }
        return {
          status: 'partial',
          scope: 'drivetrain',
          scopeLabel: label,
          drivetrain,
          note: 'stock drivetrain is not in the official roster; check eligibility in game',
        };
      }
      const word = normalizeName(total[1]!);
      const types = this.carTypes.filter((t) => normalizeName(t).includes(word));
      if (types.length) return this.byCarTypes(types, label);
    }

    const types = this.carTypes.filter((t) => singular(t) === singular(label));
    if (types.length) return this.byCarTypes(types, label);

    const make = this.makes.get(normalizeName(label));
    if (make) {
      return {
        status: 'parsed',
        scope: 'make',
        scopeLabel: label,
        carIds: this.cars.filter((c) => c.make === make).map((c) => c.id),
      };
    }

    // Country of the manufacturer: "Italy", "United States", "United Kingdom".
    const country = COUNTRY_ALIASES[normalizeName(label)] ?? normalizeName(label);
    const byCountry = this.cars.filter((c) => c.country && normalizeName(c.country) === country);
    if (byCountry.length) {
      return {
        status: 'parsed',
        scope: 'country',
        scopeLabel: label,
        carIds: byCountry.map((c) => c.id),
      };
    }

    if (/^\d{4}\s/.test(label)) {
      const car = this.resolveCar(label);
      if (car) return { status: 'parsed', scope: 'car', scopeLabel: label, carIds: [car] };
    }

    const words = normalizeName(label).split(' ');
    const family = this.cars.filter((c) => {
      const name = new Set(normalizeName(`${c.make} ${c.model}`).split(' '));
      return words.every((w) => name.has(w));
    });
    if (family.length) {
      return {
        status: 'parsed',
        scope: family.length === 1 ? 'car' : 'family',
        scopeLabel: label,
        carIds: family.map((c) => c.id),
      };
    }

    return { status: 'unparsed', scope: 'unknown', scopeLabel: label };
  }

  private byIds(ids: readonly string[]): Car[] {
    const set = new Set(ids);
    return this.cars.filter((c) => set.has(c.id));
  }

  private byCarTypes(types: string[], label: string): Omit<Requirement, 'class' | 'target'> {
    const set = new Set(types);
    return {
      status: 'parsed',
      scope: 'car-type',
      scopeLabel: label,
      carIds: this.cars.filter((c) => c.carTypes.some((t) => set.has(t))).map((c) => c.id),
    };
  }
}

const ROUTE_PREFIX: Record<string, { surface: Surface; discipline?: Discipline }> = {
  road: { surface: 'road' },
  street: { surface: 'road', discipline: 'street' },
  touge: { surface: 'road', discipline: 'touge' },
  dirt: { surface: 'dirt' },
  'cross country': { surface: 'cross-country' },
};

const EVENT_TYPE_TRACK: [RegExp, { surface: Surface; discipline: Discipline }][] = [
  [/Speed Trap/, { surface: 'road', discipline: 'speed-trap' }],
  [/Speed Zone/, { surface: 'road', discipline: 'speed-zone' }],
  [/Danger Sign/, { surface: 'road', discipline: 'danger-sign' }],
  [/Drift Zone|Drift Attack/, { surface: 'road', discipline: 'drift' }],
  [/Trailblazer/, { surface: 'cross-country', discipline: 'trailblazer' }],
  [/Time Attack/, { surface: 'road', discipline: 'time-attack' }],
  [/Drag Meet/, { surface: 'road', discipline: 'drag' }],
];

export interface ParsedRoute {
  routes: { name: string; discipline?: Discipline }[];
  surface: Surface | null;
  discipline?: Discipline;
}

const disciplineFromName = (name: string): Discipline | undefined =>
  /circuit/i.test(name)
    ? 'circuit'
    : /sprint|scramble|trail|descent|run|charge/i.test(name)
      ? 'sprint'
      : undefined;

/** "Road: Edo Circuit, Electric Town Circuit" → road + circuits. Falls back to the event type. */
export function parseRoute(type: string, raw: string): ParsedRoute {
  const prefixed = /^([A-Za-z ]+):\s*(.+)$/.exec(raw.trim());
  const byType = EVENT_TYPE_TRACK.find(([re]) => re.test(type))?.[1];
  const names = (prefixed ? prefixed[2]! : raw)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const prefix = prefixed ? ROUTE_PREFIX[prefixed[1]!.trim().toLowerCase()] : undefined;
  const routes = names.map((name) => ({
    name,
    discipline: prefix?.discipline ?? byType?.discipline ?? disciplineFromName(name),
  }));
  const surface =
    prefix?.surface ?? byType?.surface ?? (/^Monthly Rivals$/.test(type) ? 'road' : null);
  const disciplines = [...new Set(routes.map((r) => r.discipline).filter(Boolean))];
  return {
    routes,
    surface,
    discipline:
      byType?.discipline ??
      prefix?.discipline ??
      (disciplines.length === 1 ? disciplines[0] : undefined),
  };
}
