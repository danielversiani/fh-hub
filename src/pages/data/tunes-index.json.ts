import type { APIRoute } from 'astro';
import { loadTuneIndex, maps } from '../../lib/data';

/**
 * Compact tune index for the search island (src/islands/TuneSearch.tsx), built once for both
 * locales. Rows are arrays to keep the file small; see `TuneRow` in the island for the order.
 */
export const GET: APIRoute = () => {
  const { cars, tuners } = maps();
  const rows = loadTuneIndex().map((t) => [
    t.id,
    t.shareCode ?? '',
    t.carId,
    cars.get(t.carId)?.displayName ?? t.carId,
    t.tunerId,
    tuners.get(t.tunerId)?.displayName ?? t.tunerId,
    t.name,
    t.class ?? '',
    t.surface ?? '',
    (t.categories ?? []).join(','),
    Math.round((t.score ?? 0) * 100),
  ]);
  return new Response(JSON.stringify(rows), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
