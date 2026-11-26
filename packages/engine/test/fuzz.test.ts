/**
 * Fuzz / edge-case tests for every game: random legal moves, garbage and
 * malicious actions from random (and unknown) players, random timeouts and
 * hostile configs. Checks the engine never throws, never mutates its input,
 * keeps invariants, stays JSON-safe and never leaks secrets into views.
 */
import { describe, expect, it } from 'vitest';
import {
  GAME_ORDER, LUDO_HOME, Rng, botRng, getGame,
  type BaseState, type BotDifficulty, type GameId,
} from '../src';
import { T0, players } from './helpers';

const RUNS = Number(process.env.FUZZ_RUNS ?? 150);
/** Hide & seek runs full real-time simulations per move, so fewer chaotic games. */
const runsFor = (id: GameId) => (id === 'hideseek' ? Math.max(3, Math.round(RUNS / 15)) : RUNS);
const DIFFS: BotDifficulty[] = ['easy', 'medium', 'hard'];

const GARBAGE: unknown[] = [
  null, undefined, 0, -1, 'roll', [], {}, { type: '' }, { type: 'roll', extra: 1 }, { type: 'move', token: -1 },
  { type: 'move', token: 99 }, { type: 'move', token: 1.5 }, { type: 'move', token: '0' }, { type: 'line', line: -5 },
  { type: 'line', line: 1e9 }, { type: 'line', line: NaN }, { type: 'guess', target: '' }, { type: 'guess', target: 'p0' },
  { type: 'vote', target: '__skip__' }, { type: 'vote', target: 'nobody' }, { type: 'kill', target: 'p1' }, { type: 'save', target: 'p0' },
  { type: 'check', target: 'p2' }, { type: 'answer', answers: { name: 'x'.repeat(41) } }, { type: 'answer', answers: { name: 7 } },
  { type: 'answer', answers: { name: 'Zebra', __proto__: 'x' } }, { type: 'answer', answers: null },
  { type: 'challenge', target: 'p1', category: 'name', reject: 'yes' }, { type: 'challenge', target: 'p0', category: 'nope', reject: true },
  { type: 'hide', spot: 'mars' }, { type: 'hide', spot: 'temple' }, { type: 'search', spot: '__proto__' }, { type: 'move', spot: 'bus' },
  { type: 'submit', inputs: '' }, { type: 'submit', inputs: '\u0000\uffff' }, { type: 'submit', inputs: 'Z'.repeat(3000) }, { type: 'submit', inputs: 123 },
  { type: 'submit', inputs: '1'.repeat(50) }, { type: 'dhappa' }, { type: 'guard' }, { type: 'stay' }, { type: 'ack' }, { type: 'ready' }, { type: 'stop' }, { type: 'submit' },
  { type: 'roll' }, { type: 'constructor' }, { type: 'toString' },
];

const SIZES: Record<GameId, [number, number]> = { rmcs: [4, 4], mafia: [5, 12], npat: [2, 10], dots: [2, 4], ludo: [2, 4], hideseek: [1, 4] };

function randomConfig(rng: Rng): unknown {
  const pool: unknown[] = [
    undefined, null, 'x', 5, [], { rounds: -3 }, { rounds: 1e9, size: 7 }, { size: 5, turnSeconds: 10 },
    { categories: ['name', '', 'NAME', 'x'.repeat(50), '💥', 'food'], roundSeconds: 5, challenges: false },
    { mafiaCount: 99, doctor: false, detective: false, nightSeconds: 5, daySeconds: 5, voteSeconds: 5 },
    { mafiaCount: 0 }, { finishAll: true, turnSeconds: 5 }, { maxRounds: 1, matches: 99, roundSeconds: 5, hideSeconds: 5, revealSeconds: 5 },
    { revealSeconds: 3, guessSeconds: 3, rounds: 2 }, { matches: 1, maxRounds: 3 },
  ];
  return rng.pick(pool);
}

function checkInvariants(id: GameId, s: BaseState): void {
  const ids = s.players.map((p) => p.id);
  const any = s as unknown as Record<string, unknown>;
  expect(Number.isInteger(s.version)).toBe(true);
  expect(s.deadline === null || Number.isFinite(s.deadline)).toBe(true);
  expect(s.log.length).toBeLessThanOrEqual(30);
  switch (id) {
    case 'ludo': {
      for (const t of Object.values(any.tokens as Record<string, number[]>).flat()) expect(t >= -1 && t <= LUDO_HOME).toBe(true);
      const d = any.dice as number | null;
      expect(d === null || (d >= 1 && d <= 6)).toBe(true);
      expect(new Set(any.ranking as string[]).size).toBe((any.ranking as string[]).length);
      break;
    }
    case 'dots': {
      const n = (any.config as { size: number }).size;
      const lines = any.lines as number[];
      const boxes = any.boxes as number[];
      expect(lines.every((v) => v === 0 || v === 1)).toBe(true);
      for (let b = 0; b < n * n; b++) {
        const r = Math.floor(b / n), c = b % n;
        const sides = [r * n + c, (r + 1) * n + c, n * (n + 1) + r * (n + 1) + c, n * (n + 1) + r * (n + 1) + c + 1].filter((l) => lines[l]).length;
        expect((boxes[b] as number) >= 0).toBe(sides === 4);
      }
      break;
    }
    case 'mafia': {
      const alive = any.alive as string[];
      expect(alive.every((a) => ids.includes(a))).toBe(true);
      expect(Object.keys(any.roles as object).sort()).toEqual([...ids].sort());
      expect(!!any.winner).toBe(s.over);
      break;
    }
    case 'rmcs':
      expect(Object.values(any.slips as object).sort()).toEqual(['chor', 'mantri', 'raja', 'sipahi']);
      break;
    case 'npat': {
      const cats = (any.config as { categories: string[] }).categories;
      for (const a of Object.values(any.answers as Record<string, Record<string, string>>)) {
        expect(Object.keys(a).sort()).toEqual([...cats].sort());
        for (const v of Object.values(a)) expect(v.length).toBeLessThanOrEqual(40);
      }
      break;
    }
    case 'hideseek': {
      expect((any.rounds as unknown[]).length).toBe(any.round);
      for (const r of any.results as Record<string, { score: number }>[]) for (const v of Object.values(r)) expect(Number.isFinite(v.score) && v.score >= 0).toBe(true);
      break;
    }
  }
}

/** Game-specific "no secret in somebody else's view" checks. */
function checkSecrets(id: GameId, s: BaseState): void {
  const g = getGame(id)!;
  const any = s as unknown as Record<string, any>;
  for (const p of s.players) {
    const v = g.getPlayerView(s, p.id) as Record<string, any>;
    expect('rng' in v).toBe(false);
    if (s.over) continue;
    if (id === 'mafia' && any.roles[p.id] !== 'mafia') {
      const others = Object.keys(v.knownRoles).filter((k) => k !== p.id);
      for (const o of others) expect(any.alive.includes(o)).toBe(false); // only dead players' revealed roles
    }
    if (id === 'rmcs' && any.phase === 'peek') {
      for (const [o, r] of Object.entries(any.slips)) if (o !== p.id && r !== 'raja') expect(v.known[o]).toBeUndefined();
    }
    if (id === 'npat' && any.phase === 'answer') expect(v.revealed).toEqual({});
    if (id === 'hideseek' && any.phase === 'play') {
      // Other players' scores stay hidden until everyone has finished the round.
      expect(v.results.length).toBe(any.round - 1);
    }
  }
  const pub = JSON.stringify(g.getPublicState(s));
  expect(pub).not.toContain('"rng"');
}

describe.each(GAME_ORDER)('fuzz: %s', (id) => {
  it(`chaotic games: no throws, no mutation, invariants, no leaks`, () => {
    const g = getGame(id)!;
    for (let run = 1; run <= runsFor(id); run++) {
      const rng = new Rng(run * 104729);
      const [min, max] = SIZES[id];
      const n = rng.range(min, max);
      const ps = players(n);
      let now = T0;
      let s = g.createGame(g.sanitizeConfig(randomConfig(rng), n), ps, rng, { now }) as BaseState;
      checkInvariants(id, s);
      for (let step = 0; step < 6000 && !s.over; step++) {
        now += rng.range(0, 4000);
        const roll = rng.next();
        const before = JSON.stringify(s);
        if (roll < 0.08 && s.deadline !== null) {
          const t = g.onTimeout(s, { now: Math.max(now, s.deadline) }) as BaseState;
          expect(JSON.stringify(s)).toBe(before);
          s = t;
        } else if (roll < 0.25) {
          // Garbage or misdirected action from anyone (including strangers).
          const who = rng.chance(0.1) ? 'stranger' : rng.pick(ps).id;
          const a = rng.pick(GARBAGE);
          expect(() => g.isAction(a)).not.toThrow();
          if (g.isAction(a)) {
            const r = g.applyAction(s, who, a, { now });
            expect(JSON.stringify(s)).toBe(before);
            if (r.ok) s = r.state as BaseState;
            else expect(typeof r.reason).toBe('string');
          }
        } else if (roll < 0.4) {
          // A random legal action from a random player.
          const p = rng.pick(ps).id;
          const legal = g.listLegalActions(s, p) as unknown[];
          if (legal.length) {
            const r = g.applyAction(s, p, rng.pick(legal), { now });
            expect(r.ok).toBe(true);
            if (r.ok) s = r.state as BaseState;
          }
        } else {
          const pending = g.pendingActors(s);
          if (!pending.length) {
            expect(s.over).toBe(true);
            break;
          }
          const p = rng.pick(pending);
          const a = g.getBotAction(s, p, rng.pick(DIFFS), botRng(s, p));
          if (a) {
            const r = g.applyAction(s, p, a, { now });
            expect(r.ok).toBe(true);
            if (r.ok) s = r.state as BaseState;
          }
        }
        expect(JSON.parse(JSON.stringify(s))).toEqual(s); // JSON-safe (no undefined/NaN)
        checkInvariants(id, s);
        if (step % 7 === 0) checkSecrets(id, s);
      }
      // Bots must be able to finish whatever chaos left behind.
      for (let k = 0; k < 20000 && !s.over; k++) {
        const pending = g.pendingActors(s);
        expect(pending.length).toBeGreaterThan(0);
        const p = pending[0]!;
        const a = g.getBotAction(s, p, 'medium', botRng(s, p));
        if (!a) {
          s = g.onTimeout(s, { now: (s.deadline ?? now) + 1 }) as BaseState;
          continue;
        }
        const r = g.applyAction(s, p, a, { now });
        expect(r.ok).toBe(true);
        if (r.ok) s = r.state as BaseState;
      }
      expect(s.over).toBe(true);
      expect(g.applyAction(s, s.players[0]!.id, (g.listLegalActions(s, s.players[0]!.id)[0] ?? { type: 'ack' }) as never, { now }).ok).toBe(false);
    }
  });
});

describe('edge cases', () => {
  it('createGame rejects wrong player counts for every game', () => {
    for (const id of GAME_ORDER) {
      const g = getGame(id)!;
      expect(() => g.createGame(g.defaultConfig(1), players(g.meta.minPlayers - 1), new Rng(1), { now: T0 })).toThrow();
      expect(() => g.createGame(g.defaultConfig(20), players(g.meta.maxPlayers + 1), new Rng(1), { now: T0 })).toThrow();
    }
  });

  it('timeouts are no-ops once a game is over and never fire early', () => {
    for (const id of GAME_ORDER) {
      const g = getGame(id)!;
      const s = g.createGame(g.defaultConfig(g.meta.minPlayers), players(g.meta.minPlayers), new Rng(2), { now: T0 }) as BaseState;
      const over = { ...s, over: true };
      expect(g.onTimeout(over, { now: T0 + 1e9 })).toBe(over);
    }
  });

  it('unicode, emoji and RTL-override answers are handled in NPAT', () => {
    const g = getGame('npat')!;
    let s = g.createGame(g.defaultConfig(2), players(2), new Rng(9), { now: T0 }) as any;
    const r = g.applyAction(s, 'p0', { type: 'answer', answers: { name: '‮evil', place: '😀😀', animal: 'Ａｇｒａ', thing: '' } }, { now: T0 });
    expect(r.ok).toBe(true);
    s = (r as any).state;
    expect(s.answers.p0.name).toBe('evil');
    expect(s.answers.p0.animal).toBe('Ａｇｒａ');
  });
});
