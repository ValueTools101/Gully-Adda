/**
 * Ludo (2-4 players), standard rules:
 * - a 6 is needed to leave the yard; a 6 gives another roll; three 6s in a row forfeits the turn
 * - landing on an opponent (not on a safe square) sends it back to its yard; capturing or
 *   bringing a token home also earns another roll
 * - an exact roll is needed to reach home
 * Token progress: -1 = yard, 0..50 = main track, 51..55 = home column, 56 = home.
 */
import { Rng } from '../../core/rng';
import type { BaseState, BaseView, BotDifficulty, GameContext, GameDefinition, PlayerId } from '../../core/types';
import {
  accept, asBool, baseState, clampInt, clone, deadlineIn, hasPlayer, isInt, isObj, playerName, pushLog, reject,
} from '../../core/util';

export const LUDO_TRACK = 52;
export const LUDO_HOME = 56;
export const LUDO_LAST_MAIN = 50;
export const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
export type LudoColour = 0 | 1 | 2 | 3; // red, green, yellow, blue

export interface LudoConfig {
  /** Keep playing after the first winner until only one player is left. */
  finishAll: boolean;
  turnSeconds: number;
}

export interface LudoState extends BaseState {
  game: 'ludo';
  config: LudoConfig;
  colours: Record<PlayerId, LudoColour>;
  tokens: Record<PlayerId, number[]>;
  turn: number;
  phase: 'roll' | 'move';
  dice: number | null;
  sixes: number;
  /** Finishing order. */
  ranking: PlayerId[];
  lastMove: { player: PlayerId; token: number; from: number; to: number; captured: PlayerId[] } | null;
}

export type LudoAction = { type: 'roll' } | { type: 'move'; token: number };

export interface LudoView extends BaseView {
  game: 'ludo';
  config: LudoConfig;
  colours: Record<PlayerId, LudoColour>;
  tokens: Record<PlayerId, number[]>;
  turn: number;
  phase: 'roll' | 'move';
  dice: number | null;
  sixes: number;
  ranking: PlayerId[];
  lastMove: LudoState['lastMove'];
}

export function absSquare(colour: number, progress: number): number {
  return (colour * 13 + progress) % LUDO_TRACK;
}

export function isSafe(abs: number): boolean {
  return LUDO_SAFE.includes(abs);
}

function seatsFor(n: number): LudoColour[] {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

function current(s: LudoState): PlayerId {
  return s.players[s.turn]?.id ?? '';
}

function activePlayers(s: LudoState): PlayerId[] {
  return s.players.map((p) => p.id).filter((id) => !s.ranking.includes(id));
}

export function ludoMovable(s: Pick<LudoState, 'tokens'>, id: PlayerId, roll: number): number[] {
  const toks = s.tokens[id] ?? [];
  const out: number[] = [];
  toks.forEach((p, i) => {
    if (p === -1) {
      if (roll === 6) out.push(i);
    } else if (p < LUDO_HOME && p + roll <= LUDO_HOME) out.push(i);
  });
  return out;
}

function advanceTurn(s: LudoState, ctx: GameContext): void {
  s.sixes = 0;
  s.dice = null;
  s.phase = 'roll';
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const t = (s.turn + k) % n;
    const id = s.players[t]?.id ?? '';
    if (!s.ranking.includes(id)) {
      s.turn = t;
      break;
    }
  }
  s.deadline = deadlineIn(ctx, s.config.turnSeconds);
}

function sameTurnAgain(s: LudoState, ctx: GameContext): void {
  s.dice = null;
  s.phase = 'roll';
  s.deadline = deadlineIn(ctx, s.config.turnSeconds);
}

function doRoll(s: LudoState, ctx: GameContext): void {
  const id = current(s);
  const rng = new Rng(s.rng);
  const d = rng.range(1, 6);
  s.rng = rng.state;
  s.dice = d;
  pushLog(s, 'ludo.rolled', { name: playerName(s, id), n: d });
  if (d !== 6) s.sixes = 0;
  else {
    s.sixes += 1;
    if (s.sixes >= 3) {
      pushLog(s, 'ludo.threeSixes', { name: playerName(s, id) });
      advanceTurn(s, ctx);
      return;
    }
  }
  const movable = ludoMovable(s, id, d);
  if (movable.length === 0) {
    pushLog(s, 'ludo.noMove', { name: playerName(s, id) });
    if (d === 6) sameTurnAgain(s, ctx);
    else advanceTurn(s, ctx);
    return;
  }
  s.phase = 'move';
  s.deadline = deadlineIn(ctx, s.config.turnSeconds);
}

function doMove(s: LudoState, token: number, ctx: GameContext): void {
  const id = current(s);
  const d = s.dice ?? 0;
  const toks = s.tokens[id] as number[];
  const from = toks[token] as number;
  const to = from === -1 ? 0 : from + d;
  toks[token] = to;
  const colour = s.colours[id] as number;
  const captured: PlayerId[] = [];
  if (to <= LUDO_LAST_MAIN) {
    const sq = absSquare(colour, to);
    if (!isSafe(sq)) {
      for (const p of s.players) {
        if (p.id === id) continue;
        const theirs = s.tokens[p.id] as number[];
        theirs.forEach((tp, i) => {
          if (tp >= 0 && tp <= LUDO_LAST_MAIN && absSquare(s.colours[p.id] as number, tp) === sq) {
            theirs[i] = -1;
            captured.push(p.id);
          }
        });
      }
    }
  }
  s.lastMove = { player: id, token, from, to, captured };
  for (const c of captured) pushLog(s, 'ludo.captured', { name: playerName(s, id), victim: playerName(s, c) });
  let bonus = d === 6 || captured.length > 0;
  if (to === LUDO_HOME) {
    pushLog(s, 'ludo.tokenHome', { name: playerName(s, id) });
    bonus = true;
    if (toks.every((t) => t === LUDO_HOME)) {
      s.ranking.push(id);
      pushLog(s, 'ludo.finished', { name: playerName(s, id), n: s.ranking.length });
      const left = activePlayers(s);
      if (!s.config.finishAll || left.length <= 1) {
        s.ranking.push(...left.sort((a, b) => progressOf(s, b) - progressOf(s, a)));
        s.over = true;
        s.deadline = null;
        s.dice = null;
        pushLog(s, 'game.winner', { name: playerName(s, s.ranking[0] ?? '') });
        return;
      }
      advanceTurn(s, ctx);
      return;
    }
  }
  if (bonus) sameTurnAgain(s, ctx);
  else advanceTurn(s, ctx);
}

function progressOf(s: LudoState, id: PlayerId): number {
  return (s.tokens[id] ?? []).reduce((a, t) => a + Math.max(0, t + 1), 0);
}

/** Heuristic move score for bots. */
function scoreMove(s: LudoState, id: PlayerId, token: number, roll: number, difficulty: BotDifficulty): number {
  const from = (s.tokens[id] ?? [])[token] as number;
  const to = from === -1 ? 0 : from + roll;
  const colour = s.colours[id] as number;
  let score = to / 10;
  if (to === LUDO_HOME) score += 40;
  if (from === -1) score += 30;
  if (from <= LUDO_LAST_MAIN && to > LUDO_LAST_MAIN) score += 20;
  if (to <= LUDO_LAST_MAIN) {
    const sq = absSquare(colour, to);
    let caps = 0;
    for (const p of s.players) {
      if (p.id === id) continue;
      for (const tp of s.tokens[p.id] ?? []) {
        if (tp >= 0 && tp <= LUDO_LAST_MAIN && absSquare(s.colours[p.id] as number, tp) === sq) caps++;
      }
    }
    if (!isSafe(sq) && caps) score += 50 * caps;
    if (isSafe(sq)) score += 12;
    if (difficulty === 'hard') {
      if (!isSafe(sq) && threatened(s, id, sq)) score -= 25 + to / 4;
      if (from >= 0 && from <= LUDO_LAST_MAIN) {
        const fromSq = absSquare(colour, from);
        if (!isSafe(fromSq) && threatened(s, id, fromSq)) score += 15 + from / 4;
      }
    }
  }
  return score;
}

/** Is an absolute square within 1..6 steps ahead of any opponent token? */
function threatened(s: LudoState, id: PlayerId, sq: number): boolean {
  for (const p of s.players) {
    if (p.id === id) continue;
    const col = s.colours[p.id] as number;
    for (const tp of s.tokens[p.id] ?? []) {
      if (tp < 0 || tp > LUDO_LAST_MAIN) continue;
      for (let k = 1; k <= 6; k++) {
        if (tp + k > LUDO_LAST_MAIN) break;
        if (absSquare(col, tp + k) === sq) return true;
      }
    }
  }
  return false;
}

export const ludo: GameDefinition<LudoConfig, LudoState, LudoAction, LudoView> = {
  meta: { id: 'ludo', minPlayers: 2, maxPlayers: 4, hiddenInfo: false, simultaneous: false, voice: false },

  defaultConfig: () => ({ finishAll: false, turnSeconds: 0 }),

  sanitizeConfig(raw) {
    const r = isObj(raw) ? raw : {};
    return { finishAll: asBool(r.finishAll, false), turnSeconds: clampInt(r.turnSeconds, 0, 120, 0) };
  },

  createGame(config, players, rng: Rng, ctx) {
    if (players.length < 2 || players.length > 4) throw new Error('Ludo needs 2-4 players');
    const seats = seatsFor(players.length);
    const s: LudoState = {
      ...baseState('ludo', players, rng),
      config: ludo.sanitizeConfig(config, players.length),
      colours: Object.fromEntries(players.map((p, i) => [p.id, seats[i] as LudoColour])),
      tokens: Object.fromEntries(players.map((p) => [p.id, [-1, -1, -1, -1]])),
      turn: 0,
      phase: 'roll',
      dice: null,
      sixes: 0,
      ranking: [],
      lastMove: null,
    };
    s.deadline = deadlineIn(ctx, s.config.turnSeconds);
    pushLog(s, 'game.started');
    return s;
  },

  getPublicState: (s) => view(s, null),
  getPlayerView: (s, id) => view(s, hasPlayer(s, id) ? id : null),

  listLegalActions(s, id) {
    if (s.over || current(s) !== id) return [];
    if (s.phase === 'roll') return [{ type: 'roll' }];
    return ludoMovable(s, id, s.dice ?? 0).map((token) => ({ type: 'move', token }));
  },

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (current(state) !== id) return reject('not_your_turn');
    const s = clone(state);
    if (action.type === 'roll') {
      if (s.phase !== 'roll') return reject('wrong_phase');
      doRoll(s, ctx);
      return accept(s);
    }
    if (action.type === 'move') {
      if (s.phase !== 'move') return reject('wrong_phase');
      if (!isInt(action.token) || !ludoMovable(s, id, s.dice ?? 0).includes(action.token)) return reject('illegal_move');
      doMove(s, action.token, ctx);
      return accept(s);
    }
    return reject('unknown_action');
  },

  pendingActors: (s) => (s.over ? [] : [current(s)]),

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    const id = current(s);
    pushLog(s, 'game.timeoutMove', { name: playerName(s, id) });
    if (s.phase === 'roll') doRoll(s, ctx);
    if (!s.over && s.phase === 'move' && current(s) === id) {
      const a = ludo.getBotAction(s, id, 'medium', new Rng(s.rng));
      if (a && a.type === 'move') doMove(s, a.token, ctx);
    }
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,

  scores(s) {
    const out: Record<PlayerId, number> = {};
    const n = s.players.length;
    for (const p of s.players) {
      const rank = s.ranking.indexOf(p.id);
      out[p.id] = (rank >= 0 ? (n - rank) * 100 : 0) + progressOf(s, p.id);
    }
    return out;
  },

  getBotAction(s, botId, difficulty, rng) {
    if (s.over || current(s) !== botId) return null;
    if (s.phase === 'roll') return { type: 'roll' };
    const moves = ludoMovable(s, botId, s.dice ?? 0);
    if (moves.length === 0) return null;
    if (difficulty === 'easy' && rng.chance(0.5)) return { type: 'move', token: rng.pick(moves) };
    let best = -Infinity;
    let bestMoves: number[] = [];
    for (const t of moves) {
      const sc = scoreMove(s, botId, t, s.dice ?? 0, difficulty);
      if (sc > best) {
        best = sc;
        bestMoves = [t];
      } else if (sc === best) bestMoves.push(t);
    }
    return { type: 'move', token: rng.pick(bestMoves) };
  },

  isAction(a): a is LudoAction {
    if (!isObj(a)) return false;
    return a.type === 'roll' || (a.type === 'move' && isInt(a.token));
  },
};

function view(s: LudoState, me: PlayerId | null): LudoView {
  return {
    game: 'ludo',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    waitingFor: ludo.pendingActors(s),
    legal: me ? ludo.listLegalActions(s, me) : [],
    config: clone(s.config),
    colours: clone(s.colours),
    tokens: clone(s.tokens),
    turn: s.turn,
    phase: s.phase,
    dice: s.dice,
    sixes: s.sixes,
    ranking: clone(s.ranking),
    lastMove: clone(s.lastMove),
  };
}
