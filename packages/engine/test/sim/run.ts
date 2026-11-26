import { describe, expect, it } from 'vitest';
import { type GameId } from '../../src';
import { game, simulate } from '../helpers';

export const RUNS = Number(process.env.SIM_RUNS ?? 1000);

export interface SimCase {
  sizes: number[];
  config?: (n: number) => unknown;
  timeoutRate?: number;
  runs?: number;
}

export function simSuite(id: GameId, cases: SimCase[]): void {
  describe(`${id}: bot-vs-bot simulations`, () => {
    for (const c of cases) {
      for (const n of c.sizes) {
        const runs = Math.max(1, Math.round((c.runs ?? 1) * RUNS));
        const label = `${n} players${c.timeoutRate ? ', random timeouts' : ''}${c.config ? ' ' + JSON.stringify(c.config(n)) : ''}`;
        it(`${label}: ${runs} games finish with only legal moves`, () => {
          const g = game(id);
          for (let seed = 1; seed <= runs; seed++) {
            const { state } = simulate(id, n, seed * 7919 + n, {
              config: c.config ? c.config(n) : undefined,
              timeoutRate: c.timeoutRate,
              checkViews: seed <= 20,
            });
            expect(g.isGameOver(state)).toBe(true);
            expect(Object.keys(g.scores(state))).toHaveLength(n);
          }
        });
      }
    }
    it('same seed gives an identical game', () => {
      const n = id === 'mafia' ? 7 : 4;
      expect(JSON.stringify(simulate(id, n, 42).state)).toEqual(JSON.stringify(simulate(id, n, 42).state));
    });
  });
}
