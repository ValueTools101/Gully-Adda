/**
 * The mohalla (township) map for Chhupan Chhupai. Pure data: positions are
 * on a 9x9 grid (the app draws it in isometric 3D). The den is at the centre.
 */
export type HnsZone = 'temple' | 'school' | 'well' | 'market';

export interface HnsSpot {
  id: string;
  x: number;
  y: number;
  zone: HnsZone;
}

export const HNS_GRID = 9;
export const HNS_DEN = { x: 4, y: 4 };

export const HNS_SPOTS: HnsSpot[] = [
  { id: 'temple', x: 1, y: 1, zone: 'temple' },
  { id: 'banyan', x: 3, y: 1, zone: 'temple' },
  { id: 'haystack', x: 1, y: 3, zone: 'temple' },
  { id: 'auto', x: 3, y: 3, zone: 'temple' },
  { id: 'tank', x: 6, y: 1, zone: 'school' },
  { id: 'school', x: 7, y: 3, zone: 'school' },
  { id: 'shop', x: 5, y: 3, zone: 'school' },
  { id: 'cycle', x: 7, y: 5, zone: 'school' },
  { id: 'well', x: 1, y: 5, zone: 'well' },
  { id: 'stairs', x: 3, y: 5, zone: 'well' },
  { id: 'cowshed', x: 1, y: 7, zone: 'well' },
  { id: 'postbox', x: 3, y: 7, zone: 'well' },
  { id: 'cart', x: 5, y: 5, zone: 'market' },
  { id: 'tea', x: 5, y: 7, zone: 'market' },
  { id: 'pond', x: 7, y: 7, zone: 'market' },
  { id: 'bus', x: 6, y: 8, zone: 'market' },
];

export const HNS_SPOT_IDS = HNS_SPOTS.map((s) => s.id);
const byId = new Map(HNS_SPOTS.map((s) => [s.id, s]));

export function hnsSpot(id: string): HnsSpot | undefined {
  return byId.get(id);
}

function cheb(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Spots you can sneak to in one round (within 2 tiles). */
export const HNS_ADJ: Record<string, string[]> = Object.fromEntries(
  HNS_SPOTS.map((s) => [s.id, HNS_SPOTS.filter((o) => o.id !== s.id && cheb(s, o) <= 2).map((o) => o.id)]),
);

/** Spots right next to the den: from here a hider can run for "dhappa!". */
export const HNS_NEAR_DEN = HNS_SPOTS.filter((s) => cheb(s, HNS_DEN) === 1).map((s) => s.id);

/** Moves needed to reach the den from each spot (1 = can dhappa now). */
export const HNS_DIST: Record<string, number> = (() => {
  const d: Record<string, number> = {};
  let frontier = HNS_NEAR_DEN.slice();
  for (const id of frontier) d[id] = 1;
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) for (const n of HNS_ADJ[id] ?? []) if (d[n] === undefined) {
      d[n] = (d[id] ?? 0) + 1;
      next.push(n);
    }
    frontier = next;
  }
  return d;
})();
