// Chinese/Japanese/Korean characters (e.g. the bilingual brand names in Noa Miyako's sheet).
// Written with Unicode property escapes so the source stays plain ASCII.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
// Combining marks left over after NFKD (accents).
const COMBINING_MARKS = /\p{M}/gu;

/** Collapses whitespace and trims. Returns '' for undefined. */
export const cleanText = (value: string | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Canonical form used to compare names across sources:
 * lowercase, no accents, no CJK, no apostrophes, punctuation turned into single spaces.
 */
export function normalizeName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(CJK, ' ')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['‘’`´"“”]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const slugify = (input: string): string => normalizeName(input).replace(/ /g, '-');
