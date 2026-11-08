import type { LapRef } from '../schema/entities';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "1:04.3", "59.9", "04.8": optional minutes, seconds, 1–3 decimals. */
const TIME = String.raw`((?:\d{1,2}:)?\d{1,2}\.\d{1,3})`;

/**
 * Finds lap times quoted in free-text notes, e.g. Noa Miyako's "白川1:04.3 稳定好开" or
 * "地平线攀爬赛世界纪录 59.9", and names the track in English via the alias list
 * (data/manual/track-aliases.yaml). Text that is not a known track is ignored, so a note like
 * "倒转19.7" (a reversed lap) does not become a wrong reference.
 */
export function lapRefParser(aliases: Readonly<Record<string, string>>) {
  // Longest names first, so "高速公路环道" wins over "高速公路".
  const names = Object.keys(aliases).sort((a, b) => b.length - a.length || a.localeCompare(b));
  if (names.length === 0) return (): LapRef[] => [];
  const pattern = new RegExp(
    String.raw`(${names.map(escapeRegExp).join('|')})\s*(世界纪录|WR)?\s*` + TIME,
    'gu',
  );
  return (notes: string | undefined): LapRef[] => {
    const refs: LapRef[] = [];
    const seen = new Set<string>();
    for (const match of (notes ?? '').matchAll(pattern)) {
      const track = aliases[match[1]!]!;
      let time = match[3]!;
      // "向日葵04.8": the minute is left out when the context makes it obvious (1:04.8).
      if (/^0\d\./.test(time)) time = `1:${time}`;
      const key = `${track}|${time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(match[2] ? { track, time, worldRecord: true } : { track, time });
    }
    return refs;
  };
}
