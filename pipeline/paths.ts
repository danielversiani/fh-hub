import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Two output roots (ADR-0010):
 * - `public`  → committed to Git and published. Only sources with permission `granted` or `not-required`.
 * - `preview` → git-ignored. Every active source, for local development while permissions are pending.
 */
export const OUTPUT_ROOTS = {
  public: path.join(ROOT, 'data'),
  preview: path.join(ROOT, '.cache', 'preview'),
} as const;

export type Visibility = keyof typeof OUTPUT_ROOTS;
export const VISIBILITIES: readonly Visibility[] = ['public', 'preview'];

export const paths = {
  sources: path.join(ROOT, 'data', 'sources.yaml'),
  manual: path.join(ROOT, 'data', 'manual'),
  rawCache: path.join(ROOT, '.cache', 'raw'),
  fixtures: path.join(ROOT, 'pipeline', '__fixtures__'),
  i18n: path.join(ROOT, 'src', 'i18n'),
} as const;

export const generatedDir = (v: Visibility): string => path.join(OUTPUT_ROOTS[v], 'generated');
export const reviewDir = (v: Visibility): string => path.join(OUTPUT_ROOTS[v], 'review');
/** Last good adapter output per source ("último dado bom", ADR-0005). */
export const snapshotsDir = (v: Visibility): string => path.join(OUTPUT_ROOTS[v], 'snapshots');
