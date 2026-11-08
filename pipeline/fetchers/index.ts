import fs from 'node:fs';
import path from 'node:path';
import { unflatten } from 'devalue';
import type { TabPayload } from '../adapters/types';
import { fetchBytes, HttpError } from '../lib/http';
import { parseCsv } from '../lib/table';
import type { SourceDef, SourceTab } from '../schema/source';
import { downloadQqDoc } from './qq-docs';

/** `qq.json` is a QQ Docs bundle (fetchers/qq-docs.ts); `json` is a forza.net Nuxt payload. */
export type RawExt = 'csv' | 'xlsx' | 'json' | 'qq.json';

/** Bytes exactly as downloaded, kept for caching and fixtures. */
export interface RawTab {
  tabId: string;
  ext: RawExt;
  bytes: Buffer;
}

/** Faithful CSV export of one tab. Owners can disable it (HTTP 401/403), e.g. GBR Ozzy. */
export const exportCsvUrl = (docId: string, gid: string): string =>
  `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;

/**
 * Fallback when the export is disabled. Caveat: gviz guesses a type per column and blanks the
 * cells that do not match it (e.g. the "Year" header above a numeric column). headers=0 stops
 * it from merging the rows above the real header into one cell.
 */
export const gvizCsvUrl = (docId: string, gid: string): string =>
  `https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&headers=0&gid=${gid}`;

const looksLikeHtml = (bytes: Buffer) =>
  /^\s*<(!doctype|html)/i.test(bytes.subarray(0, 200).toString('utf8'));

async function downloadGoogleCsv(source: SourceDef, tab: SourceTab): Promise<Buffer> {
  let bytes: Buffer;
  try {
    bytes = await fetchBytes(exportCsvUrl(source.docId!, tab.gid!), 0);
  } catch (error) {
    if (!(error instanceof HttpError) || (error.status !== 401 && error.status !== 403))
      throw error;
    bytes = await fetchBytes(gvizCsvUrl(source.docId!, tab.gid!));
  }
  if (looksLikeHtml(bytes)) {
    throw new Error(`[${source.id}/${tab.id}] sheet is not publicly readable (got HTML)`);
  }
  return bytes;
}

export const xlsxExportUrl = (docId: string): string =>
  `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx`;

export const forzaPayloadUrl = (pagePath: string): string =>
  `https://forza.net/${pagePath}/_payload.json`;

const EXT: Record<SourceDef['fetcher'], RawExt> = {
  'google-csv': 'csv',
  'google-xlsx': 'xlsx',
  'forza-net': 'json',
  'qq-docs': 'qq.json',
};
const extFor = (source: SourceDef): RawExt => EXT[source.fetcher];

async function downloadTab(source: SourceDef, tab: SourceTab): Promise<Buffer> {
  switch (source.fetcher) {
    case 'qq-docs':
      // The whole spreadsheet (every tab) as one JSON bundle of still-encoded blobs.
      return Buffer.from(JSON.stringify(await downloadQqDoc(source.docId!, () => true)), 'utf8');
    case 'google-csv':
      return downloadGoogleCsv(source, tab);
    case 'google-xlsx': {
      const bytes = await fetchBytes(xlsxExportUrl(source.docId!));
      if (bytes.subarray(0, 2).toString('latin1') !== 'PK') {
        throw new Error(`[${source.id}] expected an .xlsx (zip) file`);
      }
      return bytes;
    }
    case 'forza-net':
      return fetchBytes(forzaPayloadUrl(tab.path!));
  }
}

/** Downloads every tab of a source. Workbook-based sources are downloaded once. */
export async function downloadSource(source: SourceDef): Promise<RawTab[]> {
  const ext = extFor(source);
  const result: RawTab[] = [];
  let workbook: Buffer | undefined;
  for (const tab of source.tabs) {
    if (source.fetcher === 'google-xlsx') {
      workbook ??= await downloadTab(source, tab);
      result.push({ tabId: tab.id, ext, bytes: workbook });
    } else {
      result.push({ tabId: tab.id, ext, bytes: await downloadTab(source, tab) });
    }
  }
  return result;
}

/** Reads raw tabs previously saved under `<dir>/<source-id>/<tab-id>.<ext>`. */
export function readSavedSource(dir: string, source: SourceDef): RawTab[] {
  const ext = extFor(source);
  return source.tabs.map((tab) => {
    const file = path.join(dir, source.id, `${tab.id}.${ext}`);
    if (!fs.existsSync(file)) throw new Error(`[${source.id}] saved tab not found: ${file}`);
    return { tabId: tab.id, ext, bytes: fs.readFileSync(file) };
  });
}

export function saveSource(dir: string, sourceId: string, tabs: RawTab[]): void {
  for (const tab of tabs) {
    const file = path.join(dir, sourceId, `${tab.tabId}.${tab.ext}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, tab.bytes);
  }
}

// Nuxt serialises its payload with devalue plus a few custom types.
const passthrough = (value: unknown) => value;
const NUXT_REVIVERS = {
  ShallowReactive: passthrough,
  Reactive: passthrough,
  Ref: passthrough,
  ShallowRef: passthrough,
  EmptyRef: () => undefined,
  EmptyShallowRef: () => undefined,
  NuxtError: passthrough,
  Island: passthrough,
};

export function decodeNuxtPayload(text: string): unknown {
  return unflatten(JSON.parse(text), NUXT_REVIVERS);
}

export function toPayload(tab: RawTab): TabPayload {
  switch (tab.ext) {
    case 'csv':
      return { kind: 'table', rows: parseCsv(tab.bytes.toString('utf8')) };
    case 'xlsx':
      return { kind: 'workbook', bytes: tab.bytes };
    case 'json':
      return { kind: 'json', data: decodeNuxtPayload(tab.bytes.toString('utf8')) };
    case 'qq.json':
      return { kind: 'json', data: JSON.parse(tab.bytes.toString('utf8')) as unknown };
  }
}
