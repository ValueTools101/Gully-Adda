/**
 * Raja Mantri Chor Sipahi (4 players).
 * Each round: slips are shuffled, everyone privately sees their own slip,
 * Raja is revealed publicly and orders Mantri to find the Chor. Mantri
 * reveals themselves and guesses between the two remaining players.
 */
import { Rng } from '../../core/rng';
import type {
  BaseState, BaseView, BotDifficulty, GameContext, GameDefinition, PlayerId, PlayerInfo,
} from '../../core/types';
import {
  accept, baseState, clampInt, clone, deadlineIn, hasPlayer, isObj, isStr, playerName, pushLog, reject, withRng,
} from '../../core/util';

export type RmcsRole = 'raja' | 'mantri' | 'chor' | 'sipahi';
export const RMCS_ROLES: RmcsRole[] = ['raja', 'mantri', 'chor', 'sipahi'];

export const RMCS_POINTS = { raja: 1000, mantriRight: 800, sipahi: 500, chorEscaped: 800 } as const;

export interface RmcsConfig {
  rounds: number;
  /** Seconds to look at slips / see results before auto-continue (0 = no timer). */
  revealSeconds: number;
  /** Seconds the Mantri has to guess (0 = no timer). */
  guessSeconds: number;
}

export type RmcsPhase = 'peek' | 'guess' | 'result';

export interface RmcsRoundResult {
  round: number;
  slips: Record<PlayerId, RmcsRole>;
  guess: PlayerId;
  correct: boolean;
  points: Record<PlayerId, number>;
}

export interface RmcsState extends BaseState {
  game: 'rmcs';
  config: RmcsConfig;
  round: number;
  phase: RmcsPhase;
  slips: Record<PlayerId, RmcsRole>;
  /** Players who have seen their slip (peek) or result (result). */
  acked: PlayerId[];
  totals: Record<PlayerId, number>;
  history: RmcsRoundResult[];
}

export type RmcsAction =
  | { type: 'ack' }
  | { type: 'guess'; target: PlayerId };

export interface RmcsView extends BaseView {
  game: 'rmcs';
  config: RmcsConfig;
  round: number;
  phase: RmcsPhase;
  mySlip: RmcsRole | null;
  /** Publicly known slips (Raja always; Mantri once guessing; all in result). */
  known: Record<PlayerId, RmcsRole>;
  acked: PlayerId[];
  totals: Record<PlayerId, number>;
  history: RmcsRoundResult[];
}

function roleHolder(s: RmcsState, role: RmcsRole): PlayerId {
  const e = Object.entries(s.slips).find(([, r]) => r === role);
  return e ? e[0] : '';
}

function dealRound(s: RmcsState, ctx: GameContext): void {
  const roles = withRng(s, (rng) => rng.shuffle(RMCS_ROLES));
  s.slips = {};
  s.players.forEach((p, i) => {
    s.slips[p.id] = roles[i] as RmcsRole;
  });
  s.phase = 'peek';
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.revealSeconds);
  const raja = roleHolder(s, 'raja');
  pushLog(s, 'rmcs.round', { n: s.round });
  pushLog(s, 'rmcs.rajaIs', { name: playerName(s, raja) });
}

function startGuess(s: RmcsState, ctx: GameContext): void {
  s.phase = 'guess';
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.guessSeconds);
  pushLog(s, 'rmcs.findChor', { raja: playerName(s, roleHolder(s, 'raja')), mantri: playerName(s, roleHolder(s, 'mantri')) });
}

function resolveGuess(s: RmcsState, target: PlayerId, ctx: GameContext): void {
  const correct = s.slips[target] === 'chor';
  const points: Record<PlayerId, number> = {};
  for (const p of s.players) {
    const role = s.slips[p.id];
    let pts = 0;
    if (role === 'raja') pts = RMCS_POINTS.raja;
    else if (role === 'sipahi') pts = RMCS_POINTS.sipahi;
    else if (role === 'mantri') pts = correct ? RMCS_POINTS.mantriRight : 0;
    else if (role === 'chor') pts = correct ? 0 : RMCS_POINTS.chorEscaped;
    points[p.id] = pts;
    s.totals[p.id] = (s.totals[p.id] ?? 0) + pts;
  }
  s.history.push({ round: s.round, slips: clone(s.slips), guess: target, correct, points });
  pushLog(s, correct ? 'rmcs.caught' : 'rmcs.escaped', {
    mantri: playerName(s, roleHolder(s, 'mantri')),
    target: playerName(s, target),
    chor: playerName(s, roleHolder(s, 'chor')),
  });
  s.phase = 'result';
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.revealSeconds);
}

function nextRound(s: RmcsState, ctx: GameContext): void {
  if (s.round >= s.config.rounds) {
    s.over = true;
    s.deadline = null;
    s.acked = [];
    pushLog(s, 'game.over');
    return;
  }
  s.round += 1;
  dealRound(s, ctx);
}

function pending(s: RmcsState): PlayerId[] {
  if (s.over) return [];
  if (s.phase === 'guess') return [roleHolder(s, 'mantri')];
  return s.players.map((p) => p.id).filter((id) => !s.acked.includes(id));
}

function guessTargets(s: RmcsState): PlayerId[] {
  return s.players.map((p) => p.id).filter((id) => s.slips[id] === 'chor' || s.slips[id] === 'sipahi');
}

function makeView(s: RmcsState, me: PlayerId | null): RmcsView {
  const known: Record<PlayerId, RmcsRole> = {};
  if (s.phase === 'result' || s.over) Object.assign(known, s.slips);
  else {
    const raja = roleHolder(s, 'raja');
    known[raja] = 'raja';
    if (s.phase === 'guess') known[roleHolder(s, 'mantri')] = 'mantri';
  }
  return {
    game: 'rmcs',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    waitingFor: pending(s),
    legal: me ? rmcs.listLegalActions(s, me) : [],
    config: clone(s.config),
    round: s.round,
    phase: s.phase,
    mySlip: me ? (s.slips[me] ?? null) : null,
    known,
    acked: clone(s.acked),
    totals: clone(s.totals),
    history: clone(s.history),
  };
}

export const rmcs: GameDefinition<RmcsConfig, RmcsState, RmcsAction, RmcsView> = {
  meta: { id: 'rmcs', minPlayers: 4, maxPlayers: 4, hiddenInfo: true, simultaneous: true, voice: false },

  defaultConfig: () => ({ rounds: 5, revealSeconds: 0, guessSeconds: 0 }),

  sanitizeConfig(raw) {
    const r = isObj(raw) ? raw : {};
    return {
      rounds: clampInt(r.rounds, 1, 20, 5),
      revealSeconds: clampInt(r.revealSeconds, 0, 120, 0),
      guessSeconds: clampInt(r.guessSeconds, 0, 300, 0),
    };
  },

  createGame(config, players: PlayerInfo[], rng: Rng, ctx) {
    if (players.length !== 4) throw new Error('Raja Mantri Chor Sipahi needs exactly 4 players');
    const s: RmcsState = {
      ...baseState('rmcs', players, rng),
      config: rmcs.sanitizeConfig(config, 4),
      round: 1,
      phase: 'peek',
      slips: {},
      acked: [],
      totals: Object.fromEntries(players.map((p) => [p.id, 0])),
      history: [],
    };
    dealRound(s, ctx);
    return s;
  },

  getPublicState: (s) => makeView(s, null),
  getPlayerView: (s, id) => makeView(s, hasPlayer(s, id) ? id : null),

  listLegalActions(s, id) {
    if (s.over || !pending(s).includes(id)) return [];
    if (s.phase === 'guess') return guessTargets(s).map((target) => ({ type: 'guess', target }));
    return [{ type: 'ack' }];
  },

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (!hasPlayer(state, id)) return reject('not_in_game');
    if (!pending(state).includes(id)) return reject('not_your_turn');
    const s = clone(state);
    if (action.type === 'ack') {
      if (s.phase === 'guess') return reject('wrong_phase');
      s.acked.push(id);
      if (s.acked.length >= s.players.length) {
        if (s.phase === 'peek') startGuess(s, ctx);
        else nextRound(s, ctx);
      }
      return accept(s);
    }
    if (action.type === 'guess') {
      if (s.phase !== 'guess') return reject('wrong_phase');
      if (!guessTargets(s).includes(action.target)) return reject('invalid_target');
      resolveGuess(s, action.target, ctx);
      return accept(s);
    }
    return reject('unknown_action');
  },

  pendingActors: pending,

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    if (s.phase === 'guess') {
      const target = withRng(s, (rng) => rng.pick(guessTargets(s)));
      resolveGuess(s, target, ctx);
    } else if (s.phase === 'peek') startGuess(s, ctx);
    else nextRound(s, ctx);
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,
  scores: (s) => clone(s.totals),

  getBotAction(s, botId, _d: BotDifficulty, rng) {
    const legal = rmcs.listLegalActions(s, botId);
    if (legal.length === 0) return null;
    return rng.pick(legal); // Mantri has no information: a fair coin flip.
  },

  isAction(a): a is RmcsAction {
    if (!isObj(a)) return false;
    if (a.type === 'ack') return true;
    return a.type === 'guess' && isStr(a.target, 128);
  },
};
