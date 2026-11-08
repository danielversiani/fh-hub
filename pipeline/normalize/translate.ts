import type { Localized } from '../schema/entities';

const HAN = /\p{Script=Han}/u;

/**
 * Translates source text written in another language (Noa Miyako's notes are in Chinese) using
 * the translation memory in data/manual/translations.yaml (ADR-0014).
 * - Text without Chinese characters is shown as written (both languages).
 * - Text that is only lap times ("白川1:04.3") needs no words: the site shows those as chips.
 * - Anything else not in the memory returns `undefined`: the caller hides it and lists it for
 *   translation (data/review/untranslated-texts.json). The site never shows untranslated Chinese.
 */
export function translator(
  memory: Readonly<Record<string, Localized>>,
  stripLapRefs: (text: string) => string = (text) => text,
) {
  return (text: string | undefined): Localized | undefined => {
    if (!text) return undefined;
    if (!HAN.test(text)) return { 'pt-br': text, en: text };
    const known = memory[text];
    if (known) return known;
    if (!HAN.test(stripLapRefs(text))) return { 'pt-br': '', en: '' };
    return undefined;
  };
}
