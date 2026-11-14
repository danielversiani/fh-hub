import { findMarkdownTable, parseMarkdownTable } from '../lib/markdown';
import { cell, findHeader } from '../lib/table';
import { cleanText } from '../lib/text';
import type { CarClass } from '../schema/enums';
import { parseClass } from '../normalize/fields';
import { emptyOutput, requireTab, type Adapter } from './types';

const COLUMNS = [
  'Make',
  'Car Name',
  'Car Type',
  'Car Class',
  'Country',
  'Collection',
  'Add-Ons',
] as const;

/** Official FH6 car roster from forza.net/fh6cars (master car list, ADR-0006). */
export const forzaCars: Adapter = {
  id: 'forza-cars',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { data } = requireTab(input, tab.id, 'json');
      const markdown = findMarkdownTable(data, '|Make|Car Name|');
      if (!markdown)
        throw new Error(`[${input.source.id}/${tab.id}] car table not found in payload`);
      const rows = parseMarkdownTable(markdown);
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });

      for (const row of rows.slice(index + 1)) {
        const make = cell(row, col.Make);
        const carName = cell(row, col['Car Name']);
        const named = /^(\d{4})\s+(.+)$/.exec(carName);
        if (!make || !named) {
          if (carName) out.warnings.push(`row without year or make: "${carName}"`);
          continue;
        }
        const [, yearText = '', rest = ''] = named;
        const model = rest.toLowerCase().startsWith(`${make.toLowerCase()} `)
          ? rest.slice(make.length + 1)
          : rest;
        const classMatch = /^(\d{3})\s*(\S+)$/.exec(cell(row, col['Car Class']));
        const stockClass: CarClass | undefined = parseClass(classMatch?.[2]);
        out.catalog.push({
          year: Number(yearText),
          make,
          model: cleanText(model),
          displayName: cleanText(carName),
          carTypes: cell(row, col['Car Type'])
            .split(',')
            // The list spells one type "Electic Domestics" once.
            .map((t) => t.trim().replace(/^Electic /, 'Eclectic '))
            .filter(Boolean),
          country: cell(row, col.Country) || undefined,
          stockClass,
          stockPi: classMatch ? Number(classMatch[1]) : undefined,
          acquisitionRaw: cell(row, col.Collection) || undefined,
          addOns: cell(row, col['Add-Ons']) || undefined,
        });
      }
    }
    return out;
  },
};
