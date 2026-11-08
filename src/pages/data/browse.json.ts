import type { APIRoute } from 'astro';
import { buildBrowseData } from '../../lib/browse';
import { loadMemeCars } from '../../lib/data';

/** Data for the tune browser island (src/islands/TuneBrowser.tsx), shared by both locales. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildBrowseData(loadMemeCars())), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
