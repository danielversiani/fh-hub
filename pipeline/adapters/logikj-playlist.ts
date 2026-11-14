import ExcelJS from 'exceljs';
import { cleanText } from '../lib/text';
import { cell, findHeader, type Table } from '../lib/table';
import {
  emptyOutput,
  requireTab,
  type Adapter,
  type EventPickKind,
  type RawEventPick,
} from './types';

const COLUMNS = ['Event', 'Year', 'Make', 'Model', 'Tuner', 'Tune Name', 'Share Code'] as const;

/**
 * "Series 7 Autumn/Fall", "Series 7 Winter WIP": one tab per playlist week. The .xlsx export
 * drops the "/" ("Series 7 AutumnFall"), so no word boundary after the season.
 */
const TAB = /^\s*Series\s+(\d+)\s+(Summer|Autumn|Fall|Winter|Spring)/i;
const SEASONS: Readonly<Record<string, RawEventPick['season']>> = {
  summer: 'summer',
  autumn: 'autumn',
  fall: 'autumn',
  winter: 'winter',
  spring: 'spring',
};

/** The start of the Event cell → kind of event ("Seasonal Championship (Dirt) - …"). */
const KINDS: readonly [RegExp, EventPickKind][] = [
  [/^seasonal championship|^championship/i, 'championship'],
  [/^the trial/i, 'trial'],
  [/^weekly challenge/i, 'weekly-challenge'],
  [/^time attack/i, 'time-attack'],
  [/^speed trap/i, 'speed-trap'],
  [/^speed zone/i, 'speed-zone'],
  [/^drift zone/i, 'drift-zone'],
  [/^danger sign/i, 'danger-sign'],
  [/^drag/i, 'drag'],
  [/^trailblazer/i, 'trailblazer'],
];

/** "Seasonal Championship (Street) - Ford Runner\nReward: …" → kind and name. */
export function parseEventCell(text: string): { kind?: EventPickKind; name: string } {
  const first = text.split('\n')[0]!.trim();
  const kind = KINDS.find(([re]) => re.test(first))?.[1];
  const name = /\s[-–]\s(.+)$/.exec(first)?.[1] ?? /:\s*(.+)$/.exec(first)?.[1] ?? first;
  return { kind, name: cleanText(name) };
}

/** Cell text; links and rich text with empty parts make exceljs' `.text` throw. */
function cellText(c: ExcelJS.Cell): string {
  // Rich text (the merged Event cells): its parts joined, keeping the line breaks.
  const value = c.value as { richText?: { text?: string }[] } | null;
  if (value && typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map((p) => p.text ?? '').join('');
  }
  try {
    return c.text ?? '';
  } catch {
    const v = c.value as { richText?: { text?: string }[]; text?: unknown } | null;
    if (v?.richText) return v.richText.map((p) => p.text ?? '').join('');
    return typeof v?.text === 'string' ? v.text : '';
  }
}

async function readTabs(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  return workbook.worksheets
    .filter((sheet) => TAB.test(sheet.name))
    .map((sheet) => {
      const rows: Table = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        rows.push(Array.from({ length: 20 }, (_, i) => cellText(row.getCell(i + 1))));
      }
      return { name: sheet.name, rows };
    });
}

/**
 * LogikJ's playlist tabs ("Series 7 Autumn/Fall"): each event starts a block (Event column), and
 * every row of the block with a car is a recommended car, usually with LogikJ's tune for it.
 */
export const logikjPlaylist: Adapter = {
  id: 'logikj-playlist',
  async parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { bytes } = requireTab(input, tab.id, 'workbook');
      for (const { name: sheet, rows } of await readTabs(bytes)) {
        const [, series, season] = TAB.exec(sheet)!;
        // Old weeks used other layouts: skipped with a warning instead of failing the source.
        let header: { index: number; col: Record<(typeof COLUMNS)[number], number> };
        try {
          header = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: sheet });
        } catch {
          out.warnings.push(`tab "${sheet}": other layout, skipped`);
          continue;
        }
        const { index, col } = header;
        let event: ReturnType<typeof parseEventCell> | undefined;
        rows.slice(index + 1).forEach((row, offset) => {
          const eventText = cell(row, col.Event);
          if (eventText) event = parseEventCell(eventText);
          const make = cell(row, col.Make);
          // Chassis codes in brackets ("IMPREZA WRX STI (GR)") are not in the official names.
          const model = cell(row, col.Model)
            .replace(/\s*\((?:(?:Mk|Typ)\s*)?(?:[A-Za-z0-9.]{1,6}|'\d{2})\)\s*$/, '')
            .trim();
          const year = cell(row, col.Year);
          if (!event?.kind || !make || !model) return;
          out.eventPicks.push({
            tab: sheet,
            row: index + offset + 2,
            series: Number(series),
            season: SEASONS[season!.toLowerCase()]!,
            kind: event.kind,
            eventName: event.name,
            car: {
              text: `${year} ${make} ${model}`.trim(),
              year: /^\d{4}$/.test(year) ? Number(year) : undefined,
              make,
              model,
            },
            tuner: cell(row, col.Tuner) || undefined,
            tuneName: cell(row, col['Tune Name']) || undefined,
            shareCode: cell(row, col['Share Code']).replace(/\D/g, '') || undefined,
          });
        });
      }
    }
    return out;
  },
};
