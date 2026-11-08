import { cell, findHeader } from '../lib/table';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Tier',
  'Car',
  'Laptime',
  'Driver',
  'Tune',
  'Build',
  'Difficulty',
  'Tires',
  'Drivetrain',
  'Engine',
  'Aero',
  'Tune Name',
  'Notes',
] as const;

const TRACK = 'Shirakawa';

/**
 * LetzeLU's hotlap sheet: one tab per class, lap times at Shirakawa. The "Tier" cell is merged
 * over several rows, so it is carried down. Rows also describe a tune (no share code).
 */
export const letzeluShirakawa: Adapter = {
  id: 'letzelu-shirakawa',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const carClass = tab.carClass;
      if (!carClass) throw new Error(`[${input.source.id}/${tab.id}] tab needs carClass`);
      const { rows } = requireTab(input, tab.id, 'table');
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });
      let tier = '';

      rows.slice(index + 1).forEach((row, offset) => {
        tier = cell(row, col.Tier) || tier;
        const carText = cell(row, col.Car);
        const time = cell(row, col.Laptime);
        if (!carText || !time) return;
        const rowNumber = index + offset + 2;
        const tuner = cell(row, col.Tune);
        const tuneName = cell(row, col['Tune Name']);
        const raw = Object.fromEntries(COLUMNS.map((c) => [c, cell(row, col[c])]));
        raw.Tier = tier;

        out.lapTimes.push({
          tab: tab.id,
          row: rowNumber,
          car: { text: carText },
          track: TRACK,
          carClass,
          time,
          driver: cell(row, col.Driver),
          tuner: tuner || undefined,
          tuneName: tuneName || undefined,
          tierLabel: tier || undefined,
          build: cell(row, col.Build) || undefined,
          difficulty: cell(row, col.Difficulty) || undefined,
          tires: cell(row, col.Tires) || undefined,
          drivetrain: cell(row, col.Drivetrain) || undefined,
          engine: cell(row, col.Engine) || undefined,
          aero: cell(row, col.Aero) || undefined,
          notes: cell(row, col.Notes) || undefined,
        });

        if (tuner && tuneName) {
          out.tunes.push({
            tab: tab.id,
            row: rowNumber,
            car: { text: carText },
            tuner,
            name: tuneName,
            carClass,
            surfaceText: 'road',
            drivetrain: cell(row, col.Drivetrain),
            tires: cell(row, col.Tires),
            engine: cell(row, col.Engine) || undefined,
            build: cell(row, col.Build) || undefined,
            notes: cell(row, col.Notes) || undefined,
            raw,
          });
        }
      });
    }
    return out;
  },
};
