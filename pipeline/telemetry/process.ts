import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../paths';
import { Track } from '../schema/entities';
import { measureRoute } from './geometry';
import { oneLap, readRecording, splitRuns } from './packet';
import { loadRoutes, recognise } from './routes';

/**
 * Turns the raw recordings in .cache/telemetry into one file per route in data/tracks
 * (ADR-0021), then deletes the recordings (owner: no piling up raw data).
 *
 *   pnpm telemetry:process                        every recording
 *   pnpm telemetry:process -- --route=<route id>  name the races the shapes could not place
 *   pnpm telemetry:process -- --keep              keep the raw files
 */
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [k, v];
    }),
);
const RAW = path.join(ROOT, '.cache', 'telemetry');
const OUT = path.join(ROOT, 'data', 'tracks');
const today = new Date().toISOString().slice(0, 10);

const routes = await loadRoutes();
const byId = new Map(routes.map((r) => [r.id, r]));
const forced = args.route ? byId.get(args.route) : undefined;
if (args.route && !forced) {
  console.error(`✗ unknown route "${args.route}" (labsgg list or data/manual/routes.yaml)`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => f.endsWith('.bin')) : [];
if (files.length === 0) console.log('No recordings in .cache/telemetry.');
for (const file of files) {
  const runs = splitRuns(readRecording(path.join(RAW, file)));
  console.log(`\n${file}: ${runs.length} races`);
  let unplaced = 0;
  for (const [i, run] of runs.entries()) {
    const found = recognise(run, routes);
    const route = found.route ?? forced;
    const label = `  #${i + 1}`;
    if (!route) {
      unplaced++;
      console.log(
        `${label} not recognised (best: ${found.runnerUp ? '' : ''}score ${found.score}) — run again with --route=<id>`,
      );
      continue;
    }
    if (!route.surface) {
      unplaced++;
      console.log(`${label} ${route.name}: surface unknown — add it to data/manual/routes.yaml`);
      continue;
    }
    const { samples, laps } = oneLap(run);
    const measured = measureRoute(samples);
    const target = path.join(OUT, `${route.id}.json`);
    const previous = fs.existsSync(target)
      ? (JSON.parse(fs.readFileSync(target, 'utf8')) as Track)
      : undefined;
    const track = Track.parse({
      id: route.id,
      name: route.name,
      surface: route.surface,
      kind: route.kind === 'circuit' || laps > 1 ? 'circuit' : 'sprint',
      laps: route.laps ?? (laps > 1 ? laps : undefined),
      recordings: (previous?.recordings ?? 0) + 1,
      updatedAt: today,
      ...measured,
    });
    fs.writeFileSync(target, `${JSON.stringify(track, null, 1)}\n`);
    console.log(
      `${label} ${route.name} (${found.route ? `score ${found.score}` : 'named'}): ` +
        `${(track.lengthM / 1000).toFixed(2)} km · ${track.turns.length} turns · ` +
        `${track.stats.elevationMin}–${track.stats.elevationMax} m · ${track.jumps.length} jumps`,
    );
  }
  if (unplaced === 0 && args.keep !== 'true') {
    fs.rmSync(path.join(RAW, file));
    console.log(`  raw recording deleted`);
  } else if (unplaced) console.log(`  raw recording kept (${unplaced} races not placed)`);
}
