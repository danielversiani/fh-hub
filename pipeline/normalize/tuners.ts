import { cleanText, slugify } from '../lib/text';

/** Team prefixes seen in the sources (e.g. "K1Z Gray", "ESV Lawrence"). */
const KNOWN_TEAMS = new Set([
  'AMS',
  'CTE',
  'DRX',
  'ESV',
  'EXR',
  'F1R',
  'JSR',
  'K1Z',
  'MSR',
  'PTG',
  'SR1',
  'VSM',
]);

export interface TunerIdentity {
  id: string;
  displayName: string;
  team?: string;
}

/** Canonical tuner identity from a gamertag as written in a source (ADR-0006). */
export class TunerRegistry {
  private readonly aliases = new Map<string, string>();

  constructor(aliases: Readonly<Record<string, string>>) {
    for (const [variant, canonical] of Object.entries(aliases)) {
      this.aliases.set(cleanText(variant).toLowerCase(), cleanText(canonical));
    }
  }

  identify(raw: string): TunerIdentity | undefined {
    const text = cleanText(raw);
    if (!text) return undefined;
    const displayName = this.aliases.get(text.toLowerCase()) ?? text;
    const id = slugify(displayName);
    if (!id) return undefined;
    const prefix = displayName.split(' ')[0]?.toUpperCase();
    const team =
      prefix && KNOWN_TEAMS.has(prefix) && displayName.includes(' ') ? prefix : undefined;
    return { id, displayName, team };
  }
}
