import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { paths } from './paths';
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
}

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
  };
}

export const MANUAL_ALIAS_FILES = ['car-aliases.yaml', 'tuner-aliases.yaml'] as const;
