import type { Table } from './table';

/**
 * forza.net publishes its tables as Markdown inside CMS text fields. Finds the first string in
 * a decoded payload that contains `marker` (e.g. the start of the header row).
 */
export function findMarkdownTable(node: unknown, marker: string): string | undefined {
  if (typeof node === 'string') return node.includes(marker) ? node : undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findMarkdownTable(item, marker);
      if (found) return found;
    }
  } else if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findMarkdownTable(value, marker);
      if (found) return found;
    }
  }
  return undefined;
}

/** Rows of every Markdown table line (`|a|b|`), without the `|---|` separator lines. */
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

/** Plain text of a Markdown snippet: links become their label, emphasis markers are dropped. */
export const markdownToText = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]+/g, '')
    .replace(/<[^>]+>/g, ' ');
