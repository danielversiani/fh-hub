import { cell, findHeader } from '../lib/table';
import { parseDayFirstDate } from '../normalize/fields';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Manufacturer',
  'Model/Car',
  'Class',
  'Tune Name',
  'Tuner',
  'Drivetrain',
  'Suspension',
  'Tyre Compound',
  'Sharecode',
] as const;

/**
 * GBR Ozzy's "FH6 Tune List" tab. Quirks (docs/DATA_SOURCES.md):
 * an empty first column, no car year, and two unnamed numeric columns after "Drivetrain"
 * (probably BHP and weight) plus an unnamed date column (DD/MM/YYYY) after "Tyre Compound".
 */
export const gbrOzzy: Adapter = {
  id: 'gbr-ozzy',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { rows } = requireTab(input, tab.id, 'table');
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });
      const dateCol = col['Tyre Compound'] + 1;

      rows.slice(index + 1).forEach((row, offset) => {
        const make = cell(row, col.Manufacturer);
        const model = cell(row, col['Model/Car']);
        const tuner = cell(row, col.Tuner);
        const name = cell(row, col['Tune Name']);
        if (!make || !model || !tuner || !name) return;
        out.tunes.push({
          tab: tab.id,
          row: index + offset + 2,
          car: { text: `${make} ${model}`, make, model },
          tuner,
          name,
          classText: cell(row, col.Class),
          drivetrain: cell(row, col.Drivetrain),
          tires: cell(row, col['Tyre Compound']),
          shareCode: cell(row, col.Sharecode),
          createdAt: parseDayFirstDate(cell(row, dateCol)),
          raw: {
            manufacturer: make,
            model,
            class: cell(row, col.Class),
            tuneName: name,
            tuner,
            drivetrain: cell(row, col.Drivetrain),
            suspension: cell(row, col.Suspension),
            tyreCompound: cell(row, col['Tyre Compound']),
            date: cell(row, dateCol),
            sharecode: cell(row, col.Sharecode),
          },
        });
      });
    }
    return out;
  },
};
