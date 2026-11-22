import type { MarkdownInstance } from 'astro';
import type { Locale } from '../i18n';
import { GuideHeader } from './guide-header';
import { fillDecks } from './guide-decks';
import { fillTunePicks } from './guide-picks';

export interface Guide extends GuideHeader {
  slug: string;
  locale: Locale;
  /** The guide's HTML, with its tune boxes filled from the catalogue. */
  html: () => Promise<string>;
}

const files = import.meta.glob<MarkdownInstance<Record<string, unknown>>>(
  '../content/guides/*/*.md',
  { eager: true },
);

const all: Guide[] = Object.entries(files).map(([file, md]) => {
  const [, locale, slug] = /guides\/([^/]+)\/([^/]+)\.md$/.exec(file) ?? [];
  if (locale !== 'pt-br' && locale !== 'en')
    throw new Error(`guide in an unknown language: ${file}`);
  const header = GuideHeader.safeParse(md.frontmatter);
  if (!header.success) throw new Error(`guide ${file}: ${header.error.message}`);
  return {
    ...header.data,
    slug: slug!,
    locale,
    html: async () => fillDecks(fillTunePicks(await md.compiledContent(), locale), locale),
  };
});

const byOrder = (a: Guide, b: Guide) => a.order - b.order || a.slug.localeCompare(b.slug);

/** The guides of a language, in order; drafts only in development. */
export function loadGuides(locale: Locale): Guide[] {
  return all
    .filter((g) => g.locale === locale && (g.published || import.meta.env.DEV))
    .sort(byOrder);
}

/**
 * The unpublished guides of a language, built at the unlisted /guides/draft/<guide>/ so the
 * owner can review them on a phone: not in the menu, the sitemap or llms.txt, and noindex.
 */
export function loadDraftGuides(locale: Locale): Guide[] {
  return all.filter((g) => g.locale === locale && !g.published).sort(byOrder);
}
