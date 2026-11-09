import type { FhstatsOnlineEntry, FhstatsRivalsCar } from '../fetchers/fhstats';
import { parseClass } from '../normalize/fields';
import type { ListLevel, Surface, TuneStyle } from '../schema/enums';
import { emptyOutput, requireTab, type Adapter } from './types';

const LEVEL: Readonly<Record<string, [ListLevel, string]>> = {
  'S+': ['meta-plus', 'Meta+'],
  S: ['meta', 'Meta'],
  A: ['strong', 'Strong'],
  B: ['offmeta', 'Offmeta'],
};

const SURFACE: Readonly<Record<string, Surface>> = {
  road: 'road',
  street: 'road',
  dirt: 'dirt',
  'cross-country': 'cross-country',
};

export function styleOf(text: string | undefined): TuneStyle | undefined {
  const t = (text ?? '').toLowerCase();
  if (/power/.test(t)) return 'power';
  if (/handling|grip/.test(t)) return 'handling';
  if (/all-?\s?round/.test(t)) return 'allround';
  return undefined;
}

/**
 * fhstats.com (ADR-0016/0017):
 * - tab `online`: the "Online Racing" meta list (curated from arpanjpr's sheet) — one pick per
 *   car × class × surface with a tier (S+ Meta+, S Meta, A Strong, B Offmeta), tune code and date;
 * - tab `rivals`: Rivals leaderboard statistics per car (top-10/top-50 appearances, wins), per
 *   class and discipline ("street" boards count as road).
 */
export const fhstats: Adapter = {
  id: 'fhstats',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { data } = requireTab(input, tab.id, 'json');
      if (!Array.isArray(data)) throw new Error(`[${input.source.id}/${tab.id}] expected an array`);
      if (tab.id === 'online') {
        (data as FhstatsOnlineEntry[]).forEach((e, i) => {
          const carClass = parseClass(e.className);
          const surface = SURFACE[e.discipline];
          const level = LEVEL[e.tier];
          if (!carClass || !surface || !level) {
            out.warnings.push(
              `online #${i + 1}: unknown class/surface/tier ${e.className}/${e.discipline}/${e.tier}`,
            );
            return;
          }
          const text = `${e.year ?? ''} ${e.make} ${e.model}`.trim();
          const date = (e.updatedAt ?? e.tuneDate)?.slice(0, 10);
          out.lists.push({
            tab: tab.id,
            row: i + 1,
            car: { text, year: e.year, make: e.make, model: e.model },
            carClass,
            surface,
            level: level[0],
            label: level[1],
            style: styleOf(e.buildType),
            extreme: /power ?build/i.test(e.buildType ?? '') || undefined,
            online: true,
            tuners: e.tuner ? [e.tuner] : [],
            date,
          });
          if (e.tuneCode && e.tuner) {
            out.tunes.push({
              tab: tab.id,
              row: i + 1,
              car: { text, year: e.year, make: e.make, model: e.model },
              tuner: e.tuner,
              name: e.tuneName ?? `${carClass} ${surface}`,
              carClass,
              surfaceText: surface,
              build: e.buildType,
              notes: e.notes?.en,
              shareCode: e.tuneCode,
              createdAt: e.tuneDate?.slice(0, 10),
              raw: {},
            });
          }
        });
      } else if (tab.id === 'rivals') {
        (data as FhstatsRivalsCar[]).forEach((car, i) => {
          const totals = new Map<string, { top10: number; top50: number; wins: number }>();
          for (const b of car.boards) {
            const carClass = parseClass(b.className);
            const surface = SURFACE[b.discipline];
            if (!carClass || !surface) continue;
            const key = `${carClass}|${surface}`;
            const t = totals.get(key) ?? { top10: 0, top50: 0, wins: 0 };
            t.top10 += b.top10Appearances;
            t.top50 += b.top50Appearances;
            t.wins += b.wins;
            totals.set(key, t);
          }
          for (const [key, t] of totals) {
            const [carClass, surface] = key.split('|') as [never, Surface];
            out.rivalsStats.push({
              tab: tab.id,
              row: i + 1,
              car: { text: car.carName },
              altNames: car.searchNames,
              carClass,
              surface,
              ...t,
            });
          }
        });
      } else {
        throw new Error(`[${input.source.id}] unknown tab "${tab.id}"`);
      }
    }
    return out;
  },
};
