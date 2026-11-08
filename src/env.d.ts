interface ImportMetaEnv {
  /** Directory with the generated JSON the site reads (see src/lib/data.ts). */
  readonly FH_DATA_DIR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
