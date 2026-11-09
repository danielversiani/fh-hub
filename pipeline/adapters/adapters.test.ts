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

const out_forza_playlist = await fixtureOutput('forza-playlist');
describe('forza-playlist (official)', () => {
  const playlist = out_forza_playlist.playlists[0]!;
  it('reads the whole table and the live season sentence', () => {
    expect(playlist.rows.length).toBeGreaterThan(500);
    expect(playlist.currentSeasonLabel).toMatch(/ - (Summer|Autumn|Winter|Spring)$/);
    expect(playlist.currentSeasonEnds).toMatch(/^[A-Z][a-z]+ \d{1,2}$/);
  });
  it('keeps every column', () =>
    expect(playlist.rows[0]).toMatchObject({
      seasonLabel: 'S01 Welcome To Japan',
      type: 'Monthly Rivals',
      name: 'Soni Circuit',
      requirement: '2008 Mazda Furai',
    }));
});

const out_noa_miyako = await fixtureOutput('noa-miyako');
describe('noa-miyako (QQ Docs)', () => {
  const meta = out_noa_miyako.meta;
  it('decodes the protobuf tabs into rankings with class and surface from the tab name', () => {
    expect(meta.length).toBeGreaterThan(20);
    expect(new Set(meta.map((m) => `${m.carClass}|${m.surface}`))).toEqual(
      new Set(['R|road', 'S1|dirt', 'C|road']),
    );
  });
  it('reads tier, English make, ranks in order and collects tuners from continuation rows', () => {
    const r = meta.filter((m) => m.tab === 'r-road');
    expect(r[0]).toMatchObject({ rank: 1, tier: 'Meta+' });
    expect(r.map((m) => m.rank)).toEqual(r.map((_, i) => i + 1));
    expect(meta.every((m) => !/\p{Script=Han}/u.test(m.car.make ?? ''))).toBe(true);
    expect(meta.some((m) => m.tuners.length > 2)).toBe(true);
  });
});

const out_fandom_rarity = await fixtureOutput('fandom-rarity');
describe('fandom-rarity (Forza Wiki)', () => {
  const attrs = out_fandom_rarity.carAttributes;
  it('reads every rarity category', () => {
    expect(new Set(attrs.map((a) => a.rarity))).toEqual(
      new Set(['common', 'rare', 'epic', 'legendary', 'forza-edition']),
    );
    expect(attrs.length).toBeGreaterThan(500);
  });
  it('skips traffic vehicles and event-only variants', () =>
    expect(attrs.some((a) => /Traffic$|^Playground |'Touge Edition'/.test(a.car.text))).toBe(
      false,
    ));
});

const out_fandom_images = await fixtureOutput('fandom-images');
describe('fandom-images (Forza Wiki)', () => {
  const attrs = out_fandom_images.carAttributes;
  it('keeps one FH6 photo per car', () => {
    expect(attrs.length).toBeGreaterThan(600);
    expect(
      attrs.every((a) => /^https:\/\/static\.wikia\.nocookie\.net\//.test(a.image ?? '')),
    ).toBe(true);
  });
});

const out_rivals = await fixtureOutput('rivals-meta');
describe('rivals-meta (Rivals leaderboard sheet)', () => {
  const picks = out_rivals.rivals;
  it('reads every surface tab, first and second choice', () => {
    expect(new Set(picks.map((p) => p.surface))).toEqual(
      new Set(['road', 'dirt', 'cross-country']),
    );
    expect(new Set(picks.map((p) => p.choice))).toEqual(new Set([1, 2]));
  });
  it('reads a known row', () =>
    expect(
      picks.find((p) => p.track === 'Highway Circuit' && p.carClass === 'R' && p.choice === 1),
    ).toMatchObject({ surface: 'road', car: { text: 'Lotus Evija FE' } }));
});

const out_fandom_drivetrain = await fixtureOutput('fandom-drivetrain');
describe('fandom-drivetrain (Forza Wiki)', () => {
  const attrs = out_fandom_drivetrain.carAttributes;
  it('keeps only FH6 cars, one drivetrain each', () => {
    expect(new Set(attrs.map((a) => a.drivetrain))).toEqual(new Set(['FWD', 'RWD', 'AWD']));
    expect(attrs.length).toBeGreaterThan(400);
    expect(new Set(attrs.map((a) => a.car.text)).size).toBe(attrs.length);
  });
  it('reads a known car', () =>
    expect(attrs.find((a) => a.car.text === 'Honda Civic Type R (2008)')?.drivetrain).toBe('FWD'));
});

const out_fhstats = await fixtureOutput('fhstats');
describe('fhstats (online meta list + Rivals statistics)', () => {
  const out = out_fhstats;
  it('reads the online list with tier, class, surface, tuner and date', () => {
    expect(out.lists.length).toBeGreaterThan(40);
    expect(out.lists[0]).toMatchObject({
      carClass: 'B',
      surface: 'cross-country',
      level: 'meta-plus',
      online: true,
      tuners: ['CaiGou YYY'],
      date: '2026-08-23',
    });
  });
  it('keeps the listed tunes with their share codes', () =>
    expect(out.tunes.filter((t) => t.shareCode).length).toBeGreaterThan(40));
  it('aggregates Rivals top-10 appearances per car × class × surface', () => {
    expect(out.rivalsStats.length).toBeGreaterThan(100);
    expect(out.rivalsStats.every((r) => r.top10 <= r.top50)).toBe(true);
  });
});

const out_logikj = await fixtureOutput('logikj');
describe('logikj (online picks sheet)', () => {
  const out = out_logikj;
  it('reads every pick with class, surface and level', () => {
    expect(out.lists.length).toBe(27);
    expect(out.lists[0]).toMatchObject({ carClass: 'D', surface: 'dirt', level: 'meta' });
  });
  it('flags grip builds as extreme', () =>
    expect(out.lists[1]).toMatchObject({ style: 'handling', extreme: true }));
});

const out_attax = await fixtureOutput('attax-johnson');
describe('attax-johnson (Horizon 6 sheet)', () => {
  const out = out_attax;
  it('reads the picks and the tuner of each one', () => {
    expect(out.lists.length).toBe(51);
    expect(out.lists[0]).toMatchObject({
      carClass: 'D',
      surface: 'road',
      level: 'pick',
      tuners: ['JSR Chronic'],
    });
  });
  it('reads the dirt label from the build text', () =>
    expect(out.lists[1]).toMatchObject({ carClass: 'C', surface: 'dirt' }));
  it('marks "Pure Handling" / "Speed" builds as extreme', () =>
    expect(out.lists.some((l) => l.extreme)).toBe(true));
});
