import type { EventPickKind, RawEventPick } from '../adapters/types';
import { normalizeName } from '../lib/text';
import type { EventPick, PlaylistEvent } from '../schema/entities';

/** forza.net's event types for each kind of pick. */
const TYPE: Readonly<Record<EventPickKind, RegExp>> = {
  championship: /championship/i,
  trial: /the trial/i,
  'weekly-challenge': /weekly challenge/i,
  'time-attack': /time attack/i,
  'speed-trap': /speed trap/i,
  'speed-zone': /speed zone/i,
  'drift-zone': /drift zone/i,
  'danger-sign': /danger sign/i,
  drag: /drag/i,
  trailblazer: /trailblazer/i,
};

const words = (text: string) =>
  new Set(
    normalizeName(text)
      .split(' ')
      .filter((w) => w.length > 2),
  );
const overlap = (a: string, b: string) => {
  const wa = words(a);
  return [...words(b)].filter((w) => wa.has(w)).length;
};

export interface ResolvedPick {
  sourceId: string;
  pick: RawEventPick;
  carId: string;
  tunerId?: string;
}

/**
 * Finds the forza.net event each pick is for: same week, same kind of event, the car allowed by
 * the event's rules; the name breaks ties (sheets spell names their own way, or in Chinese).
 * Returns the picks it could place and the ones it could not (for review).
 */
export function placeEventPicks(
  picks: readonly ResolvedPick[],
  events: readonly PlaylistEvent[],
  tuneIdByCode: ReadonlyMap<string, string>,
): { placed: EventPick[]; unplaced: ResolvedPick[] } {
  const placed = new Map<string, EventPick>();
  const unplaced: ResolvedPick[] = [];
  for (const p of picks) {
    const seasonId = `s${String(p.pick.series).padStart(2, '0')}-${p.pick.season}`;
    const sameKind = events.filter(
      (e) => e.seasonId === seasonId && TYPE[p.pick.kind].test(e.type),
    );
    const eligible = sameKind.filter(
      (e) => !e.requirement.carIds?.length || e.requirement.carIds.includes(p.carId),
    );
    // Our reading of the rules can miss cars ("Evo vs Impreza"): with a single event of that
    // kind in the week, the sheet's author is trusted.
    const candidates = eligible.length === 0 && sameKind.length === 1 ? sameKind : eligible;
    const best = [...candidates].sort(
      (a, b) => overlap(b.name, p.pick.eventName) - overlap(a.name, p.pick.eventName),
    );
    const event =
      best.length === 1 ||
      (best.length > 1 &&
        overlap(best[0]!.name, p.pick.eventName) > overlap(best[1]!.name, p.pick.eventName))
        ? best[0]
        : undefined;
    if (!event) {
      unplaced.push(p);
      continue;
    }
    const code =
      p.pick.shareCode && /^\d{9}$/.test(p.pick.shareCode) ? p.pick.shareCode : undefined;
    const key = `${event.id}|${p.sourceId}|${p.carId}|${code ?? p.tunerId ?? ''}`;
    if (placed.has(key)) continue;
    placed.set(key, {
      eventId: event.id,
      seasonId: event.seasonId,
      sourceId: p.sourceId,
      carId: p.carId,
      tunerId: p.tunerId,
      shareCode: code,
      tuneId: code ? tuneIdByCode.get(code) : undefined,
      tuneName: p.pick.tuneName,
      row: p.pick.row,
    });
  }
  return {
    placed: [...placed.values()].sort(
      (a, b) =>
        a.seasonId.localeCompare(b.seasonId) ||
        a.eventId.localeCompare(b.eventId) ||
        a.sourceId.localeCompare(b.sourceId) ||
        a.row - b.row,
    ),
    unplaced,
  };
}
