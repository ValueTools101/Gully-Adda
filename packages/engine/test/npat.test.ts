import { describe, expect, it } from 'vitest';
import { NPAT_WORDS, Rng, isValidAnswer, npat, type NpatState } from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };
function start(n = 3, cfg: Record<string, unknown> = {}): NpatState {
  return npat.createGame({ ...npat.defaultConfig(n), ...cfg }, players(n, false), new Rng(4), ctx);
}
function act(s: NpatState, pid: string, a: Parameters<typeof npat.applyAction>[2], now = T0): NpatState {
  const r = npat.applyAction(s, pid, a, { now });
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}
function fill(s: NpatState, pid: string, word: (l: string) => string): NpatState {
  const answers = Object.fromEntries(s.config.categories.map((c) => [c, word(s.letter)]));
  return act(s, pid, { type: 'answer', answers });
}

describe('Name Place Animal Thing', () => {
  it('validates the round letter', () => {
    expect(isValidAnswer('Agra', 'A')).toBe(true);
    expect(isValidAnswer('  agra ', 'A')).toBe(true);
    expect(isValidAnswer('Bhopal', 'A')).toBe(false);
    expect(isValidAnswer('A', 'A')).toBe(false);
    expect(isValidAnswer('A1', 'A')).toBe(false);
  });

  it('every bot word starts with its letter', () => {
    for (const [cat, byLetter] of Object.entries(NPAT_WORDS)) {
      for (const [letter, words] of Object.entries(byLetter)) {
        for (const w of words) expect(isValidAnswer(w, letter), `${cat}/${letter}/${w}`).toBe(true);
      }
    }
  });

  it('keeps answers hidden from others until the round closes', () => {
    let s = start();
    s = fill(s, 'p0', (l) => `${l}secretword`);
    const other = npat.getPlayerView(s, 'p1');
    expect(other.revealed).toEqual({});
    expect(JSON.stringify(other)).not.toContain('secretword');
    expect(npat.getPlayerView(s, 'p0').myAnswers.name).toContain('secretword');
    expect(JSON.stringify(npat.getPublicState(s))).not.toContain('secretword');
  });

  it('scores 10 unique, 5 duplicate, 0 empty/invalid', () => {
    let s = start(3, { challenges: false, categories: ['name', 'place'] });
    const L = s.letter;
    s = act(s, 'p0', { type: 'answer', answers: { name: `${L}aaa`, place: `${L}xyz` } });
    s = act(s, 'p1', { type: 'answer', answers: { name: `${L}aaa`, place: 'Q-wrong' } });
    s = act(s, 'p2', { type: 'answer', answers: { name: `${L}bbb`, place: '' } });
    for (const p of ['p0', 'p1', 'p2']) s = act(s, p, { type: 'submit' });
    expect(s.phase).toBe('result');
    expect(s.totals).toEqual({ p0: 5 + 10, p1: 5 + 0, p2: 10 + 0 });
  });

  it('Stop needs all categories filled and starts the grace period', () => {
    let s = start(2, { roundSeconds: 60, graceSeconds: 5 });
    expect(npat.applyAction(s, 'p0', { type: 'stop' }, ctx).ok).toBe(false);
    s = fill(s, 'p0', (l) => `${l}ok`);
    s = act(s, 'p0', { type: 'stop' });
    expect(s.stoppedBy).toBe('p0');
    expect(s.deadline).toBe(T0 + 5000);
    expect(npat.applyAction(s, 'p0', { type: 'answer', answers: { name: 'Zzz' } }, ctx).ok).toBe(false);
    s = npat.onTimeout(s, { now: T0 + 5000 });
    expect(s.phase).toBe('challenge');
  });

  it('challenge votes reject an answer by majority of other players', () => {
    let s = start(3, { categories: ['name'] });
    const L = s.letter;
    s = act(s, 'p0', { type: 'answer', answers: { name: `${L}blahblah` } });
    for (const p of ['p0', 'p1', 'p2']) s = act(s, p, { type: 'submit' });
    expect(s.phase).toBe('challenge');
    expect(npat.applyAction(s, 'p0', { type: 'challenge', target: 'p0', category: 'name', reject: true }, ctx).ok).toBe(false);
    s = act(s, 'p1', { type: 'challenge', target: 'p0', category: 'name', reject: true });
    s = act(s, 'p2', { type: 'challenge', target: 'p0', category: 'name', reject: true });
    for (const p of ['p0', 'p1', 'p2']) s = act(s, p, { type: 'ready' });
    expect(s.totals.p0).toBe(0);
    expect(s.history[0]!.cells.p0!.name!.rejected).toBe(true);
  });

  it('one vote out of two others is not enough to reject', () => {
    let s = start(3, { categories: ['name'] });
    s = act(s, 'p0', { type: 'answer', answers: { name: `${s.letter}fine` } });
    for (const p of ['p0', 'p1', 'p2']) s = act(s, p, { type: 'submit' });
    s = act(s, 'p1', { type: 'challenge', target: 'p0', category: 'name', reject: true });
    for (const p of ['p0', 'p1', 'p2']) s = act(s, p, { type: 'ready' });
    expect(s.totals.p0).toBe(10);
  });

  it('sanitizes answers and categories', () => {
    const cfg = npat.sanitizeConfig({ categories: ['Name', 'food', '<script>', 'name'] }, 3);
    expect(cfg.categories).toEqual(['name', 'food']);
    let s = start(2);
    s = act(s, 'p0', { type: 'answer', answers: { name: 'x'.repeat(40), evil: 'y' } });
    expect(Object.keys(s.answers.p0!)).toEqual(s.config.categories);
  });
});
