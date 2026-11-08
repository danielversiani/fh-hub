import { describe, expect, it } from 'vitest';
import { slugify } from '../lib/text';
import type { Car } from '../schema/entities';
import { CarResolver } from './car-resolver';
import { parseRoute, parseTarget, RequirementParser } from './requirement';

const car = (
  year: number,
  make: string,
  model: string,
  carTypes: string[],
  country = 'Japan',
): Car => ({
  id: slugify(`${year} ${make} ${model}`),
  year,
  make,
  model,
  displayName: `${year} ${make} ${model}`,
  carTypes,
  country,
  sourceIds: ['test'],
});

const CARS = [
  car(1991, 'Toyota', 'Sera', ['Eclectic Domestics']),
  car(1984, 'Honda', 'City E II', ['Eclectic Domestics']),
  car(1986, 'Honda', 'Civic SI', ['Retro Hot Hatch']),
  car(2002, 'Acura', 'RSX Type S', ['Retro Hot Hatch'], 'USA'),
  car(2009, 'Ferrari', '458 Italia', ['Modern Supercars'], 'Italy'),
  car(2015, 'Dodge', 'Challenger SRT Hellcat', ['Modern Muscle'], 'USA'),
  car(2018, 'Dodge', 'Challenger SRT Demon', ['Modern Muscle'], 'USA'),
  car(1985, 'Lancia', 'Delta S4', ['Classic Rally'], 'Italy'),
  car(2005, 'Subaru', 'Impreza WRX STI', ['Modern Rally']),
];

const parser = new RequirementParser(CARS, new CarResolver(CARS, {}));
const ids = (...names: string[]) => names.map(slugify).sort();

describe('RequirementParser', () => {
  it('car type + class (singular/plural tolerant)', () => {
    const r = parser.parse('Horizon Life - The Trial', 'Eclectic Domestic - B Class');
    expect(r).toMatchObject({ status: 'parsed', class: 'B', scope: 'car-type' });
    expect(r.carIds?.sort()).toEqual(ids('1991 Toyota Sera', '1984 Honda City E II'));
  });

  it('make + class', () =>
    expect(parser.parse('Championship', 'Ferrari - S1 Class')).toMatchObject({
      scope: 'make',
      class: 'S1',
      carIds: ids('2009 Ferrari 458 Italia'),
    }));

  it('model family + class', () =>
    expect(parser.parse('Championship', 'Dodge Challenger - A Class').carIds?.sort()).toEqual(
      ids('2015 Dodge Challenger SRT Hellcat', '2018 Dodge Challenger SRT Demon'),
    ));

  it('decade + car type, and decade without a dash before the class', () => {
    expect(parser.parse('Championship', '1980s Retro Hot Hatch - D Class').carIds).toEqual(
      ids('1986 Honda Civic SI'),
    );
    const r = parser.parse('PR Stunt - Speed Trap', '2000s S1 Class - 205.0 mph');
    expect(r).toMatchObject({ class: 'S1', decade: 2000, target: { kind: 'speed', value: 205 } });
    expect(r.carIds?.sort()).toEqual(
      ids('2002 Acura RSX Type S', '2005 Subaru Impreza WRX STI', '2009 Ferrari 458 Italia'),
    );
  });

  it('specific car + class + target', () =>
    expect(
      parser.parse('Horizon Life - Drag Meet', '1991 Toyota Sera - B Class - 19.000 seconds'),
    ).toMatchObject({
      scope: 'car',
      class: 'B',
      carIds: ids('1991 Toyota Sera'),
      target: { kind: 'time', value: 19 },
    }));

  it('country, two makes and "vs"', () => {
    expect(parser.parse('Championship', 'Italy - S1 Class').carIds?.sort()).toEqual(
      ids('2009 Ferrari 458 Italia', '1985 Lancia Delta S4'),
    );
    expect(parser.parse('Championship', 'United States - B Class').scope).toBe('country');
    expect(parser.parse('Championship', 'Honda & Acura - B Class').carIds?.length).toBe(3);
  });

  it('rarity is checkable once cars carry it (only known rarities are eligible)', () => {
    const withRarity = CARS.map((c, i) => ({
      ...c,
      rarity: i === 0 ? ('legendary' as const) : undefined,
    }));
    const p = new RequirementParser(withRarity, new CarResolver(withRarity, {}));
    expect(p.parse('Championship', 'Rarity: Legendary - S2 Class')).toMatchObject({
      status: 'parsed',
      scope: 'rarity',
      carIds: ids('1991 Toyota Sera'),
    });
  });

  it('rarity and stock drivetrain are partial when the data is missing', () => {
    expect(parser.parse('Championship', 'Rarity: Legendary - S2 Class')).toMatchObject({
      status: 'partial',
      scope: 'rarity',
      class: 'S2',
    });
    expect(parser.parse('Championship', '2000s Total FWD - B Class')).toMatchObject({
      status: 'partial',
      drivetrain: 'FWD',
    });
  });

  it('weekly challenge: car + activities', () =>
    expect(
      parser.parse('Weekly Challenge', '1984 Honda City E II; Speed Zones; Touge'),
    ).toMatchObject({
      scope: 'car',
      carIds: ids('1984 Honda City E II'),
      activities: ['Speed Zones', 'Touge'],
    }));

  it('whole map and "Anything Goes"', () => {
    expect(parser.parse('PR Stunt - Danger Sign', 'Japan - A Class - 698.8 feet')).toMatchObject({
      scope: 'any',
      class: 'A',
      target: { kind: 'distance', value: 698.8 },
    });
    expect(
      parser.parse('Horizon Life - Drift Attack', 'Anything Goes - 60,000 points'),
    ).toMatchObject({
      scope: 'any',
      target: { kind: 'score', value: 60000 },
    });
  });

  it('tasks without car restriction', () =>
    expect(parser.parse('Daily Challenge', 'Win 2 Road Circuit Races').status).toBe('no-car'));

  it('flags what it does not understand', () =>
    expect(parser.parse('Championship', 'Heavy Hitters - A Class').status).toBe('unparsed'));
});

describe('parseTarget / parseRoute', () => {
  it('targets', () => {
    expect(parseTarget('1:17.000')).toMatchObject({ kind: 'time', value: 77 });
    expect(parseTarget('1,312.3 ft')).toMatchObject({ kind: 'distance', value: 1312.3 });
  });
  it('routes', () => {
    expect(parseRoute('Championship', 'Road: Edo Circuit, Electric Town Circuit')).toMatchObject({
      surface: 'road',
      discipline: 'circuit',
      routes: [{ name: 'Edo Circuit' }, { name: 'Electric Town Circuit' }],
    });
    expect(parseRoute('Championship', 'Street: Daikoku Chase').discipline).toBe('street');
    expect(parseRoute('PR Stunt - Trailblazer', '').surface).toBe('cross-country');
  });
});
