import type { ActionResult, BaseState, GameContext, LogEntry, PlayerId, PlayerInfo } from './types';
import { Rng } from './rng';

/** Deep clone for plain-JSON game state. */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function reject<S>(reason: string): ActionResult<S> {
  return { ok: false, reason };
}

export function accept<S extends BaseState>(state: S): ActionResult<S> {
  state.version += 1;
  return { ok: true, state };
}

const MAX_LOG = 30;

export function pushLog(state: BaseState, key: string, params?: Record<string, string | number>): void {
  const e: LogEntry = params ? { key, params } : { key };
  state.log.push(e);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

/** Run `fn` with an Rng bound to state.rng and write the advanced state back. */
export function withRng<T>(state: BaseState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rng);
  const out = fn(rng);
  state.rng = rng.state;
  return out;
}

export function playerName(state: BaseState, id: PlayerId): string {
  return state.players.find((p) => p.id === id)?.name ?? '?';
}

export function hasPlayer(state: BaseState, id: PlayerId): boolean {
  return state.players.some((p) => p.id === id);
}

export function deadlineIn(ctx: GameContext, seconds: number): number | null {
  return seconds > 0 ? ctx.now + seconds * 1000 : null;
}

export function baseState<G extends BaseState['game']>(
  game: G,
  players: PlayerInfo[],
  rng: Rng,
): { game: G; players: PlayerInfo[]; rng: number; version: number; over: boolean; deadline: number | null; log: LogEntry[] } {
  return { game, players: clone(players), rng: rng.state, version: 0, over: false, deadline: null, log: [] };
}

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : dflt;
  return Math.min(max, Math.max(min, n));
}

export function asBool(v: unknown, dflt: boolean): boolean {
  return typeof v === 'boolean' ? v : dflt;
}

export function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

export function isStr(v: unknown, maxLen = 200): v is string {
  return typeof v === 'string' && v.length <= maxLen;
}
