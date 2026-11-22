import { z } from 'zod';

/**
 * Beginner guides (ADR-0024): one Markdown file per guide and language, in
 * `src/content/guides/<locale>/<slug>.md`. The header is checked here, so a guide with a missing
 * or wrong field breaks the build instead of going live half-filled.
 */
export const GuideHeader = z.object({
  title: z.string().min(1),
  /** One or two sentences: shown in the guide list and as the page's search description. */
  summary: z.string().min(1),
  /** Position in the guide list. */
  order: z.number().int(),
  /** When the owner last checked the guide in the game; null = not checked yet (the page says so). */
  verifiedAt: z.iso.date().nullable(),
  /** Every source the guide relies on. */
  sources: z.array(z.object({ label: z.string().min(1), url: z.url() })).min(1),
  /** Only published guides go live; drafts show in `pnpm dev`. */
  published: z.boolean().default(false),
});
export type GuideHeader = z.infer<typeof GuideHeader>;
