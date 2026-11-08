import { fetchBytes } from '../lib/http';

/** Titles of the pages in a wiki category, via the public MediaWiki API (all pages, followed). */
export interface WikiCategory {
  category: string;
  titles: string[];
}

interface CategoryMembersResponse {
  continue?: { cmcontinue?: string };
  query?: { categorymembers?: { title: string }[] };
}

export async function downloadCategory(siteUrl: string, category: string): Promise<WikiCategory> {
  const api = `${siteUrl.replace(/\/$/, '')}/api.php`;
  const titles: string[] = [];
  let next: string | undefined;
  do {
    const url =
      `${api}?action=query&list=categorymembers&cmnamespace=0&cmlimit=500&format=json` +
      `&cmtitle=${encodeURIComponent(category)}${next ? `&cmcontinue=${encodeURIComponent(next)}` : ''}`;
    const res = JSON.parse((await fetchBytes(url)).toString('utf8')) as CategoryMembersResponse;
    if (!res.query?.categorymembers)
      throw new Error(`[mediawiki] unexpected response for ${category}`);
    titles.push(...res.query.categorymembers.map((m) => m.title));
    next = res.continue?.cmcontinue;
  } while (next);
  return { category, titles: titles.sort() };
}
