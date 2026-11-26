import { describe, expect, it } from 'vitest';
import { Rng, boxLines, dots, dotsLineCount, hLine, lineBoxes, vLine, type DotsState } from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };
const start = (n = 2, size: 4 | 5 = 4) => dots.createGame({ size, turnSeconds: 0 }, players(n, false), new Rng(1), ctx);
function play(s: DotsState, pid: string, line: number): DotsState {
  const r = dots.applyAction(s, pid, { type: 'line', line }, ctx);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe('Dots and Boxes', () => {
  it('has the right number of lines and boxes', () => {
    expect(dotsLineCount(4)).toBe(40);
    expect(start().lines).toHaveLength(40);
    expect(start(2, 5).lines).toHaveLength(60);
    expect(start(2, 5).boxes).toHaveLength(25);
  });

  it('line/box geometry is consistent', () => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      for (const l of boxLines(4, r, c)) expect(lineBoxes(4, l)).toContain(r * 4 + c);
    }
    expect(lineBoxes(4, hLine(4, 0, 0))).toEqual([0]);
    expect(lineBoxes(4, vLine(4, 0, 1))).toEqual([0, 1]);
  });

  it('completing a box scores and grants an extra turn', () => {
    let s = start();
    const [top, bottom, left, right] = boxLines(4, 0, 0);
    s = play(s, 'p0', top);
    s = play(s, 'p1', bottom);
    s = play(s, 'p0', left);
    expect(s.turn).toBe(1);
    s = play(s, 'p1', right);
    expect(s.boxes[0]).toBe(1);
    expect(s.turn).toBe(1); // extra turn
    expect(dots.scores(s).p1).toBe(1);
  });

  it('rejects taken lines, out-of-turn moves and bad indices', () => {
    let s = start();
    s = play(s, 'p0', 0);
    expect(dots.applyAction(s, 'p1', { type: 'line', line: 0 }, ctx).ok).toBe(false);
    expect(dots.applyAction(s, 'p0', { type: 'line', line: 1 }, ctx).ok).toBe(false);
    expect(dots.applyAction(s, 'p1', { type: 'line', line: 999 }, ctx).ok).toBe(false);
    expect(dots.applyAction(s, 'p1', { type: 'line', line: 1.5 }, ctx).ok).toBe(false);
  });

  it('medium bot takes a free box when available', () => {
    let s = start();
    const [top, bottom, left, right] = boxLines(4, 1, 1);
    s = play(s, 'p0', top);
    s = play(s, 'p1', bottom);
    s = play(s, 'p0', left);
    const a = dots.getBotAction(s, 'p1', 'medium', new Rng(3));
    expect(a).toEqual({ type: 'line', line: right });
  });

  it('timeout plays a move for the current player', () => {
    let s = dots.createGame({ size: 4, turnSeconds: 10 }, players(2), new Rng(1), ctx);
    s = dots.onTimeout(s, { now: T0 + 11000 });
    expect(s.lines.filter(Boolean)).toHaveLength(1);
  });
});
