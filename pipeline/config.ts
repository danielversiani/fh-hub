import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { paths } from './paths';
import { Localized } from './schema/entities';
import { SourcesFile } from './schema/source';

const AliasFile = z
  .record(z.string(), z.string())
  .nullable()
  .transform((v) => v ?? {});

export interface ManualData {
  /** Name seen in a source → canonical car id. */
  carAliases: Record<string, string>;
  /** Gamertag variant → canonical display name. */
  tunerAliases: Record<string, string>;
  /** Track name as written in a source's notes (e.g. Chinese) → English track name. */
  trackAliases: Record<string, string>;
  /** Source text → its translation (ADR-0014). */
  translations: Record<string, Localized>;
  /** Tuner id → the surface they specialise in, used when a tune gives no surface hint. */
  tunerSurfaces: Record<string, string>;
  /** Festival Playlist challenge text (English) → Portuguese. */
  playlistTexts: Record<string, string>;
}

const TranslationFile = z
  .record(z.string(), Localized)
  .nullable()
  .transform((v) => v ?? {});

function readYaml(file: string): unknown {
  return parseYaml(fs.readFileSync(file, 'utf8'));
}

export function loadSources(file = paths.sources): SourcesFile {
  return SourcesFile.parse(readYaml(file));
}

export function loadManual(dir = paths.manual): ManualData {
  return {
    carAliases: AliasFile.parse(readYaml(path.join(dir, 'car-aliases.yaml'))),
    tunerAliases: AliasFile.parse(readYaml(path.join(dir, 'tuner-aliases.yaml'))),
    trackAliases: fs.existsSync(path.join(dir, 'track-aliases.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'track-aliases.yaml')))
      : {},
    playlistTexts: fs.existsSync(path.join(dir, 'playlist-texts.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'playlist-texts.yaml')))
      : {},
    tunerSurfaces: fs.existsSync(path.join(dir, 'tuner-surfaces.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'tuner-surfaces.yaml')))
      : {},
    translations: fs.existsSync(path.join(dir, 'translations.yaml'))
      ? TranslationFile.parse(readYaml(path.join(dir, 'translations.yaml')))
      : {},
  };
}

export const MANUAL_ALIAS_FILES = [
  'car-aliases.yaml',
  'playlist-texts.yaml',
  'track-aliases.yaml',
  'tuner-aliases.yaml',
  'tuner-surfaces.yaml',
] as const;
