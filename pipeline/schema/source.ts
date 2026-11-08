import { z } from 'zod';
import { CarClass, Permission, Slug, SourceKind } from './enums';

export const TabRole = z.enum([
  'tunes',
  'catalog',
  'attributes',
  'meta',
  'laptimes',
  'custom-event',
  'playlist',
]);
export type TabRole = z.infer<typeof TabRole>;

export const SourceTab = z.object({
  id: Slug,
  role: TabRole,
  /** Google Sheets tab id (the `gid` in the URL). Required by `google-csv`. */
  gid: z.string().regex(/^\d+$/).optional(),
  /** Worksheet name. Required by `google-xlsx`. */
  sheet: z.string().optional(),
  /** Page path on forza.net (e.g. `fh6cars`). Required by `forza-net`. */
  path: z.string().optional(),
  /** Fixed class for tabs that hold a single class (e.g. Letz' "A700" tab). */
  carClass: CarClass.optional(),
  label: z.string().optional(),
});
export type SourceTab = z.infer<typeof SourceTab>;

/**
 * google-csv  → CSV export of each tab (falls back to the gviz endpoint when the owner disabled downloads)
 * google-xlsx → whole workbook, for sources whose formatting carries data (kleis' colours)
 * forza-net   → Nuxt payload of an official forza.net page
 * qq-docs     → every tab of a public QQ Docs spreadsheet (fetchers/qq-docs.ts)
 * mediawiki   → members of a wiki category through the MediaWiki API (`path` = category)
 * mediawiki-images → the lead image of every page in a wiki category (`path` = category)
 */
export const Fetcher = z.enum([
  'google-csv',
  'google-xlsx',
  'forza-net',
  'qq-docs',
  'mediawiki',
  'mediawiki-images',
]);
export type Fetcher = z.infer<typeof Fetcher>;

export const SourceDef = z
  .object({
    id: Slug,
    name: z.string().min(1),
    kind: SourceKind,
    url: z.url(),
    /** Google document id (the long id in the spreadsheet URL). */
    docId: z.string().optional(),
    ownerTuner: z.string().optional(),
    fetcher: Fetcher,
    adapter: z.string().min(1),
    tabs: z.array(SourceTab).min(1),
    permission: Permission,
    active: z.boolean(),
    /** Confidence in the source, used for field precedence and curation (0–1). */
    weight: z.number().min(0).max(1),
    /** Tuners who asked not to be listed (ADR-0010). */
    excludedTuners: z.array(z.string()).default([]),
    notes: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: 'custom', message: `[${s.id}] ${message}` });
    if ((s.fetcher.startsWith('google-') || s.fetcher === 'qq-docs') && !s.docId) {
      fail(`${s.fetcher} needs \`docId\``);
    }
    for (const tab of s.tabs) {
      if (s.fetcher === 'google-csv' && !tab.gid) fail(`tab ${tab.id} needs \`gid\``);
      if (s.fetcher === 'google-xlsx' && !tab.sheet) fail(`tab ${tab.id} needs \`sheet\``);
      if ((s.fetcher === 'forza-net' || s.fetcher.startsWith('mediawiki')) && !tab.path) {
        fail(`tab ${tab.id} needs \`path\``);
      }
    }
  });
export type SourceDef = z.infer<typeof SourceDef>;

export const SourcesFile = z
  .object({ version: z.literal(1), sources: z.array(SourceDef) })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const s of file.sources) {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', message: `duplicate source id ${s.id}` });
      seen.add(s.id);
    }
  });
export type SourcesFile = z.infer<typeof SourcesFile>;

/** Sources whose data may be committed and published (ADR-0010). */
export const isPublic = (s: Pick<SourceDef, 'permission'>): boolean =>
  s.permission === 'granted' || s.permission === 'not-required';
