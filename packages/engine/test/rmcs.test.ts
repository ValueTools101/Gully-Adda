import { describe, expect, it } from 'vitest';
import { Rng, rmcs, type RmcsState } from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };
function start(seed = 1): RmcsState {
  return rmcs.createGame(rmcs.defaultConfig(4), players(4, false), new Rng(seed), ctx);
}
function holder(s: RmcsState, role: string): string {
  return Object.entries(s.slips).find(([, r]) => r === role)![0];
}
function ackAll(s: RmcsState): RmcsState {
  for (const p of s.players) {
    const r = rmcs.applyAction(s, p.id, { type: 'ack' }, ctx);
    if (r.ok) s = r.state;
  }
  return s;
}

describe('Raja Mantri Chor Sipahi', () => {
  it('deals one of each slip', () => {
    const s = start();
    expect(Object.values(s.slips).sort()).toEqual(['chor', 'mantri', 'raja', 'sipahi']);
  });

  it('each player sees only their own slip plus the public Raja', () => {
    const s = start(3);
    const raja = holder(s, 'raja');
    for (const p of s.players) {
      const v = rmcs.getPlayerView(s, p.id);
      expect(v.mySlip).toBe(s.slips[p.id]);
      expect(Object.keys(v.known)).toEqual([raja]);
      if (s.slips[p.id] !== 'chor') expect(JSON.stringify(v)).not.toContain('chor');
    }
    const pub = rmcs.getPublicState(s);
    expect(pub.mySlip).toBeNull();
    expect(JSON.stringify(pub)).not.toContain('chor');
    expect(JSON.stringify(pub)).not.toContain('rng');
  });

  it('scores a correct guess: Raja 1000, Mantri 800, Sipahi 500, Chor 0', () => {
    let s = ackAll(start(5));
    expect(s.phase).toBe('guess');
    const mantri = holder(s, 'mantri');
    const chor = holder(s, 'chor');
    const r = rmcs.applyAction(s, mantri, { type: 'guess', target: chor }, ctx);
    expect(r.ok).toBe(true);
    s = (r as { state: RmcsState }).state;
    expect(s.totals[holder(s, 'raja')]).toBe(1000);
    expect(s.totals[mantri]).toBe(800);
    expect(s.totals[holder(s, 'sipahi')]).toBe(500);
    expect(s.totals[chor]).toBe(0);
  });

  it('scores a wrong guess: Mantri 0, Sipahi 500, Chor 800', () => {
    let s = ackAll(start(6));
    const mantri = holder(s, 'mantri');
    const r = rmcs.applyAction(s, mantri, { type: 'guess', target: holder(s, 'sipahi') }, ctx);
    s = (r as { state: RmcsState }).state;
    expect(s.totals[mantri]).toBe(0);
    expect(s.totals[holder(s, 'sipahi')]).toBe(500);
    expect(s.totals[holder(s, 'chor')]).toBe(800);
    expect(s.totals[holder(s, 'raja')]).toBe(1000);
  });

  it('only the Mantri may guess, and only Chor or Sipahi', () => {
    const s = ackAll(start(7));
    expect(rmcs.applyAction(s, holder(s, 'raja'), { type: 'guess', target: holder(s, 'chor') }, ctx).ok).toBe(false);
    expect(rmcs.applyAction(s, holder(s, 'mantri'), { type: 'guess', target: holder(s, 'raja') }, ctx).ok).toBe(false);
    expect(rmcs.applyAction(s, holder(s, 'mantri'), { type: 'guess', target: holder(s, 'mantri') }, ctx).ok).toBe(false);
  });

  it('plays the configured number of rounds then ends', () => {
    let s = rmcs.createGame({ rounds: 2, revealSeconds: 0, guessSeconds: 0 }, players(4), new Rng(2), ctx);
    for (let round = 0; round < 2; round++) {
      s = ackAll(s);
      const r = rmcs.applyAction(s, holder(s, 'mantri'), { type: 'guess', target: holder(s, 'chor') }, ctx);
      s = (r as { state: RmcsState }).state;
      s = ackAll(s);
    }
    expect(s.over).toBe(true);
    expect(s.history).toHaveLength(2);
    expect(s.totals[s.players[0]!.id]! >= 0).toBe(true);
  });

  it('times out by guessing randomly so the game never stalls', () => {
    let s = rmcs.createGame({ rounds: 1, revealSeconds: 5, guessSeconds: 10 }, players(4), new Rng(2), ctx);
    s = rmcs.onTimeout(s, { now: T0 + 6000 });
    expect(s.phase).toBe('guess');
    s = rmcs.onTimeout(s, { now: T0 + 20000 });
    expect(s.phase).toBe('result');
    expect(s.history).toHaveLength(1);
  });

  it('does not mutate the input state', () => {
    const s = start(8);
    const before = JSON.stringify(s);
    rmcs.applyAction(s, 'p0', { type: 'ack' }, ctx);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('Raja prediction', () => {
  it('only the Raja can predict, once, and earns +100 when right', () => {
    let s = start(11);
    const raja = holder(s, 'raja');
    const other = holder(s, 'sipahi');
    expect(rmcs.applyAction(s, other, { type: 'predict', correct: true }, ctx).ok).toBe(false);
    let r = rmcs.applyAction(s, raja, { type: 'predict', correct: true }, ctx);
    expect(r.ok).toBe(true);
    s = (r as { state: RmcsState }).state;
    expect(rmcs.applyAction(s, raja, { type: 'predict', correct: false }, ctx).ok).toBe(false);
    expect(rmcs.getPlayerView(s, other).prediction).toBe(true); // public
    s = ackAll(s);
    r = rmcs.applyAction(s, holder(s, 'mantri'), { type: 'guess', target: holder(s, 'chor') }, ctx);
    s = (r as { state: RmcsState }).state;
    expect(s.totals[raja]).toBe(1100);
  });

  it('a wrong prediction gives no bonus', () => {
    let s = start(12);
    const raja = holder(s, 'raja');
    s = (rmcs.applyAction(s, raja, { type: 'predict', correct: true }, ctx) as { state: RmcsState }).state;
    s = ackAll(s);
    s = (rmcs.applyAction(s, holder(s, 'mantri'), { type: 'guess', target: holder(s, 'sipahi') }, ctx) as { state: RmcsState }).state;
    expect(s.totals[raja]).toBe(1000);
  });
});
