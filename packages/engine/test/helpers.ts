import {
  type AnyGame, type BaseState, type BotDifficulty, type GameId, type PlayerInfo, Rng, botRng, getGame,
} from '../src';

export const T0 = 1_700_000_000_000;

export function players(n: number, bots = true): PlayerInfo[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: bots }));
}

export function game(id: GameId): AnyGame {
  const g = getGame(id);
  if (!g) throw new Error(id);
  return g;
}

const DIFFS: BotDifficulty[] = ['easy', 'medium', 'hard'];

export interface SimOptions {
  config?: unknown;
  /** Probability per step of firing a timeout instead of a bot move (requires timers in config). */
  timeoutRate?: number;
  maxSteps?: number;
  /** Check every view after every step (slower). */
  checkViews?: boolean;
}

/** Plays a full bot-vs-bot game; throws on illegal moves, stuck states or leaks. */
export function simulate(id: GameId, n: number, seed: number, opts: SimOptions = {}): { state: BaseState; steps: number } {
  const g = game(id);
  const ps = players(n);
  const rng = new Rng(seed);
  let now = T0;
  let s = g.createGame(opts.config ?? g.defaultConfig(n), ps, rng, { now }) as BaseState;
  const max = opts.maxSteps ?? 20000;
  let steps = 0;
  while (!g.isGameOver(s)) {
    if (++steps > max) throw new Error(`${id} stuck after ${max} steps (seed ${seed})`);
    now += 1000;
    if (opts.timeoutRate && s.deadline !== null && rng.chance(opts.timeoutRate)) {
      const before = s.version;
      s = g.onTimeout(s, { now: Math.max(now, s.deadline) }) as BaseState;
      if (s.version === before && !s.over) throw new Error('timeout made no progress');
      continue;
    }
    const pending = g.pendingActors(s);
    if (pending.length === 0) throw new Error(`${id}: nobody to act but game not over (seed ${seed})`);
    let acted = false;
    for (const pid of rng.shuffle(pending)) {
      const diff = DIFFS[(Number(pid.slice(1)) + seed) % 3] as BotDifficulty;
      const action = g.getBotAction(s, pid, diff, botRng(s, pid));
      if (!action) continue;
      const legal = g.listLegalActions(s, pid) as { type: string }[];
      if (!legal.some((l) => l.type === action.type)) throw new Error(`${id}: bot chose illegal action type ${JSON.stringify(action)}`);
      if (!g.isAction(action)) throw new Error(`${id}: bot action fails isAction`);
      const res = g.applyAction(s, pid, action, { now });
      if (!res.ok) throw new Error(`${id}: bot action rejected (${res.reason}) ${JSON.stringify(action)} seed ${seed}`);
      if (res.state === s) throw new Error('applyAction must return a new object');
      s = res.state as BaseState;
      acted = true;
      break;
    }
    if (!acted) throw new Error(`${id}: no bot could act (seed ${seed})`);
    if (opts.checkViews) for (const p of ps) {
      const v = g.getPlayerView(s, p.id) as Record<string, unknown>;
      if ('rng' in v) throw new Error('view leaks rng');
    }
  }
  return { state: s, steps };
}
