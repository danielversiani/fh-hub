import { describe, expect, it } from 'vitest';
import type { Car } from '../schema/entities';
import { slugify } from '../lib/text';
import { CarResolver, splitYear } from './car-resolver';

const car = (year: number, make: string, model: string): Car => ({
  id: slugify(`${year} ${make} ${model}`),
  year,
  make,
  model,
  displayName: `${year} ${make} ${model}`,
  carTypes: [],
  sourceIds: ['test'],
});

const CARS = [
  car(1991, 'Mazda', '#55 Mazda 787B'),
  car(2008, 'Honda', 'Civic Type R (FD2)'),
  car(1997, 'Honda', 'Civic Type R'),
  car(2010, 'Volkswagen', 'Golf R'),
  car(2014, 'Volkswagen', 'Golf R'),
  car(2016, 'Lamborghini', 'Centenario LP 770-4'),
  car(2010, 'Lamborghini', 'Murciélago LP 670-4 SV'),
  car(2023, 'Porsche', '911 GT3 RS'),
];

const resolver = new CarResolver(CARS, {
  'Lambo Murcialago': '2010-lamborghini-murcielago-lp-670-4-sv',
});
const resolve = (text: string, extra: object = {}) => resolver.resolve({ text, ...extra });

describe('splitYear', () => {
  it.each([
    ['1991 Honda Beat', 1991, 'Honda Beat'],
    ['Porsche 911 GT3 RS (2023)', 2023, 'Porsche 911 GT3 RS'],
    ["BMW M3 '08", 2008, 'BMW M3'],
    ["Chevrolet Camaro ZL1 24'", 2024, 'Chevrolet Camaro ZL1'],
    ['Nissan GTR R35 Nismo 2020', 2020, 'Nissan GTR R35 Nismo'],
    [
      '2554 AMG Transport Dynamics M12S Warthog CST',
      2554,
      'AMG Transport Dynamics M12S Warthog CST',
    ],
  ])('%s', (text, year, rest) => expect(splitYear(text)).toEqual({ year, rest }));

  it('leaves names without a year alone', () =>
    expect(splitYear('Mclaren 765LT')).toEqual({ rest: 'Mclaren 765LT' }));
});

describe('CarResolver', () => {
  it('matches the exact official name', () =>
    expect(resolve('1991 Mazda #55 Mazda 787B')).toMatchObject({ ok: true, method: 'exact' }));

  it('matches make + model when the source has no year', () =>
    expect(resolve('Lamborghini Centenario LP 770-4', { make: 'Lamborghini' })).toMatchObject({
      ok: true,
      carId: '2016-lamborghini-centenario-lp-770-4',
    }));

  it('uses the year to pick between same-name cars', () => {
    expect(resolve('2014 Volkswagen Golf R')).toMatchObject({
      ok: true,
      carId: '2014-volkswagen-golf-r',
    });
    expect(resolve('Volkswagen Golf R')).toMatchObject({ ok: false, reason: 'ambiguous' });
  });

  it('accepts a shorter name when it fits exactly one car of that make and year', () =>
    expect(resolve('2008 Honda Civic Type R')).toMatchObject({
      ok: true,
      method: 'subset',
      carId: '2008-honda-civic-type-r-fd2',
    }));

  it('tolerates typos via fuzzy matching within the same make', () =>
    expect(resolve('2016 Lamborghini Centernario LP 770-4')).toMatchObject({
      ok: true,
      method: 'fuzzy',
    }));

  it('uses the alias table', () =>
    expect(resolve('Lambo Murcialago')).toMatchObject({ ok: true, method: 'alias' }));

  it('never guesses across makes', () =>
    expect(resolve('2020 Mercedes-Benz SLC 43 Final Edition')).toMatchObject({ ok: false }));
});
