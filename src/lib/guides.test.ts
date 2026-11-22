import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { GuideHeader } from './guide-header';

/** The guides' headers, read straight from the files (the site imports them through Astro). */
const DIR = path.resolve('src/content/guides');
const read = (locale: string) =>
  fs
    .readdirSync(path.join(DIR, locale))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const text = fs.readFileSync(path.join(DIR, locale, f), 'utf8');
      const front = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, '\n'))?.[1] ?? '';
      return { slug: f.replace(/\.md$/, ''), header: GuideHeader.parse(parse(front)) };
    });

describe('guides (ADR-0024)', () => {
  it('every guide is in both languages, with the same order, publish state and check date', () => {
    const pt = read('pt-br');
    const en = read('en');
    expect(pt.map((g) => g.slug)).toEqual(en.map((g) => g.slug));
    pt.forEach((g, i) => {
      expect(en[i]!.header.order).toBe(g.header.order);
      expect(en[i]!.header.published).toBe(g.header.published);
      expect(en[i]!.header.verifiedAt).toBe(g.header.verifiedAt);
    });
  });
});
