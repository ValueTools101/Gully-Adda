import { describe, expect, it } from 'vitest';
import { LUDO_HOME, Rng, absSquare, ludo, ludoMovable, type LudoState } from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };
const start = (n = 2) => ludo.createGame(ludo.defaultConfig(n), players(n, false), new Rng(1), ctx);
function withDice(s: LudoState, d: number): LudoState {
  return { ...s, phase: 'move', dice: d };
}
function move(s: LudoState, pid: string, token: number): LudoState {
  const r = ludo.applyAction(s, pid, { type: 'move', token }, ctx);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe('Ludo', () => {
  it('2 players sit opposite each other', () => {
    expect(start(2).colours).toEqual({ p0: 0, p1: 2 });
  });

  it('needs a 6 to leave the yard', () => {
    const s = start();
    expect(ludoMovable(s, 'p0', 5)).toEqual([]);
    expect(ludoMovable(s, 'p0', 6)).toEqual([0, 1, 2, 3]);
  });

  it('a 6 gives another roll', () => {
    let s = withDice(start(), 6);
    s = move(s, 'p0', 0);
    expect(s.tokens.p0).toEqual([0, -1, -1, -1]);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('roll');
  });

  it('three sixes in a row forfeits the turn', () => {
    const s = start();
    s.sixes = 2;
    // find a seed state where the next roll is 6
    for (let seed = 0; seed < 500; seed++) {
      const t = { ...s, rng: seed };
      const r = ludo.applyAction(t, 'p0', { type: 'roll' }, ctx);
      if (r.ok && r.state.log.at(-1)?.key === 'ludo.threeSixes') {
        expect(r.state.turn).toBe(1);
        expect(r.state.sixes).toBe(0);
        return;
      }
    }
    throw new Error('no seed rolled a six');
  });

  it('captures send the token home and give a bonus roll', () => {
    let s = start(2);
    // p1 (yellow, colour 2) token sits at red's progress 10 square.
    const sq = absSquare(0, 10);
    const p1Progress = (sq - 26 + 52) % 52;
    s.tokens.p0 = [7, -1, -1, -1];
    s.tokens.p1 = [p1Progress, -1, -1, -1];
    s = move(withDice(s, 3), 'p0', 0);
    expect(s.tokens.p1![0]).toBe(-1);
    expect(s.lastMove?.captured).toEqual(['p1']);
    expect(s.turn).toBe(0);
  });

  it('no capture on safe squares', () => {
    let s = start(2);
    const sq = absSquare(0, 8); // star square
    s.tokens.p0 = [5, -1, -1, -1];
    s.tokens.p1 = [(sq - 26 + 52) % 52, -1, -1, -1];
    s = move(withDice(s, 3), 'p0', 0);
    expect(s.tokens.p1![0]).not.toBe(-1);
  });

  it('needs an exact roll to finish', () => {
    const s = start(2);
    s.tokens.p0 = [LUDO_HOME - 2, -1, -1, -1];
    expect(ludoMovable(s, 'p0', 3)).toEqual([]);
    expect(ludoMovable(s, 'p0', 2)).toEqual([0]);
  });

  it('first player home with all four tokens wins', () => {
    let s = start(2);
    s.tokens.p0 = [LUDO_HOME, LUDO_HOME, LUDO_HOME, LUDO_HOME - 4];
    s = move(withDice(s, 4), 'p0', 3);
    expect(s.over).toBe(true);
    expect(s.ranking[0]).toBe('p0');
  });

  it('dice can only be rolled by the current player in the roll phase', () => {
    const s = start(2);
    expect(ludo.applyAction(s, 'p1', { type: 'roll' }, ctx).ok).toBe(false);
    expect(ludo.applyAction(s, 'p0', { type: 'move', token: 0 }, ctx).ok).toBe(false);
  });

  it('hard bot prefers a capture', () => {
    const s = start(2);
    const sq = absSquare(0, 10);
    s.tokens.p0 = [7, 20, -1, -1];
    s.tokens.p1 = [(sq - 26 + 52) % 52, -1, -1, -1];
    const a = ludo.getBotAction(withDice(s, 3), 'p0', 'hard', new Rng(1));
    expect(a).toEqual({ type: 'move', token: 0 });
  });
});
