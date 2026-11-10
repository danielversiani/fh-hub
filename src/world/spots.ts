/**
 * Where each page sits in the world (ADR-0019). Shared by the page layout (static image in
 * normal mode) and the world client (camera in track mode); no 3D code here.
 */
export type SpotName = 'home' | 'tunes' | 'tuners' | 'car' | 'meta' | 'playlist' | 'stands';

export const SPOT_NAMES: readonly SpotName[] = [
  'home',
  'tunes',
  'tuners',
  'car',
  'meta',
  'playlist',
  'stands',
];

/** The page's place, from its path (with or without the /en prefix). */
export function spotFor(pathname: string): SpotName {
  const p = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  if (p === '/') return 'home';
  if (p.startsWith('/tunes')) return 'tunes';
  if (p.startsWith('/tuners')) return 'tuners';
  if (p.startsWith('/cars')) return 'car';
  if (p.startsWith('/meta')) return 'meta';
  if (p.startsWith('/playlist')) return 'playlist';
  return 'stands';
}
