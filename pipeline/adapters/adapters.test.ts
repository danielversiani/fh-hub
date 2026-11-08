/**
 * Adapter contract tests on real (sampled) fixtures. When a source changes its layout:
 * `pnpm fixtures:update --source=<id>`, then fix the adapter and these expectations together
 * (docs/RUNBOOK.md §3).
 */
import { describe, expect, it } from 'vitest';
import { fixtureOutput } from '../testing';

const out_forza_cars = await fixtureOutput('forza-cars');
describe('forza-cars (official roster)', () => {
  const out = out_forza_cars;
  it('reads the whole roster', () => expect(out.catalog.length).toBeGreaterThan(600));
  it('splits year, make, model, class and PI', () =>
    expect(out.catalog.find((c) => c.displayName === '1968 Abarth 595 esseesse')).toMatchObject({
      year: 1968,
      make: 'Abarth',
      model: '595 esseesse',
      stockClass: 'D',
      stockPi: 100,
      country: 'Italy',
    }));
});

const out_gbr_ozzy = await fixtureOutput('gbr-ozzy');
describe('gbr-ozzy', () => {
  const out = out_gbr_ozzy;
  it('finds the header below the banner rows', () => expect(out.tunes.length).toBeGreaterThan(50));
  it('reads make, model, tuner, code and the unnamed date column', () =>
    expect(out.tunes[0]).toMatchObject({
      car: { make: 'Abarth', model: '124 Spider' },
      tuner: 'LogikJ',
      shareCode: '773 309 331',
      createdAt: '2026-07-26',
    }));
});

const out_kleis = await fixtureOutput('kleis');
describe('kleis', () => {
  const out = out_kleis;
  it('reads tunes without share codes', () => {
    expect(out.tunes.length).toBeGreaterThan(50);
    expect(out.tunes.every((t) => !t.shareCode)).toBe(true);
  });
  it('derives the class from the cell colour across several classes', () => {
    const classes = new Set(out.tunes.map((t) => t.carClass));
    expect(classes.size).toBeGreaterThanOrEqual(4);
    expect(out.tunes[0]).toMatchObject({ car: { text: '1970 Honda S800' }, carClass: 'D' });
  });
});

const out_k1z_gray = await fixtureOutput('k1z-gray');
describe('k1z-gray', () => {
  const out = out_k1z_gray;
  it('reads year, make, model and the numeric share code', () =>
    expect(out.tunes[0]).toMatchObject({
      car: { year: 1990, make: 'Alfa Romeo', model: 'SE 048SP' },
      tuner: 'K1Z Gray',
      shareCode: '823312187',
      surfaceText: 'Road',
    }));
});

const out_letzelu_shirakawa = await fixtureOutput('letzelu-shirakawa');
describe('letzelu-shirakawa', () => {
  const out = out_letzelu_shirakawa;
  it('reads lap times with the class of each tab', () => {
    expect(out.lapTimes.length).toBeGreaterThan(10);
    expect(new Set(out.lapTimes.map((l) => l.carClass))).toEqual(new Set(['A', 'S1', 'S2']));
  });
  it('carries the merged tier cell down', () => {
    const s1 = out.lapTimes.filter((l) => l.tab === 's1-800');
    expect(s1[1]?.tierLabel).toBe(s1[0]?.tierLabel);
  });
});

const out_whd_url = await fixtureOutput('whd-url');
describe('whd-url', () => {
  const out = out_whd_url;
  const event = out.customEvents[0]!;
  it('groups cars by pack', () => {
    expect(event.groups.length).toBeGreaterThan(1);
    expect(event.groups[0]?.entries[0]).toMatchObject({
      kind: 'car',
      label: 'Shift 2 Car',
      car: { text: "BMW M3 '08" },
      tuneCode: '141 037 581',
    });
  });
  it('recognises event routes', () =>
    expect(event.groups.flatMap((g) => g.entries).some((e) => e.kind === 'route')).toBe(true));
});
