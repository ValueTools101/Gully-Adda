/**
 * Seeded, serialisable PRNG (mulberry32). The full RNG state is a single
 * uint32 so it can live inside game state (server-only in online mode) and
 * every game is reproducible from its seed in tests.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Current internal state; store it back into game state after use. */
  get state(): number {
    return this.s;
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    if (n <= 0) throw new Error('Rng.int: n must be > 0');
    return Math.floor(this.next() * n);
  }

  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(items.length)] as T;
  }

  /** Returns a new shuffled array (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = a[i] as T;
      a[i] = a[j] as T;
      a[j] = tmp;
    }
    return a;
  }
}

/** Stable 32-bit string hash (FNV-1a), used to derive per-bot RNG streams. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Random seed from Math.random (used only when no seed is supplied). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
