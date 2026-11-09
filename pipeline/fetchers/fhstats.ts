import { fetchBytes } from '../lib/http';

/**
 * fhstats.com pages are Next.js server-rendered; their data travels inside
 * `self.__next_f.push([1, "…"])` script chunks. This joins those chunks and pulls out the JSON
 * arrays/objects the adapters need, so only the data (not 1–5 MB of HTML) is saved.
 */
export function flightText(html: string): string {
  const chunks = html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g);
  return [...chunks].map((m) => JSON.parse(`"${m[1]}"`) as string).join('');
}

/** Every JSON value that starts right after `marker` (e.g. `"entries":[`), decoded. */
function valuesAfter(text: string, marker: RegExp, startOffset: number): unknown[] {
  const out: unknown[] = [];
  for (const m of text.matchAll(marker)) {
    const start = m.index + m[0].length + startOffset;
    const value = decodeAt(text, start);
    if (value !== undefined) out.push(value);
  }
  return out;
}

/** Decodes the JSON value (object or array) that begins at `start`. */
function decodeAt(text: string, start: number): unknown {
  const open = text[start];
  const close = open === '[' ? ']' : open === '{' ? '}' : undefined;
  if (!close) return undefined;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  return undefined;
}

export interface FhstatsOnlineEntry {
  discipline: string;
  className: string;
  tier: string;
  year?: number;
  make: string;
  model: string;
  tuneCode?: string;
  tuneName?: string;
  tuneDate?: string;
  tuner?: string;
  buildType?: string;
  difficulty?: string;
  notes?: { en?: string };
  updatedAt?: string;
}

export interface FhstatsRivalsCar {
  carName: string;
  searchNames: string[];
  boards: {
    discipline: string;
    className: string;
    top10Appearances: number;
    top50Appearances: number;
    wins: number;
  }[];
}

/** The "Online Racing" meta list (curated from arpanjpr's sheet): one entry per car × class × surface. */
export async function downloadFhstatsOnline(url: string): Promise<FhstatsOnlineEntry[]> {
  const text = flightText((await fetchBytes(url)).toString('utf8'));
  const entries = valuesAfter(text, /"entries":/g, 0).flat() as FhstatsOnlineEntry[];
  if (entries.length === 0) throw new Error('[fhstats] no entries found on the online meta page');
  return entries.map((e) => ({
    discipline: e.discipline,
    className: e.className,
    tier: e.tier,
    year: e.year,
    make: e.make,
    model: e.model,
    tuneCode: e.tuneCode,
    tuneName: e.tuneName,
    tuneDate: e.tuneDate,
    tuner: e.tuner,
    buildType: e.buildType,
    difficulty: e.difficulty,
    notes: e.notes?.en ? { en: e.notes.en } : undefined,
    updatedAt: e.updatedAt,
  }));
}

/** Rivals car statistics: top-10/top-50 appearances and wins per car, per class × discipline. */
export async function downloadFhstatsRivals(url: string): Promise<FhstatsRivalsCar[]> {
  const text = flightText((await fetchBytes(url)).toString('utf8'));
  const seen = new Map<string, FhstatsRivalsCar>();
  for (const m of text.matchAll(/\{"identity":"id:\d+"/g)) {
    const car = decodeAt(text, m.index) as (FhstatsRivalsCar & { identity: string }) | undefined;
    if (!car?.boards || seen.has(car.identity)) continue;
    seen.set(car.identity, {
      carName: car.carName,
      searchNames: car.searchNames ?? [],
      boards: car.boards.map((b) => ({
        discipline: b.discipline,
        className: b.className,
        top10Appearances: b.top10Appearances,
        top50Appearances: b.top50Appearances,
        wins: b.wins,
      })),
    });
  }
  if (seen.size === 0) throw new Error('[fhstats] no cars found on the Rivals statistics page');
  return [...seen.values()];
}
