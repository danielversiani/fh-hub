import { cell, findHeader, type Table } from '../lib/table';
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

/** Finds the markdown table inside the CMS page (the roster is published as a markdown table). */
function findMarkdownTable(node: unknown): string | undefined {
  if (typeof node === 'string') return node.includes('|Make|Car Name|') ? node : undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findMarkdownTable(item);
      if (found) return found;
    }
  } else if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findMarkdownTable(value);
      if (found) return found;
    }
  }
  return undefined;
}

export function parseMarkdownTable(markdown: string): Table {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .filter((line) => !/^\|?\s*:?-{3,}/.test(line.trim()))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim()),
    );
}

/** Official FH6 car roster from forza.net/fh6cars (master car list, ADR-0006). */
export const forzaCars: Adapter = {
  id: 'forza-cars',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { data } = requireTab(input, tab.id, 'json');
      const markdown = findMarkdownTable(data);
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
            .map((t) => t.trim())
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
