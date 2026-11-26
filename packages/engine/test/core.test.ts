import { describe, expect, it } from 'vitest';
import { GAMES, GAME_ORDER, Rng, getGame, isGameId, newDeck, shuffledDeck, deal } from '../src';

describe('Rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('int stays in range and covers all values', () => {
    const r = new Rng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.range(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });
  it('shuffle keeps elements', () => {
    expect(new Rng(1).shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('registry', () => {
  it('has every v1 game with consistent ids', () => {
    expect(GAME_ORDER).toEqual(['rmcs', 'mafia', 'hideseek', 'npat', 'dots', 'ludo']);
    for (const id of GAME_ORDER) expect(GAMES[id].meta.id).toBe(id);
    expect(getGame('carrom')).toBeNull();
    expect(isGameId('ludo')).toBe(true);
    expect(isGameId('__proto__')).toBe(false);
  });
  it('sanitizeConfig never throws on garbage', () => {
    for (const id of GAME_ORDER) {
      const g = GAMES[id];
      for (const junk of [null, 1, 'x', [], { rounds: 'nope', size: 99, categories: [1, 2] }]) {
        expect(() => g.sanitizeConfig(junk, g.meta.minPlayers)).not.toThrow();
      }
    }
  });
  it('isAction rejects garbage', () => {
    for (const id of GAME_ORDER) {
      const g = GAMES[id];
      for (const junk of [null, 1, 'roll', [], { type: 42 }, { type: 'nope' }]) expect(g.isAction(junk)).toBe(false);
    }
  });
});

describe('cards (future card games)', () => {
  it('builds and deals a deck', () => {
    expect(newDeck()).toHaveLength(52);
    const d = deal(shuffledDeck(new Rng(5)), 4, 3);
    expect(d.hands.map((h) => h.length)).toEqual([3, 3, 3, 3]);
    expect(d.rest).toHaveLength(40);
  });
});
