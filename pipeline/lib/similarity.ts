function bigrams(value: string): Map<string, number> {
  const compact = value.replace(/ /g, '');
  const result = new Map<string, number>();
  for (let i = 0; i < compact.length - 1; i++) {
    const pair = compact.slice(i, i + 2);
    result.set(pair, (result.get(pair) ?? 0) + 1);
  }
  return result;
}

const total = (m: Map<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

/** Sørensen–Dice coefficient over character bigrams (0 = nothing in common, 1 = identical). */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  const size = total(A) + total(B);
  if (size === 0) return 0;
  let shared = 0;
  for (const [pair, n] of A) shared += Math.min(n, B.get(pair) ?? 0);
  return (2 * shared) / size;
}
