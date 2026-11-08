import { fandomRarity } from './fandom-rarity';
import { forzaCars } from './forza-cars';
import { forzaPlaylist } from './forza-playlist';
import { gbrOzzy } from './gbr-ozzy';
import { k1zGray } from './k1z-gray';
import { kleis } from './kleis';
import { letzeluShirakawa } from './letzelu-shirakawa';
import { noaMiyako } from './noa-miyako';
import type { Adapter } from './types';
import { whdUrl } from './whd-url';

/** One adapter per source (ADR-0005). The key is the `adapter` field in data/sources.yaml. */
export const ADAPTERS: Readonly<Record<string, Adapter>> = Object.fromEntries(
  [
    fandomRarity,
    forzaCars,
    forzaPlaylist,
    gbrOzzy,
    k1zGray,
    kleis,
    letzeluShirakawa,
    noaMiyako,
    whdUrl,
  ].map((a) => [a.id, a]),
);

export function getAdapter(id: string): Adapter {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error(`unknown adapter "${id}"`);
  return adapter;
}
