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

/** The lead image of every page in a category (thumbnail URL + file name). */
export interface WikiPageImages {
  category: string;
  pages: { title: string; file?: string; thumb?: string }[];
}

interface PageImagesResponse {
  continue?: Record<string, string>;
  query?: {
    pages?: Record<string, { title: string; pageimage?: string; thumbnail?: { source: string } }>;
  };
}

export async function downloadPageImages(
  siteUrl: string,
  category: string,
  width = 480,
): Promise<WikiPageImages> {
  const api = `${siteUrl.replace(/\/$/, '')}/api.php`;
  const pages = new Map<string, WikiPageImages['pages'][number]>();
  let next: Record<string, string> = {};
  for (;;) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'categorymembers',
      gcmtitle: category,
      gcmnamespace: '0',
      gcmlimit: '50',
      prop: 'pageimages',
      piprop: 'thumbnail|name',
      pithumbsize: String(width),
      pilimit: '50',
      ...next,
    });
    const res = JSON.parse(
      (await fetchBytes(`${api}?${params.toString()}`)).toString('utf8'),
    ) as PageImagesResponse & { error?: { info?: string } };
    if (res.error) throw new Error(`[mediawiki] ${category}: ${res.error.info ?? 'error'}`);
    // A continuation batch may carry no pages (only the next cursor): that is normal.
    for (const p of Object.values(res.query?.pages ?? {})) {
      const page = pages.get(p.title) ?? { title: p.title };
      if (p.pageimage) page.file = p.pageimage;
      if (p.thumbnail) page.thumb = p.thumbnail.source;
      pages.set(p.title, page);
    }
    if (!res.continue) break;
    next = res.continue;
  }
  if (pages.size === 0) throw new Error(`[mediawiki] no pages in ${category}`);
  return { category, pages: [...pages.values()].sort((a, b) => a.title.localeCompare(b.title)) };
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
