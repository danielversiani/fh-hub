import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inGroup, loadFestivalRaces, RACE_CLASSES, tuneBox, type GroupCar } from './guide-races';

/** The catalogue as published (data/generated), read straight from the files. */
interface Car extends GroupCar {
  id: string;
  stock?: { class?: string };
}
const cars = new Map(
  (
    JSON.parse(fs.readFileSync(path.resolve('data/generated/cars.json'), 'utf8')) as {
      items: (Omit<Car, 'name' | 'types'> & { displayName: string; carTypes?: string[] })[];
    }
  ).items.map((c) => [c.id, { ...c, name: c.displayName, types: c.carTypes ?? [] } as Car]),
);
const tunes = (car: string): { id: string; class?: string }[] => {
  const file = path.resolve('data/generated/tunes/by-car', `${car}.json`);
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { items: { id: string; class?: string }[] })
        .items
    : [];
};
const rank = (cls?: string) => RACE_CLASSES.indexOf(cls as (typeof RACE_CLASSES)[number]);

describe('festival races of the guides (ADR-0024)', () => {
  const doc = loadFestivalRaces();

  it('every group passes at least one test', () => {
    for (const [name, group] of Object.entries(doc.groups))
      expect(Boolean(group.types || group.country || group.drivetrain || group.model), name).toBe(
        true,
      );
  });

  it('every suggested car enters its race: the car group and the class', () => {
    for (const race of doc.races) {
      const group = doc.groups[race.group]!;
      for (const pick of race.cars) {
        const box = tuneBox(race, pick);
        const car = cars.get(box.car);
        expect(car, `${race.name}: unknown car ${box.car}`).toBeDefined();
        expect(inGroup(group, car!), `${race.name}: ${box.car} is not ${race.group}`).toBe(true);
        if (race.class) {
          // A car enters below its stock class only with a catalogued tune that brings it down.
          const reaches =
            rank(car!.stock?.class) <= rank(race.class) ||
            tunes(box.car).some((t) => t.class === race.class);
          expect(reaches, `${race.name}: ${box.car} cannot be ${race.class}`).toBe(true);
          expect(rank(box.cls) <= rank(race.class), `${race.name}: ${box.car} box`).toBe(true);
        }
      }
    }
  });

  it('every pinned or skipped tune is still in the catalogue', () => {
    // A sync can rename a tune: the box then shows its usual order, and this test says which one.
    for (const race of doc.races)
      for (const pick of race.cars) {
        const box = tuneBox(race, pick);
        const ids = new Set(tunes(box.car).map((t) => t.id));
        for (const id of [...box.pick, ...box.skip])
          expect(ids.has(id), `${race.name}: ${box.car} ${id}`).toBe(true);
      }
  });

  it('every wristband the guide shows has races', () => {
    const unlocks = new Set(doc.races.map((r) => r.unlock));
    for (const u of ['start', 'yellow', 'green', 'blue', 'pink', 'orange', 'purple', 'gold'])
      expect(unlocks.has(u as never), u).toBe(true);
  });
});
