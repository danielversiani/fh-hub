import ExcelJS from 'exceljs';
import { loadSources } from '../config';
import { downloadSource, saveSource, type RawTab } from '../fetchers';
import type { QqBundle } from '../fetchers/qq-docs';
import { parseCsv, type Table } from '../lib/table';
import { paths } from '../paths';
import type { SourceDef } from '../schema/source';

/**
 * Fixtures are SAMPLES, not copies: the first rows (header area), every Nth row after that and
 * the last rows (trailing sections). Enough to exercise each adapter without republishing a
 * tuner's whole sheet (ADR-0010). Official forza.net payloads are kept whole.
 */
const HEAD_ROWS = 40;
const EVERY_NTH = 40;
const TAIL_ROWS = 12;

export const keepRow = (index: number, total: number): boolean =>
  index < HEAD_ROWS || index % EVERY_NTH === 0 || index >= total - TAIL_ROWS;

const toCsv = (rows: Table): string =>
  rows.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';

function sampleCsv(bytes: Buffer): Buffer {
  const rows = parseCsv(bytes.toString('utf8'));
  return Buffer.from(toCsv(rows.filter((_, i) => keepRow(i, rows.length))), 'utf8');
}

async function sampleXlsx(bytes: Buffer, sheetName: string): Promise<Buffer> {
  const source = new ExcelJS.Workbook();
  await source.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = source.getWorksheet(sheetName);
  if (!sheet) throw new Error(`worksheet "${sheetName}" not found`);
  const target = new ExcelJS.Workbook();
  const out = target.addWorksheet(sheetName);
  let next = 1;
  for (let r = 1; r <= sheet.rowCount; r++) {
    if (!keepRow(r - 1, sheet.rowCount)) continue;
    const from = sheet.getRow(r);
    const to = out.getRow(next++);
    for (let c = 1; c <= sheet.columnCount; c++) {
      to.getCell(c).value = from.getCell(c).value;
      to.getCell(c).style = JSON.parse(JSON.stringify(from.getCell(c).style ?? {}));
    }
    to.commit();
  }
  return Buffer.from(await target.xlsx.writeBuffer());
}

/** QQ bundles are protobuf blobs per tab, so the sample keeps a few whole tabs. */
const QQ_SAMPLE_TABS = ['R 998公路', 'S1 800泥地', 'C 500公路', '老车调校更新'];

function sampleQq(bytes: Buffer): Buffer {
  const bundle = JSON.parse(bytes.toString('utf8')) as QqBundle;
  bundle.sheets = bundle.sheets.filter((s) => QQ_SAMPLE_TABS.includes(s.name));
  return Buffer.from(JSON.stringify(bundle), 'utf8');
}

async function sample(source: SourceDef, tab: RawTab): Promise<RawTab> {
  if (tab.ext === 'csv') return { ...tab, bytes: sampleCsv(tab.bytes) };
  if (tab.ext === 'qq.json') return { ...tab, bytes: sampleQq(tab.bytes) };
  if (tab.ext === 'xlsx') {
    const sheet = source.tabs.find((t) => t.id === tab.tabId)?.sheet ?? 'Sheet1';
    return { ...tab, bytes: await sampleXlsx(tab.bytes, sheet) };
  }
  return tab;
}

export async function updateFixtures(sourceIds?: string[]): Promise<void> {
  const { sources } = loadSources();
  for (const source of sources.filter(
    (s) => s.active && (!sourceIds || sourceIds.includes(s.id)),
  )) {
    const tabs = await downloadSource(source);
    const sampled = await Promise.all(tabs.map((t) => sample(source, t)));
    saveSource(paths.fixtures, source.id, sampled);
    console.log(`✓ ${source.id}: ${sampled.map((t) => `${t.tabId}.${t.ext}`).join(', ')}`);
  }
}
