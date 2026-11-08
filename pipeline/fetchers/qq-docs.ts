import { fetchResponse } from '../lib/http';
import { decodeWorkbookSheets, type QqSheetInfo } from '../lib/qq-sheet';

/**
 * Reads a public QQ Docs spreadsheet the way the web app does, without a browser:
 *   1. open the sheet page anonymously → session cookies (the `TOK` cookie doubles as xsrf token)
 *   2. dop-api/opendoc → document revision + workbook (list of tabs)
 *   3. dop-api/get/sheet per wanted tab → cell blobs
 * The result is a JSON bundle with the still-encoded blobs; decoding happens in the adapter,
 * so fixtures and the raw cache keep exactly what the server sent.
 */

export interface QqBundle {
  docId: string;
  globalPadId: string;
  rev: number;
  sheets: (QqSheetInfo & { relatedSheet: string[] })[];
}

const BASE = 'https://docs.qq.com';

function cookieJar() {
  const jar = new Map<string, string>();
  return {
    absorb(setCookies: string[]) {
      for (const header of setCookies) {
        const [pair = ''] = header.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    get: (name: string) => jar.get(name),
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
  };
}

interface OpenDocResponse {
  clientVars?: {
    globalPadId?: string;
    collab_client_vars?: {
      rev?: number;
      globalPadId?: string;
      initialAttributedText?: { text?: { workbook?: string }[] };
    };
  };
}

interface GetSheetResponse {
  retcode?: number;
  data?: {
    initialAttributedText?: {
      text?: { related_sheet?: string; block_datas?: { related_sheet?: string }[] }[];
    };
  };
}

export async function downloadQqDoc(
  docId: string,
  wantSheet: (sheet: QqSheetInfo) => boolean,
): Promise<QqBundle> {
  const jar = cookieJar();
  const pageUrl = `${BASE}/sheet/${docId}`;
  jar.absorb((await fetchResponse(pageUrl)).setCookies);
  const xsrf = jar.get('TOK');
  if (!xsrf)
    throw new Error(`[qq-docs ${docId}] no session token (TOK cookie) from the sheet page`);
  const headers = () => ({ cookie: jar.header(), referer: pageUrl });

  const open = await fetchResponse(
    `${BASE}/dop-api/opendoc?id=${docId}&outformat=1&normal=1&startrow=0&endrow=0&wb=1&nowb=0&xsrf=${xsrf}`,
    { headers: headers() },
  );
  jar.absorb(open.setCookies);
  const doc = JSON.parse(open.bytes.toString('utf8')) as OpenDocResponse;
  const collab = doc.clientVars?.collab_client_vars;
  const workbook = collab?.initialAttributedText?.text?.[0]?.workbook;
  const globalPadId = collab?.globalPadId ?? doc.clientVars?.globalPadId;
  if (!workbook || !globalPadId || collab?.rev === undefined) {
    throw new Error(`[qq-docs ${docId}] unexpected opendoc response (format changed?)`);
  }

  const bundle: QqBundle = { docId, globalPadId, rev: collab.rev, sheets: [] };
  for (const sheet of decodeWorkbookSheets(workbook).filter(wantSheet)) {
    const url =
      `${BASE}/dop-api/get/sheet?padId=${encodeURIComponent(globalPadId)}&subId=${sheet.id}` +
      `&startrow=0&endrow=${sheet.rows + 10}&xsrf=${xsrf}&outformat=1&normal=1` +
      `&preview_token=&nowb=1&rev=${collab.rev}`;
    const res = JSON.parse(
      (await fetchResponse(url, { headers: headers() })).bytes.toString('utf8'),
    ) as GetSheetResponse;
    const text = res.data?.initialAttributedText?.text?.[0];
    if (res.retcode !== 0 || !text) {
      throw new Error(`[qq-docs ${docId}/${sheet.id}] get/sheet failed (retcode ${res.retcode})`);
    }
    const blobs = [
      text.related_sheet,
      ...(text.block_datas ?? []).map((b) => b.related_sheet),
    ].filter((b): b is string => Boolean(b));
    bundle.sheets.push({ ...sheet, relatedSheet: blobs });
  }
  return bundle;
}
