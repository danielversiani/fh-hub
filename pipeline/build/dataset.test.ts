import { describe, expect, it } from 'vitest';
import { loadManual } from '../config';
import { stableStringify } from '../lib/json';
import {
  Car,
  CustomEvent,
  LapTime,
  MetaRanking,
  PlaylistEvent,
  PlaylistSeason,
  Tune,
} from '../schema/entities';
import { isPublic } from '../schema/source';
import { fixtureResults } from '../testing';
import { buildDataset } from './dataset';

const results = await fixtureResults();

describe('buildDataset (fixtures)', () => {
  const manual = loadManual();
  const dataset = buildDataset(results, manual);

  it('is deterministic', () =>
    expect(stableStringify(buildDataset([...results].reverse(), manual))).toBe(
      stableStringify(dataset),
    ));

  it('produces records that satisfy the schemas', () => {
    for (const c of dataset.cars) Car.parse(c);
    for (const t of dataset.tunes) Tune.parse(t);
    for (const l of dataset.lapTimes) LapTime.parse(l);
    for (const e of dataset.customEvents) CustomEvent.parse(e);
    for (const m of dataset.meta) MetaRanking.parse(m);
    for (const s of dataset.seasons) PlaylistSeason.parse(s);
    for (const e of dataset.events) PlaylistEvent.parse(e);
  });

  it('only creates cars from the master list', () =>
    expect(dataset.cars.every((c) => c.sourceIds.includes('forza-cars'))).toBe(true));

  it('deduplicates tunes by share code', () => {
    const codes = dataset.tunes.flatMap((t) => (t.shareCode ? [t.shareCode] : []));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('points every tune at an existing car', () => {
    const ids = new Set(dataset.cars.map((c) => c.id));
    expect(dataset.tunes.every((t) => ids.has(t.carId))).toBe(true);
  });

  it('keeps provenance for every tune', () =>
    expect(dataset.tunes.every((t) => t.observations.length > 0)).toBe(true));

  it('publishes nothing from sources without permission (ADR-0010)', () => {
    const publicOnly = buildDataset(
      results.filter((r) => isPublic(r.source)),
      manual,
    );
    const publicIds = new Set(results.filter((r) => isPublic(r.source)).map((r) => r.source.id));
    const observed = publicOnly.tunes.flatMap((t) => t.observations.map((o) => o.sourceId));
    expect(observed.every((id) => publicIds.has(id))).toBe(true);
  });

  it('interprets almost every playlist requirement', () => {
    const carEvents = dataset.events.filter((e) => e.requirement.status !== 'no-car');
    const unparsed = carEvents.filter((e) => e.requirement.status === 'unparsed');
    expect(carEvents.length).toBeGreaterThan(100);
    expect(unparsed.length / carEvents.length).toBeLessThan(0.05);
  });

  it('knows the live season', () =>
    expect(dataset.seasons.filter((s) => s.current)).toHaveLength(1));
});
