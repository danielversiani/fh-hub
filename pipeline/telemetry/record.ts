import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Records the game's "Data Out" telemetry (UDP), as forwarded by SimHub, to a raw file per run,
 * so the track tools can be built from real data (owner, 2026-11-14). Nothing is sent anywhere:
 * the packets come from the owner's own game on the same PC.
 *
 *   pnpm telemetry:record -- --name=ford-runner-river-descent [--port=5301]
 *
 * File: .cache/telemetry/<name>-<time>.bin — per packet: float64 time (ms since start),
 * uint16 length, then the packet bytes. Ctrl+C stops and saves.
 */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = ''] = a.slice(2).split('=');
      return [k, v];
    }),
);
const port = Number(args.port || 5301);
const name = (args.name || 'run').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
const dir = path.join(process.cwd(), '.cache', 'telemetry');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.bin`);
const out = fs.createWriteStream(file);

const start = performance.now();
let packets = 0;
const sizes = new Map<number, number>();
let last: Buffer | undefined;

const socket = dgram.createSocket('udp4');
socket.on('message', (msg) => {
  const head = Buffer.alloc(10);
  head.writeDoubleLE(performance.now() - start, 0);
  head.writeUInt16LE(msg.length, 8);
  out.write(head);
  out.write(msg);
  packets++;
  sizes.set(msg.length, (sizes.get(msg.length) ?? 0) + 1);
  last = msg;
});
socket.on('error', (err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
socket.bind(port, () =>
  console.log(`Listening on UDP ${port}. Saving to ${file}\nCtrl+C to stop.`),
);

/** Forza Horizon 4/5 "Dash" layout (324 bytes): a quick sign that the data makes sense. */
function peek(msg: Buffer): string {
  if (msg.length < 268) return `${msg.length} bytes`;
  const raceOn = msg.readInt32LE(0);
  const x = msg.readFloatLE(244);
  const y = msg.readFloatLE(248);
  const z = msg.readFloatLE(252);
  const kmh = msg.readFloatLE(256) * 3.6;
  return `${msg.length} bytes · race ${raceOn ? 'on' : 'off'} · ${kmh.toFixed(0)} km/h · x ${x.toFixed(1)} y ${y.toFixed(1)} z ${z.toFixed(1)}`;
}

const timer = setInterval(() => {
  const secs = (performance.now() - start) / 1000;
  console.log(
    `${secs.toFixed(0).padStart(4)} s · ${packets} packets` +
      (last ? ` · last: ${peek(last)}` : ' · waiting for data…'),
  );
}, 2000);

process.on('SIGINT', () => {
  clearInterval(timer);
  socket.close();
  out.end(() => {
    console.log(`\nSaved ${packets} packets to ${file}`);
    console.log(
      `Packet sizes: ${[...sizes].map(([s, n]) => `${s} bytes × ${n}`).join(', ') || 'none'}`,
    );
    process.exit(0);
  });
});
