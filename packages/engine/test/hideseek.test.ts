import { describe, expect, it } from 'vitest';
import {
  HIDE_TICKS, HNS_MAPS, MAP_H, MAP_W, Rng, autoplay, blocksMove, createSim, encodeInput, hideseek, quantize, replay, resultOf, step,
  type HnsState,
} from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };

describe('Chhupan Chhupai maps', () => {
  it('every map is 18x14, has a den, and all open ground is connected', () => {
    for (const m of HNS_MAPS) {
      expect(m.rows).toHaveLength(MAP_H);
      for (const r of m.rows) expect(r).toHaveLength(MAP_W);
      const open: [number, number][] = [];
      m.rows.forEach((r, y) => [...r].forEach((c, x) => { if (!blocksMove(c as never)) open.push([x, y]); }));
      const sy = m.rows.findIndex((r) => r.includes('S'));
      expect(sy).toBeGreaterThanOrEqual(0);
      const seen = new Set([`${m.rows[sy]!.indexOf('S')},${sy}`]);
      const q = [[m.rows[sy]!.indexOf('S'), sy]];
      while (q.length) {
        const [x, y] = q.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x! + dx!, ny = y! + dy!;
          const c = m.rows[ny]?.[nx];
          if (c && !blocksMove(c as never) && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); q.push([nx, ny]); }
        }
      }
      expect(seen.size, m.id).toBe(open.length);
    }
  });
});

describe('real-time simulation', () => {
  it('is deterministic: the same inputs give the same result', () => {
    const inputs = Array.from({ length: 600 }, (_, i) => encodeInput((i * 7) % 33)).join('');
    expect(replay(42, 'hider', 30, 'medium', inputs)).toEqual(replay(42, 'hider', 30, 'medium', inputs));
  });

  it('an AI-played round replays to exactly the same score (server verification)', () => {
    for (const role of ['hider', 'seeker'] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const a = autoplay(seed * 977, role, 40, 'medium', 'hard');
        expect(replay(seed * 977, role, 40, 'medium', a.inputs)).toEqual(a.result);
      }
    }
  });

  it('the seeker cannot move while counting', () => {
    const s = createSim(5, 'seeker', 30, 'medium');
    const x0 = s.agents[0]!.x;
    for (let i = 0; i < HIDE_TICKS - 1; i++) step(s, 1);
    expect(s.agents[0]!.x).toBe(x0);
    for (let i = 0; i < 10; i++) step(s, 1);
    expect(s.agents[0]!.x).not.toBe(x0);
  });

  it('characters never walk into walls or off the map', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = createSim(seed, 'hider', 30, 'hard');
      const rng = new Rng(seed);
      while (!s.over) {
        step(s, rng.int(33));
        for (const a of s.agents) {
          expect(a.x > 0 && a.y > 0 && a.x < MAP_W && a.y < MAP_H).toBe(true);
          const c = HNS_MAPS[s.mapIndex]!.rows[Math.floor(a.y)]![Math.floor(a.x)];
          expect(blocksMove(c as never)).toBe(false);
        }
      }
    }
  });

  it('a good AI seeker catches hiders; standing still as seeker catches nobody', () => {
    let caught = 0;
    for (let seed = 1; seed <= 8; seed++) caught += autoplay(seed, 'seeker', 60, 'medium', 'hard').result.caught;
    expect(caught).toBeGreaterThan(8);
    const idle = replay(3, 'seeker', 30, 'medium', '');
    expect(idle!.caught).toBeLessThanOrEqual(1);
  });

  it('rejects malformed or too-long inputs', () => {
    expect(replay(1, 'hider', 20, 'easy', 'Z')).toBeNull();
    expect(replay(1, 'hider', 20, 'easy', '\u0000')).toBeNull();
    expect(replay(1, 'hider', 20, 'easy', '0'.repeat(20 * 20 + 1))).toBeNull();
  });

  it('quantize maps a direction to the nearest of 16 codes', () => {
    expect(quantize(1, 0)).toBe(1);
    expect(quantize(0, -1)).toBe(13);
    expect(quantize(0, 0)).toBe(0);
    expect(quantize(-1, 0, true)).toBe(9 + 16);
  });

  it('hider scores: survival, marbles, rescues and a survive bonus', () => {
    const s = createSim(9, 'hider', 20, 'easy');
    while (!s.over) step(s, 0);
    const r = resultOf(s);
    expect(r.role).toBe('hider');
    expect(r.score).toBe(Math.round(r.survivedSeconds * 2) + r.marbles * 10 + r.rescues * 40 + (r.wasCaught ? 0 : 100));
  });
});

describe('party flow', () => {
  function start(n = 3): HnsState {
    return hideseek.createGame(hideseek.sanitizeConfig({ rounds: 2, roundSeconds: 20 }, 3), players(n, false), new Rng(4), ctx);
  }

  it('everyone plays every round; roles alternate hider then seeker', () => {
    let s = start(3);
    expect(s.rounds[0]!.role).toBe('hider');
    for (const p of s.players) {
      const r = hideseek.applyAction(s, p.id, { type: 'submit', inputs: '' }, ctx);
      expect(r.ok).toBe(true);
      s = (r as { state: HnsState }).state;
    }
    expect(s.phase).toBe('results');
    for (const p of s.players) s = (hideseek.applyAction(s, p.id, { type: 'ack' }, ctx) as { state: HnsState }).state;
    expect(s.round).toBe(2);
    expect(s.rounds[1]!.role).toBe('seeker');
  });

  it('scores come from the replay, not from the client', () => {
    let s = start(2);
    const r = hideseek.applyAction(s, 'p0', { type: 'submit', inputs: '' }, ctx);
    s = (r as { state: HnsState }).state;
    const expected = replay(s.rounds[0]!.seed, 'hider', 20, 'medium', '')!;
    expect(s.results[0]!.p0).toEqual(expected);
    expect(hideseek.applyAction(s, 'p0', { type: 'submit', inputs: '' }, ctx).ok).toBe(false); // only once
    expect(hideseek.applyAction(s, 'p1', { type: 'submit', inputs: 'ÿ' }, ctx).ok).toBe(false);
  });

  it('others’ scores are hidden until everyone has played the round', () => {
    let s = start(2);
    s = (hideseek.applyAction(s, 'p0', { type: 'submit', inputs: '' }, ctx) as { state: HnsState }).state;
    const v = hideseek.getPlayerView(s, 'p1');
    expect(v.results).toEqual([]);
    expect(v.done).toEqual(['p0']);
    expect(v.myResult).toBeNull();
    expect(hideseek.getPlayerView(s, 'p0').myResult).not.toBeNull();
  });

  it('timeouts let a bot finish rounds for absent players', () => {
    let s = hideseek.createGame(hideseek.sanitizeConfig({ rounds: 1, roundSeconds: 20, submitGraceSeconds: 30 }, 2), players(2), new Rng(4), ctx);
    s = hideseek.onTimeout(s, { now: T0 + 1e6 });
    expect(s.phase).toBe('results');
    s = hideseek.onTimeout(s, { now: T0 + 2e6 });
    expect(s.over).toBe(true);
  });
});

describe('bots', () => {
  it('different bots play the same level differently', () => {
    const a = autoplay(77, 'hider', 30, 'medium', 'medium', 'bot-a');
    const b = autoplay(77, 'hider', 30, 'medium', 'medium', 'bot-b');
    expect(a.inputs).not.toEqual(b.inputs);
    expect(replay(77, 'hider', 30, 'medium', a.inputs)).toEqual(a.result);
  });
});
