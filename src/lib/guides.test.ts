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

/** Every `<tune-picks …>` of a guide, as written (attributes in order). */
const boxes = (locale: string, slug: string) =>
  [
    ...fs
      .readFileSync(path.join(DIR, locale, `${slug}.md`), 'utf8')
      .matchAll(/<tune-picks\b([^>]*)>/g),
  ].map((m) => m[1]!.trim());

describe('guides (ADR-0024)', () => {
  it('both languages have the same tune boxes, and every pinned tune is in the catalogue', () => {
    for (const { slug } of read('pt-br')) {
      const pt = boxes('pt-br', slug);
      expect(boxes('en', slug)).toEqual(pt);
      for (const box of pt) {
        const car = /car="([^"]+)"/.exec(box)?.[1];
        const pins = /pick="([^"]+)"/.exec(box)?.[1]?.split(',') ?? [];
        if (!pins.length) continue;
        const file = path.resolve('data/generated/tunes/by-car', `${car}.json`);
        const ids = new Set(
          (JSON.parse(fs.readFileSync(file, 'utf8')) as { items: { id: string }[] }).items.map(
            (t) => t.id,
          ),
        );
        // A sync can rename a tune: the box then skips the pin, and this test says which one.
        for (const pin of pins) expect(ids.has(pin.trim()), `${slug}: ${car} ${pin}`).toBe(true);
      }
    }
  });

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
