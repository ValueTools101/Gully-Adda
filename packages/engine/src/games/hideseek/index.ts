/**
 * Chhupan Chhupai: real-time hide & seek, played as a party.
 *
 * Every round, EVERY player plays their own real-time round in the same
 * mohalla (same seed), in the same role: odd rounds everyone hides from an
 * AI seeker, even rounds everyone is the seeker. The phone records one input
 * per tick; the engine replays it to compute the score, so online scores are
 * verified by the server, not trusted from the client.
 */
import { Rng } from '../../core/rng';
import type { BaseState, BaseView, GameDefinition, PlayerId } from '../../core/types';
import { accept, baseState, clampInt, clone, deadlineIn, hasPlayer, isObj, playerName, pushLog, reject, withRng } from '../../core/util';
import { autoplay, replay, type HnsAiLevel, type HnsRole, type RoundResult } from './sim';

export * from './maps';
export * from './sim';

export interface HnsConfig {
  rounds: number;
  roundSeconds: number;
  aiLevel: HnsAiLevel;
  /** Online: extra time on top of the round to finish and submit (0 = no timer). */
  submitGraceSeconds: number;
}

export interface HnsRoundInfo {
  round: number;
  seed: number;
  role: HnsRole;
}

export interface HnsState extends BaseState {
  game: 'hideseek';
  config: HnsConfig;
  round: number;
  phase: 'play' | 'results';
  rounds: HnsRoundInfo[];
  /** results[round-1][playerId] */
  results: Record<PlayerId, RoundResult>[];
  acked: PlayerId[];
  totals: Record<PlayerId, number>;
}

export type HnsAction = { type: 'submit'; inputs: string } | { type: 'ack' };

export interface HnsView extends BaseView {
  game: 'hideseek';
  config: HnsConfig;
  round: number;
  phase: 'play' | 'results';
  current: HnsRoundInfo;
  /** Who has finished this round (scores stay hidden until everyone is done). */
  done: PlayerId[];
  myResult: RoundResult | null;
  /** Results of finished rounds (and the current one once it is in 'results'). */
  results: Record<PlayerId, RoundResult>[];
  acked: PlayerId[];
  totals: Record<PlayerId, number>;
}

export const roleForRound = (round: number): HnsRole => (round % 2 === 1 ? 'hider' : 'seeker');
const MAX_INPUT = 120 * 20;

function startRound(s: HnsState, ctx: { now: number }): void {
  const seed = withRng(s, (rng) => rng.int(2 ** 31));
  s.rounds.push({ round: s.round, seed, role: roleForRound(s.round) });
  s.results.push({});
  s.phase = 'play';
  s.acked = [];
  s.deadline = s.config.submitGraceSeconds > 0 ? deadlineIn(ctx, s.config.roundSeconds + 5 + s.config.submitGraceSeconds) : null;
  pushLog(s, roleForRound(s.round) === 'hider' ? 'hns.roundHide' : 'hns.roundSeek', { n: s.round });
}

function current(s: HnsState): HnsRoundInfo {
  return s.rounds[s.round - 1]!;
}

function pending(s: HnsState): PlayerId[] {
  if (s.over) return [];
  if (s.phase === 'play') return s.players.map((p) => p.id).filter((id) => !s.results[s.round - 1]![id]);
  return s.players.map((p) => p.id).filter((id) => !s.acked.includes(id));
}

function record(s: HnsState, id: PlayerId, r: RoundResult): void {
  s.results[s.round - 1]![id] = r;
  s.totals[id] = (s.totals[id] ?? 0) + r.score;
}

function finishRoundIfDone(s: HnsState, ctx: { now: number }): void {
  if (s.phase !== 'play' || pending(s).length) return;
  s.phase = 'results';
  s.deadline = s.config.submitGraceSeconds > 0 ? deadlineIn(ctx, 20) : null;
  const res = s.results[s.round - 1]!;
  const best = Object.entries(res).sort((a, b) => b[1].score - a[1].score)[0];
  if (best) pushLog(s, 'hns.roundBest', { name: playerName(s, best[0]), n: best[1].score });
}

function nextRound(s: HnsState, ctx: { now: number }): void {
  if (s.round >= s.config.rounds) {
    s.over = true;
    s.deadline = null;
    pushLog(s, 'game.over');
    return;
  }
  s.round += 1;
  startRound(s, ctx);
}

function botLevel(s: HnsState, id: PlayerId): HnsAiLevel {
  const p = s.players.find((x) => x.id === id);
  return (p?.difficulty as HnsAiLevel | undefined) ?? 'medium';
}

export const hideseek: GameDefinition<HnsConfig, HnsState, HnsAction, HnsView> = {
  meta: { id: 'hideseek', minPlayers: 1, maxPlayers: 8, hiddenInfo: true, simultaneous: true, voice: false },

  defaultConfig: () => ({ rounds: 2, roundSeconds: 45, aiLevel: 'medium', submitGraceSeconds: 60 }),

  sanitizeConfig(raw) {
    const r = isObj(raw) ? raw : {};
    const lvl = r.aiLevel === 'easy' || r.aiLevel === 'hard' ? r.aiLevel : 'medium';
    return {
      rounds: clampInt(r.rounds, 1, 6, 2),
      roundSeconds: clampInt(r.roundSeconds, 20, 120, 45),
      aiLevel: lvl,
      submitGraceSeconds: clampInt(r.submitGraceSeconds, 0, 300, 60),
    };
  },

  createGame(config, players, rng: Rng, ctx) {
    if (players.length < 1 || players.length > 8) throw new Error('Hide & Seek needs 1-8 players');
    const s: HnsState = {
      ...baseState('hideseek', players, rng),
      config: hideseek.sanitizeConfig(config, players.length),
      round: 1,
      phase: 'play',
      rounds: [],
      results: [],
      acked: [],
      totals: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
    startRound(s, ctx);
    return s;
  },

  getPublicState: (s) => view(s, null),
  getPlayerView: (s, id) => view(s, hasPlayer(s, id) ? id : null),

  listLegalActions(s, id) {
    if (s.over || !pending(s).includes(id)) return [];
    // The real input is produced by playing; this placeholder describes the action shape.
    return s.phase === 'play' ? [{ type: 'submit', inputs: '' }] : [{ type: 'ack' }];
  },

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (!hasPlayer(state, id)) return reject('not_in_game');
    if (!pending(state).includes(id)) return reject('not_your_turn');
    const s = clone(state);
    if (action.type === 'submit') {
      if (s.phase !== 'play') return reject('wrong_phase');
      const c = current(s);
      const r = replay(c.seed, c.role, s.config.roundSeconds, s.config.aiLevel, action.inputs);
      if (!r) return reject('bad_inputs');
      record(s, id, r);
      finishRoundIfDone(s, ctx);
      return accept(s);
    }
    if (action.type === 'ack') {
      if (s.phase !== 'results') return reject('wrong_phase');
      s.acked.push(id);
      if (!pending(s).length) nextRound(s, ctx);
      return accept(s);
    }
    return reject('unknown_action');
  },

  pendingActors: pending,

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    if (s.phase === 'play') {
      // Anyone who didn't finish in time: a bot plays their round (easy level).
      const c = current(s);
      for (const id of pending(s)) record(s, id, autoplay(c.seed, c.role, s.config.roundSeconds, s.config.aiLevel, 'easy', id).result);
      finishRoundIfDone(s, ctx);
    } else nextRound(s, ctx);
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,
  scores: (s) => clone(s.totals),

  getBotAction(s, botId) {
    if (s.over || !pending(s).includes(botId)) return null;
    if (s.phase === 'results') return { type: 'ack' };
    const c = current(s);
    return { type: 'submit', inputs: autoplay(c.seed, c.role, s.config.roundSeconds, s.config.aiLevel, botLevel(s, botId), botId).inputs };
  },

  isAction(a): a is HnsAction {
    if (!isObj(a)) return false;
    if (a.type === 'ack') return true;
    return a.type === 'submit' && typeof a.inputs === 'string' && a.inputs.length <= MAX_INPUT;
  },
};

function view(s: HnsState, me: PlayerId | null): HnsView {
  const done = s.phase === 'play' ? Object.keys(s.results[s.round - 1] ?? {}) : s.players.map((p) => p.id);
  const visibleResults = s.results.filter((_, i) => i < s.round - 1 || s.phase === 'results' || s.over);
  return {
    game: 'hideseek',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    waitingFor: pending(s),
    legal: me ? hideseek.listLegalActions(s, me) : [],
    config: clone(s.config),
    round: s.round,
    phase: s.phase,
    current: clone(current(s)),
    done,
    myResult: me ? clone(s.results[s.round - 1]?.[me] ?? null) : null,
    results: clone(visibleResults),
    acked: clone(s.acked),
    totals: s.phase === 'results' || s.over ? clone(s.totals) : Object.fromEntries(s.players.map((p) => [p.id, sumUpTo(s, p.id, s.round - 1)])),
  };
}

function sumUpTo(s: HnsState, id: PlayerId, rounds: number): number {
  let t = 0;
  for (let i = 0; i < rounds; i++) t += s.results[i]?.[id]?.score ?? 0;
  return t;
}
