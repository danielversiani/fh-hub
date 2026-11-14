import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import type { z } from 'zod';
import { ADAPTERS } from '../adapters';
import { loadManual, loadSources, MANUAL_ALIAS_FILES } from '../config';
import { generatedDir, paths, reviewDir } from '../paths';
import {
  Car,
  ChangeLogEntry,
  CustomEvent,
  generatedFile,
  Highlight,
  LapTime,
  RivalsPick,
  RivalsStat,
  CarRole,
  ListEntry,
  MetaRanking,
  PlaylistEvent,
  PlaylistSeason,
  ReviewItem,
  SourceStatus,
  Suggestion,
  EventPick,
  Tune,
  TuneIndexEntry,
  Tuner,
} from '../schema/entities';

const GENERATED: [string, z.ZodType][] = [
  ['cars.json', Car],
  ['tuners.json', Tuner],
  ['laptimes.json', LapTime],
  ['rivals.json', RivalsPick],
  ['rivals-stats.json', RivalsStat],
  ['roles.json', CarRole],
  ['custom-events.json', CustomEvent],
  ['sources-status.json', SourceStatus],
  ['tunes/index.json', TuneIndexEntry],
  ['playlist/seasons.json', PlaylistSeason],
  ['highlights.json', Highlight],
];

/** Folders of grouped files (one JSON per key) and their item schema. */
const GENERATED_DIRS: [string, z.ZodType][] = [
  ['tunes/by-car', Tune],
  ['meta', MetaRanking],
  ['lists', ListEntry],
  ['playlist/events', PlaylistEvent],
  ['playlist/suggestions', Suggestion],
  ['playlist/picks', EventPick],
  ['changelog', ChangeLogEntry],
];

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k));
}

function checkFile(file: string, schema: z.ZodType, errors: string[]): void {
  if (!fs.existsSync(file)) return;
  const result = generatedFile(schema).safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!result.success) {
    const first = result.error.issues[0];
    errors.push(
      `${path.relative(process.cwd(), file)}: ${first?.path.join('.')} ${first?.message}`,
    );
  }
}

/** Validates everything committed by humans or by the bot. Returns the list of problems. */
export function validate(): string[] {
  const errors: string[] = [];

  try {
    const { sources } = loadSources();
    for (const s of sources) {
      if (!ADAPTERS[s.adapter])
        errors.push(`sources.yaml: ${s.id} uses unknown adapter "${s.adapter}"`);
    }
  } catch (error) {
    errors.push(`sources.yaml: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const manual = loadManual();
    for (const file of MANUAL_ALIAS_FILES) {
      const doc =
        parseDocument(fs.readFileSync(path.join(paths.manual, file), 'utf8')).toJS() ?? {};
      const keys = Object.keys(doc as object);
      const sorted = [...keys].sort((a, b) => a.localeCompare(b));
      if (keys.join('\n') !== sorted.join('\n'))
        errors.push(`data/manual/${file}: keys must be sorted`);
    }
    const carsFile = path.join(generatedDir('public'), 'cars.json');
    if (fs.existsSync(carsFile)) {
      const ids = new Set(
        (JSON.parse(fs.readFileSync(carsFile, 'utf8')) as { items: { id: string }[] }).items.map(
          (c) => c.id,
        ),
      );
      for (const [name, id] of Object.entries(manual.carAliases)) {
        if (!ids.has(id)) errors.push(`car-aliases.yaml: "${name}" points to unknown car id ${id}`);
      }
      for (const id of Object.keys(manual.carRarity)) {
        if (!ids.has(id)) errors.push(`car-rarity.yaml: unknown car id ${id}`);
      }
    }
  } catch (error) {
    errors.push(`data/manual: ${error instanceof Error ? error.message : String(error)}`);
  }

  const out = generatedDir('public');
  for (const [file, schema] of GENERATED) checkFile(path.join(out, file), schema, errors);
  for (const [dir, schema] of GENERATED_DIRS) {
    const full = path.join(out, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of fs.readdirSync(full)) checkFile(path.join(full, file), schema, errors);
  }
  for (const file of [
    'unmatched-cars.json',
    'unknown-values.json',
    'unparsed-requirements.json',
    'untranslated-texts.json',
  ]) {
    checkFile(path.join(reviewDir('public'), file), ReviewItem, errors);
  }

  const locales = fs.readdirSync(paths.i18n).filter((f) => f.endsWith('.json'));
  const keySets = locales.map((f) => ({
    file: f,
    keys: new Set(flattenKeys(JSON.parse(fs.readFileSync(path.join(paths.i18n, f), 'utf8')))),
  }));
  const all = new Set(keySets.flatMap((k) => [...k.keys]));
  for (const { file, keys } of keySets) {
    for (const key of all)
      if (!keys.has(key)) errors.push(`src/i18n/${file}: missing key "${key}"`);
  }

  return errors;
}
