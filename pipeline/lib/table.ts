import { parse } from 'csv-parse/sync';

export type Table = string[][];

export function parseCsv(text: string): Table {
  return parse(text, { relax_column_count: true, skip_empty_lines: false, bom: true }) as Table;
}

/** Raised when a source no longer has the columns its adapter expects (ADR-0005). */
export class HeaderMismatchError extends Error {
  constructor(
    readonly sourceId: string,
    readonly tab: string,
    readonly expected: readonly string[],
  ) {
    super(`[${sourceId}/${tab}] header row not found; expected columns: ${expected.join(', ')}`);
    this.name = 'HeaderMismatchError';
  }
}

const normalizeLabel = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

/** Cell value with collapsed whitespace ('' when missing). */
export const cell = (row: readonly string[] | undefined, index: number): string =>
  (row?.[index] ?? '').replace(/\s+/g, ' ').trim();

/**
 * Finds the first row (within `maxScan`) that contains every expected label and returns its
 * index plus a label → column map. Tolerates extra columns and rows above the header, but not
 * renamed or missing columns.
 */
export function findHeader<L extends string>(
  rows: Table,
  expected: readonly L[],
  context: { sourceId: string; tab: string },
  maxScan = 40,
): { index: number; col: Record<L, number> } {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const labels = (rows[i] ?? []).map(normalizeLabel);
    const col = {} as Record<L, number>;
    let complete = true;
    for (const label of expected) {
      const position = labels.indexOf(normalizeLabel(label));
      if (position < 0) {
        complete = false;
        break;
      }
      col[label] = position;
    }
    if (complete) return { index: i, col };
  }
  throw new HeaderMismatchError(context.sourceId, context.tab, expected);
}
