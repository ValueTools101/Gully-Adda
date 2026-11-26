/**
 * Helpers shared by the app (local modes), Cloud Functions and tests to drive
 * bots and timeouts without duplicating rules.
 */
import { Rng, hashString } from './rng';
import type { AnyGame, BaseState, BotDifficulty, GameContext, PlayerId } from './types';

/** Deterministic per-bot RNG derived from state so bot choices are reproducible. */
export function botRng(state: BaseState, botId: PlayerId): Rng {
  return new Rng((state.rng ^ hashString(botId) ^ Math.imul(state.version + 1, 0x9e3779b1)) >>> 0);
}

/**
 * Bots (or players handed to a bot) that should act now.
 * `isBotControlled` lets the server mark disconnected humans as bot-controlled.
 */
export function botsToAct(game: AnyGame, state: BaseState, isBotControlled: (id: PlayerId) => boolean): PlayerId[] {
  return game.pendingActors(state).filter(isBotControlled);
}

export interface StepResult<S> {
  state: S;
  acted: number;
}

/**
 * Apply one bot action for the first bot that is waiting. Returns acted=0 if no bot is waiting.
 */
export function stepOneBot<S extends BaseState>(
  game: AnyGame,
  state: S,
  ctx: GameContext,
  isBotControlled: (id: PlayerId) => boolean,
  difficultyOf: (id: PlayerId) => BotDifficulty,
): StepResult<S> {
  for (const id of botsToAct(game, state, isBotControlled)) {
    const action = game.getBotAction(state, id, difficultyOf(id), botRng(state, id));
    if (!action) continue;
    const res = game.applyAction(state, id, action, ctx);
    if (res.ok) return { state: res.state as S, acted: 1 };
  }
  return { state, acted: 0 };
}

/** Run bots until a human is needed, the game ends, or `limit` actions are taken. */
export function runBots<S extends BaseState>(
  game: AnyGame,
  state: S,
  ctx: GameContext,
  isBotControlled: (id: PlayerId) => boolean,
  difficultyOf: (id: PlayerId) => BotDifficulty,
  limit = 500,
): StepResult<S> {
  let s = state;
  let acted = 0;
  while (acted < limit && !game.isGameOver(s)) {
    const r = stepOneBot(game, s, ctx, isBotControlled, difficultyOf);
    if (!r.acted) break;
    s = r.state;
    acted++;
  }
  return { state: s, acted };
}

/** Apply onTimeout if the deadline has passed. */
export function applyTimeoutIfDue<S extends BaseState>(game: AnyGame, state: S, ctx: GameContext): S {
  if (state.over || state.deadline === null || ctx.now < state.deadline) return state;
  return game.onTimeout(state, ctx) as S;
}
