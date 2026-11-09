import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { paths } from './paths';
import { BrainAfkRule, FeaturedPick, Localized, TierOverride } from './schema/entities';
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
  /** Car id → rarity confirmed in game by the owner (wins over the wiki). */
  carRarity: Record<string, string>;
  /** Tuner (gamertag) → date/reason: tuners who asked to leave the site (ADR-0016). */
  optOut: Record<string, string>;
  /** The platform's own picks shown in the highlights box (ADR-0017). */
  featured: FeaturedPick[];
  /** Tunes marked (or unmarked) as "brain AFK" by hand (ADR-0018). */
  brainAfk: BrainAfkRule[];
  /** The platform's tier set by hand (e.g. Niche), ADR-0017. */
  tierOverrides: TierOverride[];
}

const FeaturedFile = z
  .array(FeaturedPick)
  .nullable()
  .transform((v) => v ?? []);

const BrainAfkFile = z
  .array(BrainAfkRule)
  .nullable()
  .transform((v) => v ?? []);

const TierOverrideFile = z
  .array(TierOverride)
  .nullable()
  .transform((v) => v ?? []);

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
    optOut: fs.existsSync(path.join(dir, 'opt-out.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'opt-out.yaml')))
      : {},
    carRarity: fs.existsSync(path.join(dir, 'car-rarity.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'car-rarity.yaml')))
      : {},
    playlistTexts: fs.existsSync(path.join(dir, 'playlist-texts.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'playlist-texts.yaml')))
      : {},
    tunerSurfaces: fs.existsSync(path.join(dir, 'tuner-surfaces.yaml'))
      ? AliasFile.parse(readYaml(path.join(dir, 'tuner-surfaces.yaml')))
      : {},
    featured: fs.existsSync(path.join(dir, 'featured-picks.yaml'))
      ? FeaturedFile.parse(readYaml(path.join(dir, 'featured-picks.yaml')))
      : [],
    brainAfk: fs.existsSync(path.join(dir, 'brain-afk.yaml'))
      ? BrainAfkFile.parse(readYaml(path.join(dir, 'brain-afk.yaml')))
      : [],
    tierOverrides: fs.existsSync(path.join(dir, 'tier-overrides.yaml'))
      ? TierOverrideFile.parse(readYaml(path.join(dir, 'tier-overrides.yaml')))
      : [],
    translations: fs.existsSync(path.join(dir, 'translations.yaml'))
      ? TranslationFile.parse(readYaml(path.join(dir, 'translations.yaml')))
      : {},
  };
}

export const MANUAL_ALIAS_FILES = [
  'car-aliases.yaml',
  'car-rarity.yaml',
  'opt-out.yaml',
  'playlist-texts.yaml',
  'track-aliases.yaml',
  'tuner-aliases.yaml',
  'tuner-surfaces.yaml',
] as const;
