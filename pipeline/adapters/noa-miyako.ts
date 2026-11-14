import { decodeCells } from '../lib/qq-sheet';
import { cell, findHeader } from '../lib/table';
import { cleanText } from '../lib/text';
import type { QqBundle } from '../fetchers/qq-docs';
import type { CarClass, Surface } from '../schema/enums';
import { parseClass } from '../normalize/fields';
import { parseNoaSeasonTab } from './noa-season';
import { emptyOutput, requireTab, type Adapter, type RawMetaUpdate } from './types';

/** Column labels of every class × surface tab (Chinese). */
const COLUMNS = [
  '竞争力',
  '制造商',
  '车辆型号',
  '驱动',
  '难度',
  '轮胎',
  '定位',
  '调校师',
  '备注',
] as const;

const SURFACES: Record<string, Surface> = { 公路: 'road', 泥地: 'dirt', 越野: 'cross-country' };

/** "S1 800泥地" → { class: S1, surface: dirt }. Other tabs (intro, weekly, changelog) → undefined. */
export function parseMetaTabName(
  name: string,
): { carClass: CarClass; surface: Surface } | undefined {
  const m = /^(S1|S2|[DCBARX])\s*\d{3}\s*(公路|泥地|越野)$/.exec(name.trim());
  const carClass = m ? parseClass(m[1]) : undefined;
  return m && carClass ? { carClass, surface: SURFACES[m[2]!]! } : undefined;
}

/** News tabs: a dated log of updated tunes and a list of new cars' tunes. */
const UPDATE_TABS: Readonly<Record<string, RawMetaUpdate['kind']>> = {
  老车调校更新: 'update',
  新车调校速递: 'new-car',
};
const UPDATE_COLUMNS = ['制造商', '车辆型号', '等级', '赛事', '竞争力', '调校师'] as const;
/** 赛事 ("event") column of the news tabs. */
const EVENT_SURFACES: Readonly<Record<string, Surface>> = {
  公路街头: 'road',
  公路: 'road',
  街头: 'road',
  泥地: 'dirt',
  越野: 'cross-country',
};

/** "26.11.8" → "2026-11-08" */
export function parseShortDate(text: string): string | undefined {
  const m = /^(\d{2})\.(\d{1,2})\.(\d{1,2})$/.exec(text.trim());
  return m ? `20${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}` : undefined;
}

function parseUpdateTab(
  sheet: QqBundle['sheets'][number],
  kind: RawMetaUpdate['kind'],
  sourceId: string,
  tabId: string,
): RawMetaUpdate[] {
  const grid = decodeCells(sheet.relatedSheet);
  const { index, col } = findHeader(grid.rows, UPDATE_COLUMNS, {
    sourceId,
    tab: `${tabId}/${sheet.name}`,
  });
  const dateCol = grid.rows[index]!.findIndex((label) => label.trim() === '日期');
  const tunerCols = [col['调校师'], col['调校师'] + 1];
  const out: RawMetaUpdate[] = [];
  let current: RawMetaUpdate | undefined;
  for (let r = index + 1; r < grid.rows.length; r++) {
    const row = grid.rows[r];
    const tuners = tunerCols.map((c) => cell(row, c)).filter(Boolean);
    const model = cell(row, col['车辆型号']);
    const tier = cell(row, col['竞争力']);
    if (!model || !tier) {
      if (current) current.tuners.push(...tuners);
      continue;
    }
    const carClass = parseClass(cell(row, col['等级']));
    const surface = EVENT_SURFACES[cell(row, col['赛事'])];
    if (!carClass || !surface) {
      current = undefined;
      continue;
    }
    const make = cleanText(cell(row, col['制造商']).replace(/\p{Script=Han}+/gu, ' '));
    current = {
      tab: kind === 'update' ? 'updates' : 'new-cars',
      row: r + 1,
      kind,
      carClass,
      surface,
      car: { text: model, make: make || undefined },
      tier,
      tuners,
      date: dateCol >= 0 ? parseShortDate(cell(row, dateCol)) : undefined,
    };
    out.push(current);
  }
  return out;
}

/**
 * Noa Miyako's meta table (QQ Docs, ADR-0005). One tab per class × surface; each car takes one
 * row plus continuation rows listing more tuners. Columns: tier (竞争力), make (制造商), model
 * (车辆型号), drivetrain, difficulty, tyres, profile (定位), two tuner columns (调校师 + unnamed),
 * notes (备注, often a Shirakawa lap time) and how to obtain. No share codes: players search the
 * tuners' gamertags in game.
 */
export const noaMiyako: Adapter = {
  id: 'noa-miyako',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const bundle = requireTab(input, tab.id, 'json').data as QqBundle;
      if (!Array.isArray(bundle?.sheets)) throw new Error(`[${input.source.id}] not a QQ bundle`);
      let unreadable = 0;
      let unrated = 0;

      for (const sheet of bundle.sheets) {
        // The weekly playlist tab: a recommended car and tune per event (ADR-0020).
        if (sheet.name.startsWith('季节赛')) {
          out.eventPicks.push(
            ...parseNoaSeasonTab(decodeCells(sheet.relatedSheet).rows, `${tab.id}/weekly`),
          );
          continue;
        }
        const updateKind = UPDATE_TABS[sheet.name];
        if (updateKind) {
          out.metaUpdates.push(...parseUpdateTab(sheet, updateKind, input.source.id, tab.id));
          continue;
        }
        const meta = parseMetaTabName(sheet.name);
        if (!meta) continue;
        const grid = decodeCells(sheet.relatedSheet);
        const tabId = `${meta.carClass.toLowerCase()}-${meta.surface}`;
        const { index, col } = findHeader(grid.rows, COLUMNS, {
          sourceId: input.source.id,
          tab: `${tab.id}/${sheet.name}`,
        });
        const tunerCols = [col['调校师'], col['调校师'] + 1];
        const unsupported = new Set(grid.unsupported.map((u) => `${u.row}:${u.col}`));
        let rank = 0;
        let current: (typeof out.meta)[number] | undefined;

        for (let r = index + 1; r < grid.rows.length; r++) {
          const row = grid.rows[r];
          const tier = cell(row, col['竞争力']);
          const tuners = tunerCols.map((c) => cell(row, c)).filter(Boolean);
          if (!tier) {
            // Continuation row: more tuners for the car above.
            if (current) current.tuners.push(...tuners);
            continue;
          }
          // "Toyota 丰田" → "Toyota" (the make is written in English and Chinese).
          const make = cleanText(cell(row, col['制造商']).replace(/\p{Script=Han}+/gu, ' '));
          let model = cell(row, col['车辆型号']);
          if (!model && unsupported.has(`${r}:${col['车辆型号']}`)) {
            unreadable++;
            model = `${make} [rich cell]`;
          }
          rank++;
          current = {
            tab: tabId,
            row: r + 1,
            carClass: meta.carClass,
            surface: meta.surface,
            car: { text: model || make, make: make || undefined },
            tier,
            rank,
            drivetrain: cell(row, col['驱动']) || undefined,
            difficulty: cell(row, col['难度']) || undefined,
            tires: cell(row, col['轮胎']) || undefined,
            role: cell(row, col['定位']) || undefined,
            tuners,
            notes: cell(row, col['备注']) || undefined,
            raw: Object.fromEntries(COLUMNS.map((c) => [c, cell(row, col[c])])),
          };
          if (tier === '未知') unrated++;
          out.meta.push(current);
        }
      }
      if (unreadable)
        out.warnings.push(`${unreadable} car names in rich cells the API does not expose`);
      if (unrated) out.warnings.push(`${unrated} cars marked 未知 (not rated yet)`);
    }
    return out;
  },
};
