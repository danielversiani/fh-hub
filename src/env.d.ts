// Astro's own types (import.meta.env.DEV, PROD…). Referenced here so a clean checkout (CI, no
// generated .astro/ folder) type-checks the same way as a local one.
/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Directory with the generated JSON the site reads (see src/lib/data.ts). */
  readonly FH_DATA_DIR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
