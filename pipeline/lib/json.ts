import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}

/** Deterministic JSON: sorted keys, undefined dropped, 2-space indent, trailing newline (DATA_MODEL §5). */
export const stableStringify = (value: unknown): string =>
  `${JSON.stringify(sortKeys(value), null, 2)}\n`;

export const shortHash = (value: string): string =>
  createHash('sha1').update(value).digest('hex').slice(0, 10);

export function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeFileEnsuringDir(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
