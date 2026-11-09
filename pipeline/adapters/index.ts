import { attaxJohnson } from './attax-johnson';
import { fandomDrivetrain, fandomImages, fandomRarity } from './fandom-rarity';
import { fhstats } from './fhstats';
import { forzaCars } from './forza-cars';
import { forzaPlaylist } from './forza-playlist';
import { gbrOzzy } from './gbr-ozzy';
import { k1zGray } from './k1z-gray';
import { kleis } from './kleis';
import { letzeluShirakawa } from './letzelu-shirakawa';
import { logikj } from './logikj';
import { noaMiyako } from './noa-miyako';
import { rivalsSheet } from './rivals-sheet';
import type { Adapter } from './types';
import { whdUrl } from './whd-url';

/** One adapter per source (ADR-0005). The key is the `adapter` field in data/sources.yaml. */
export const ADAPTERS: Readonly<Record<string, Adapter>> = Object.fromEntries(
  [
    attaxJohnson,
    fandomDrivetrain,
    fandomImages,
    fandomRarity,
    fhstats,
    forzaCars,
    forzaPlaylist,
    gbrOzzy,
    k1zGray,
    kleis,
    letzeluShirakawa,
    logikj,
    noaMiyako,
    rivalsSheet,
    whdUrl,
  ].map((a) => [a.id, a]),
);

export function getAdapter(id: string): Adapter {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error(`unknown adapter "${id}"`);
  return adapter;
}
