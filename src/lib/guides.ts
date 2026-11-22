import type { MarkdownInstance } from 'astro';
import type { Locale } from '../i18n';
import { GuideHeader } from './guide-header';
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
    html: async () => fillTunePicks(await md.compiledContent(), locale),
  };
});

/** The guides of a language, in order; drafts only in development. */
export function loadGuides(locale: Locale): Guide[] {
  return all
    .filter((g) => g.locale === locale && (g.published || import.meta.env.DEV))
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
