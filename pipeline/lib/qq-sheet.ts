import { inflateSync } from 'node:zlib';
import { Message } from './protobuf';

/**
 * Decoder for QQ Docs (docs.qq.com) spreadsheet payloads. Undocumented format, reverse
 * engineered on 2026-11-08 (docs/DATA_SOURCES.md, ficha `noa-miyako`):
 *
 * Every blob is base64 → zlib → protobuf. Root: field 1 = message with repeated field 5
 * "mutations"; each mutation has field 1 = kind.
 *
 * workbook blob — mutation kind 1, field 2 = sheet:
 *   3 → {1: sheet id}   5 → {1: sheet name}   7 → {1: row count}   8 → {1: column count}
 *
 * related_sheet blob (cells) — mutation kind 18, field 19 = body:
 *   5 → string pool: repeated {1: text}
 *   6 → repeated cell: {1: row (default 0), 2: column (default 0), 3: value}
 *       value: {1: type, 2: {1: string pool index (default 0)}}
 *       type 4 = string from the pool; other types may carry a double (numbers).
 *       type 6 = rich content (links/chips) whose text is NOT in the payload → unsupported.
 */

export interface QqSheetInfo {
  id: string;
  name: string;
  rows: number;
  cols: number;
}

export interface QqGrid {
  /** rows[r][c] = cell text ('' when empty). */
  rows: string[][];
  /** Cells whose value could not be read (rich content). */
  unsupported: { row: number; col: number }[];
}

const inflate = (base64: string): Buffer => inflateSync(Buffer.from(base64, 'base64'));

function mutations(base64: string): Message[] {
  const root = new Message(inflate(base64)).message(1);
  return root ? root.messages(5) : [];
}

export function decodeWorkbookSheets(workbookBase64: string): QqSheetInfo[] {
  return mutations(workbookBase64)
    .filter((m) => m.int(1) === 1)
    .flatMap((m) => {
      const sheet = m.message(2);
      if (!sheet) return [];
      return [
        {
          id: sheet.message(3)?.string(1) ?? '',
          name: sheet.message(5)?.string(1) ?? '',
          rows: sheet.message(7)?.int(1) ?? 0,
          cols: sheet.message(8)?.int(1) ?? 0,
        },
      ];
    })
    .filter((s) => s.id);
}

/** Merges one or more related_sheet blobs (blocks of rows) into a grid. */
export function decodeCells(relatedSheetBase64: readonly string[]): QqGrid {
  const grid: string[][] = [];
  const unsupported: QqGrid['unsupported'] = [];
  for (const blob of relatedSheetBase64) {
    for (const mutation of mutations(blob)) {
      if (mutation.int(1) !== 18) continue;
      const body = mutation.message(19);
      if (!body) continue;
      const pool = (body.message(5)?.messages(1) ?? []).map((s) => s.string(1) ?? '');
      for (const cell of body.messages(6)) {
        const row = cell.int(1);
        const col = cell.int(2);
        const value = cell.message(3);
        if (!value) continue;
        const type = value.int(1);
        let text: string | undefined;
        if (type === 4) text = pool[value.message(2)?.int(1) ?? 0];
        else if (type !== 0) {
          const n = value.firstDouble();
          if (n !== undefined && Number.isFinite(n)) text = String(n);
          else if (type === 6) unsupported.push({ row, col });
        }
        if (text === undefined) continue;
        grid[row] ??= [];
        grid[row]![col] = text;
      }
    }
  }
  // `grid` is sparse: iterate explicitly (spreading holes would yield undefined → NaN).
  let width = 0;
  for (let r = 0; r < grid.length; r++) width = Math.max(width, grid[r]?.length ?? 0);
  const rows = Array.from({ length: grid.length }, (_, r) =>
    Array.from({ length: width }, (_, c) => grid[r]?.[c] ?? ''),
  );
  return { rows, unsupported };
}
