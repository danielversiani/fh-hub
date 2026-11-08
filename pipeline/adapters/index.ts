import { forzaCars } from './forza-cars';
import { gbrOzzy } from './gbr-ozzy';
import { k1zGray } from './k1z-gray';
import { kleis } from './kleis';
import { letzeluShirakawa } from './letzelu-shirakawa';
import type { Adapter } from './types';
import { whdUrl } from './whd-url';

/** One adapter per source (ADR-0005). The key is the `adapter` field in data/sources.yaml. */
export const ADAPTERS: Readonly<Record<string, Adapter>> = Object.fromEntries(
  [forzaCars, gbrOzzy, k1zGray, kleis, letzeluShirakawa, whdUrl].map((a) => [a.id, a]),
);

export function getAdapter(id: string): Adapter {
  const adapter = ADAPTERS[id];
  if (!adapter) throw new Error(`unknown adapter "${id}"`);
  return adapter;
}
