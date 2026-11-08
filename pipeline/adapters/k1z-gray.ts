import { cell, findHeader } from '../lib/table';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Year',
  'Make',
  'Model',
  'Tune Name',
  'Class',
  'Drivetrain',
  'Engine',
  'Build',
  'Tires',
  'Road Surface',
  'Share Code',
] as const;

/** K1Z Gray's "FH6 Tunes" tab: a clean one-row-per-tune table; every tune is by the owner. */
export const k1zGray: Adapter = {
  id: 'k1z-gray',
  parse(input) {
    const out = emptyOutput();
    const tuner = input.source.ownerTuner ?? 'K1Z Gray';
    for (const tab of input.source.tabs) {
      const { rows } = requireTab(input, tab.id, 'table');
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });

      rows.slice(index + 1).forEach((row, offset) => {
        const year = cell(row, col.Year);
        const make = cell(row, col.Make);
        const model = cell(row, col.Model);
        const name = cell(row, col['Tune Name']);
        if (!make || !model || !name) return;
        out.tunes.push({
          tab: tab.id,
          row: index + offset + 2,
          car: {
            text: `${year} ${make} ${model}`.trim(),
            year: /^\d{4}$/.test(year) ? Number(year) : undefined,
            make,
            model,
          },
          tuner,
          name,
          classText: cell(row, col.Class),
          surfaceText: cell(row, col['Road Surface']),
          drivetrain: cell(row, col.Drivetrain),
          tires: cell(row, col.Tires),
          engine: cell(row, col.Engine) || undefined,
          build: cell(row, col.Build) || undefined,
          shareCode: cell(row, col['Share Code']),
          raw: Object.fromEntries(COLUMNS.map((c) => [c, cell(row, col[c])])),
        });
      });
    }
    return out;
  },
};
