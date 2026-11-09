import type { Dataset } from '../build/dataset';
import { slugify } from '../lib/text';
import type { CarRole, Tune } from '../schema/entities';

/**
 * "Cérebro desligado" (brain AFK, ADR-0018): tunes so strong and easy that they need no thinking.
 * The label is a nudge towards more challenging, fun picks (the site's philosophy).
 * - automatic: the tune the meta table recommends and calls easy, on a car the platform ranks Meta+
 *   in that class × surface;
 * - by hand: data/manual/brain-afk.yaml marks tunes (or removes an automatic mark).
 */
export function markBrainAfk(
  tunes: readonly Tune[],
  roles: readonly CarRole[],
  dataset: Pick<Dataset, 'brainAfk'>,
): Tune[] {
  const top = new Set(
    roles.filter((r) => r.tier === 'meta-plus').map((r) => `${r.carId}|${r.class}|${r.surface}`),
  );
  return tunes.map((t) => {
    const rule = [...dataset.brainAfk]
      .reverse()
      .find(
        (r) =>
          r.carId === t.carId &&
          (!r.class || r.class === t.class) &&
          (!r.surface || r.surface === t.surface) &&
          (!r.tuner || slugify(r.tuner) === t.tunerId),
      );
    const auto =
      t.difficulty === 'easy' &&
      Boolean(t.credited) &&
      top.has(`${t.carId}|${t.class ?? ''}|${t.surface ?? ''}`);
    const brainAfk = rule ? (rule.brainAfk ? 'curator' : undefined) : auto ? 'auto' : undefined;
    const next: Tune = { ...t, brainAfk };
    if (!brainAfk) delete next.brainAfk;
    return next;
  });
}
