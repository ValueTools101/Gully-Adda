import { describe, expect, it } from 'vitest';
import { DEN, HNS_ADJ, HNS_DIST, HNS_NEAR_DEN, HNS_SPOTS, Rng, hideseek, type HnsState } from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };
function start(n = 4, cfg: Record<string, unknown> = {}): HnsState {
  return hideseek.createGame({ ...hideseek.defaultConfig(n), ...cfg }, players(n, false), new Rng(3), ctx);
}
function act(s: HnsState, pid: string, a: Parameters<typeof hideseek.applyAction>[2]): HnsState {
  const r = hideseek.applyAction(s, pid, a, ctx);
  if (!r.ok) throw new Error(`${pid} ${JSON.stringify(a)}: ${r.reason}`);
  return r.state;
}
const seekerOf = (s: HnsState) => s.players[s.seekerIndex % s.players.length]!.id;
const hidersOf = (s: HnsState) => s.players.map((p) => p.id).filter((id) => id !== seekerOf(s));
/** Hide everyone: first hider at `spots[0]`, etc. */
function hideAll(s: HnsState, spots: string[]): HnsState {
  hidersOf(s).forEach((id, i) => (s = act(s, id, { type: 'hide', spot: spots[i % spots.length]! })));
  return s;
}

describe('Hide & Seek town', () => {
  it('every spot can reach the den, and adjacency is symmetric', () => {
    expect(HNS_SPOTS).toHaveLength(16);
    expect(HNS_NEAR_DEN.length).toBeGreaterThanOrEqual(4);
    for (const s of HNS_SPOTS) {
      expect(HNS_DIST[s.id]).toBeGreaterThanOrEqual(1);
      for (const n of HNS_ADJ[s.id]!) expect(HNS_ADJ[n]).toContain(s.id);
    }
  });
});

describe('Hide & Seek', () => {
  it('hiders see only their own spot; the seeker sees none', () => {
    const s = hideAll(start(4), ['temple', 'pond', 'well']);
    expect(s.phase).toBe('seek');
    const seeker = seekerOf(s);
    const sv = hideseek.getPlayerView(s, seeker);
    expect(sv.mySpot).toBeNull();
    expect(sv.knownSpots).toEqual({});
    const { legal: _legal, ...rest } = sv;
    expect(JSON.stringify(rest)).not.toMatch(/temple|pond|"well"/);
    const [h1, h2] = hidersOf(s);
    const v1 = hideseek.getPlayerView(s, h1!);
    expect(v1.mySpot).toBe('temple');
    expect(JSON.stringify(v1)).not.toContain('pond');
    expect(JSON.stringify(hideseek.getPlayerView(s, h2!))).not.toContain('temple');
    expect(JSON.stringify(hideseek.getPublicState(s))).not.toMatch(/temple|pond|"well"/);
  });

  it('searching a spot finds everyone hiding there', () => {
    let s = hideAll(start(4), ['shop', 'shop', 'pond']);
    const [a, b, c] = hidersOf(s);
    s = act(s, seekerOf(s), { type: 'search', spot: 'shop' });
    s = act(s, a!, { type: 'stay' });
    s = act(s, b!, { type: 'stay' });
    s = act(s, c!, { type: 'stay' });
    expect(s.status[a!]).toBe('found');
    expect(s.status[b!]).toBe('found');
    expect(s.status[c!]).toBe('hiding');
    expect(hideseek.getPlayerView(s, seekerOf(s)).knownSpots).toEqual({ [a!]: 'shop', [b!]: 'shop' });
  });

  it('sneaking leaves a public rustle clue about the zone, not the spot', () => {
    let s = hideAll(start(3), ['temple', 'pond']);
    const [a, b] = hidersOf(s);
    s = act(s, a!, { type: 'move', spot: 'banyan' });
    s = act(s, b!, { type: 'stay' });
    s = act(s, seekerOf(s), { type: 'search', spot: 'school' });
    expect(s.clues).toEqual([{ round: 1, zone: 'temple', count: 1 }]);
    const sv = hideseek.getPlayerView(s, seekerOf(s));
    const { legal: _legal, ...rest } = sv; // legal = every spot the seeker could search
    expect(JSON.stringify(rest)).not.toContain('banyan');
  });

  it('dhappa from next to the den is safe unless the seeker guards the den', () => {
    let s = hideAll(start(3), ['auto', 'cart']);
    const [a, b] = hidersOf(s);
    s = act(s, a!, { type: 'dhappa' });
    s = act(s, b!, { type: 'stay' });
    s = act(s, seekerOf(s), { type: 'search', spot: 'temple' });
    expect(s.status[a!]).toBe('safe');
    s = act(s, b!, { type: 'dhappa' });
    s = act(s, seekerOf(s), { type: 'guard' });
    expect(s.status[b!]).toBe('found');
    expect(s.searches.at(-1)!.spot).toBe(DEN);
    expect(s.phase).toBe('reveal');
  });

  it('rejects illegal moves', () => {
    const s = hideAll(start(3), ['temple', 'pond']);
    const [a] = hidersOf(s);
    expect(hideseek.applyAction(s, a!, { type: 'move', spot: 'bus' }, ctx).ok).toBe(false); // too far
    expect(hideseek.applyAction(s, a!, { type: 'dhappa' }, ctx).ok).toBe(false); // not next to den
    expect(hideseek.applyAction(s, a!, { type: 'search', spot: 'pond' }, ctx).ok).toBe(false); // not seeker
    expect(hideseek.applyAction(s, seekerOf(s), { type: 'stay' }, ctx).ok).toBe(false);
    expect(hideseek.applyAction(s, seekerOf(s), { type: 'search', spot: 'mars' }, ctx).ok).toBe(false);
  });

  it('choices stay secret until the round resolves', () => {
    let s = hideAll(start(3), ['temple', 'pond']);
    const [a] = hidersOf(s);
    s = act(s, seekerOf(s), { type: 'search', spot: 'tea' });
    const v = hideseek.getPlayerView(s, a!);
    expect(JSON.stringify(v)).not.toContain('tea');
    expect(hideseek.getPlayerView(s, seekerOf(s)).myPick).toBe('tea');
  });

  it('scores: seeker 100 per catch, safe 150, survived 100, found 10 per round survived', () => {
    let s = hideAll(start(4, { maxRounds: 3, matches: 1 }), ['shop', 'auto', 'pond']);
    const [a, b, c] = hidersOf(s);
    const seeker = seekerOf(s);
    // round 1: b runs home safely, seeker searches empty well
    s = act(s, b!, { type: 'dhappa' }); s = act(s, a!, { type: 'stay' }); s = act(s, c!, { type: 'stay' });
    s = act(s, seeker, { type: 'search', spot: 'well' });
    // round 2: nothing; round 3: a found in shop
    s = act(s, a!, { type: 'stay' }); s = act(s, c!, { type: 'stay' }); s = act(s, seeker, { type: 'search', spot: 'tea' });
    s = act(s, a!, { type: 'stay' }); s = act(s, c!, { type: 'stay' }); s = act(s, seeker, { type: 'search', spot: 'shop' });
    expect(s.phase).toBe('reveal');
    expect(s.totals[seeker]).toBe(100);
    expect(s.totals[b!]).toBe(150);
    expect(s.totals[c!]).toBe(100);
    expect(s.totals[a!]).toBe(20);
    for (const p of s.players) s = act(s, p.id, { type: 'ack' });
    expect(s.over).toBe(true);
  });

  it('the seeker rotates each match', () => {
    let s = start(3, { maxRounds: 3, matches: 2 });
    const first = seekerOf(s);
    s = hideseek.onTimeout(s, { now: T0 }); // hide
    for (let i = 0; i < 3; i++) s = hideseek.onTimeout(s, { now: T0 });
    expect(s.phase).toBe('reveal');
    s = hideseek.onTimeout(s, { now: T0 });
    expect(seekerOf(s)).not.toBe(first);
    expect(s.match).toBe(2);
  });
});
