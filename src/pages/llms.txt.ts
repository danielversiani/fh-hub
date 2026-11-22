import type { APIRoute } from 'astro';
import { currentSeason, loadStats, loadTrackModels } from '../lib/data';

const SITE = 'https://forzapaddock.racing';

/**
 * /llms.txt: a plain-text guide to the site for AI assistants (ADR-0022), following the
 * llmstxt.org format. Built from the same data as the pages, so the figures stay current.
 */
export const GET: APIRoute = () => {
  const stats = loadStats();
  const season = currentSeason();
  const tracks = loadTrackModels().filter((m) => m.scene.published);
  const lines = [
    '# Forza Paddock',
    '',
    '> Forza Horizon 6 fan site, in Brazilian Portuguese and English. It collects community tunes for every car (with share codes and credit to each tuner), shows the meta by class and surface together with competitive off-meta alternatives, suggests cars and tunes for the weekly Festival Playlist, and measures tracks from the game telemetry.',
    '',
    `- ${stats.tunes} tunes for ${stats.cars} cars, from ${stats.tuners} tuners; ${stats.coded} tunes have a share code (${stats.coverage}% of cars have at least one).`,
    '- Data comes from public community spreadsheets and lists, credited and linked on every page. Tuners can ask to be left out.',
    '- Fan project, not affiliated with Microsoft, Xbox Game Studios or Playground Games.',
    `- Portuguese pages are at the root (${SITE}/); English pages are under ${SITE}/en/.`,
    '',
    '## Sections',
    '',
    `- [Tunes](${SITE}/en/tunes/): every car and its tunes, searchable by car, class, surface, drivetrain and difficulty; each car has its own page at ${SITE}/en/cars/<car-id>/`,
    `- [Meta](${SITE}/en/meta/): the strongest cars by class (D to R) and surface (road, dirt, cross country), with off-meta alternatives`,
    `- [Festival Playlist](${SITE}/en/playlist/): this week's Festival Playlist events with suggested cars and tunes${season ? ` (current: ${season.seriesName}, ${season.season})` : ''}`,
    `- [Tuners](${SITE}/en/tuners/): the tuners whose tunes the site lists, each with a page of their tunes`,
    `- [Paddock Lab](${SITE}/en/lab/): prototypes, such as tracks measured from the game telemetry with a 3D model`,
    ...(tracks.length
      ? [
          '',
          '## Tracks',
          '',
          ...tracks.map((m) => `- [${m.track.name}](${SITE}/en/tracks/${m.track.id}/)`),
        ]
      : []),
    '',
    '## Optional',
    '',
    `- [Data use and credits](${SITE}/en/legal/)`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
