import { findMarkdownTable, markdownToText, parseMarkdownTable } from '../lib/markdown';
import { cell, findHeader } from '../lib/table';
import { emptyOutput, requireTab, type Adapter, type RawPlaylist } from './types';

const COLUMNS = [
  'Series / Season',
  'Reward',
  'Event Type',
  'Event Name',
  'Car / Requirement',
  'Route',
] as const;

/** Every string in the payload, used to find the "live season" sentence wherever it lives. */
function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node !== null && typeof node === 'object') {
    Object.values(node).forEach((n) => collectStrings(n, out));
  }
  return out;
}

function findUpdatedAt(node: unknown): string | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const record = node as Record<string, unknown>;
  if (typeof record.updatedAt === 'string' && Array.isArray(record.sections))
    return record.updatedAt;
  for (const value of Object.values(record)) {
    const found = findUpdatedAt(value);
    if (found) return found;
  }
  return undefined;
}

/**
 * Official Festival Playlist table (forza.net/fh6playlists): every series and season since
 * launch, plus a sentence naming the live season and its last day (ADR-0009). Requirements are
 * kept as written; they are interpreted later against the car list (normalize/requirement.ts).
 */
export const forzaPlaylist: Adapter = {
  id: 'forza-playlist',
  parse(input) {
    const out = emptyOutput();
    for (const tab of input.source.tabs) {
      const { data } = requireTab(input, tab.id, 'json');
      const markdown = findMarkdownTable(data, '|Series / Season|');
      if (!markdown) throw new Error(`[${input.source.id}/${tab.id}] playlist table not found`);
      const rows = parseMarkdownTable(markdown);
      const { index, col } = findHeader(rows, COLUMNS, { sourceId: input.source.id, tab: tab.id });

      const playlist: RawPlaylist = { rows: [], updatedAt: findUpdatedAt(data) };
      const live = collectStrings(data)
        .map(markdownToText)
        .map((text) =>
          /search\s+"([^"]+?)"\s+for the seasonal events available through\s+([A-Z][a-z]+ \d{1,2})/.exec(
            text.replace(/\s+/g, ' '),
          ),
        )
        .find(Boolean);
      if (live) {
        playlist.currentSeasonLabel = live[1]!.trim();
        playlist.currentSeasonEnds = live[2];
      } else {
        out.warnings.push('live season sentence not found; current season will be unknown');
      }

      rows.slice(index + 1).forEach((row, offset) => {
        const seasonLabel = cell(row, col['Series / Season']);
        if (!seasonLabel) return;
        playlist.rows.push({
          row: index + offset + 2,
          seasonLabel,
          reward: cell(row, col.Reward),
          type: cell(row, col['Event Type']),
          name: cell(row, col['Event Name']),
          requirement: cell(row, col['Car / Requirement']),
          route: cell(row, col.Route),
        });
      });
      out.playlists.push(playlist);
    }
    return out;
  },
};
