/** Mulberry32 — deterministic, tiny, good enough for a game. */
export function rand(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let x = next;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  const n = (x ^ (x >>> 14)) >>> 0;
  return [next, n / 4294967296];
}

export function pick<T>(state: number, arr: T[]): [number, T] {
  const [s, r] = rand(state);
  if (arr.length === 0) return [s, arr[0]];
  return [s, arr[Math.floor(r * arr.length) % arr.length]];
}
