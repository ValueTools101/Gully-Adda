/**
 * Dots and Boxes (2-4 players, 4x4 or 5x5 boxes).
 * Lines are indexed: horizontal lines first (rows 0..n, cols 0..n-1), then
 * vertical lines (rows 0..n-1, cols 0..n). Completing a box gives an extra turn.
 */
import { Rng } from '../../core/rng';
import type { BaseState, BaseView, GameDefinition, PlayerId } from '../../core/types';
import {
  accept, baseState, clampInt, clone, deadlineIn, hasPlayer, isInt, isObj, playerName, pushLog, reject,
} from '../../core/util';

export interface DotsConfig {
  /** Boxes per side: 4 or 5. */
  size: 4 | 5;
  /** Seconds per turn (0 = no timer). On timeout a bot move is played. */
  turnSeconds: number;
}

export interface DotsState extends BaseState {
  game: 'dots';
  config: DotsConfig;
  /** 1 if drawn, 0 if not. Length 2*n*(n+1). */
  lines: number[];
  /** Who drew each line (-1 = none), for colouring. */
  lineOwner: number[];
  /** Seat index of box owner or -1. Length n*n. */
  boxes: number[];
  turn: number;
  lastLine: number;
}

export type DotsAction = { type: 'line'; line: number };

export interface DotsView extends BaseView {
  game: 'dots';
  config: DotsConfig;
  lines: number[];
  lineOwner: number[];
  boxes: number[];
  turn: number;
  lastLine: number;
  scores: Record<PlayerId, number>;
}

export function dotsLineCount(n: number): number {
  return 2 * n * (n + 1);
}

/** Line index helpers. */
export function hLine(n: number, r: number, c: number): number {
  return r * n + c;
}
export function vLine(n: number, r: number, c: number): number {
  return n * (n + 1) + r * (n + 1) + c;
}

/** The four line indices around box (r, c). */
export function boxLines(n: number, r: number, c: number): [number, number, number, number] {
  return [hLine(n, r, c), hLine(n, r + 1, c), vLine(n, r, c), vLine(n, r, c + 1)];
}

/** Boxes (indices) adjacent to a line. */
export function lineBoxes(n: number, line: number): number[] {
  const out: number[] = [];
  const hCount = n * (n + 1);
  if (line < hCount) {
    const r = Math.floor(line / n);
    const c = line % n;
    if (r > 0) out.push((r - 1) * n + c);
    if (r < n) out.push(r * n + c);
  } else {
    const k = line - hCount;
    const r = Math.floor(k / (n + 1));
    const c = k % (n + 1);
    if (c > 0) out.push(r * n + c - 1);
    if (c < n) out.push(r * n + c);
  }
  return out;
}

function sidesDrawn(lines: number[], n: number, box: number): number {
  const r = Math.floor(box / n);
  const c = box % n;
  return boxLines(n, r, c).reduce((a, l) => a + (lines[l] ? 1 : 0), 0);
}

function countScores(s: DotsState): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  s.players.forEach((p, i) => {
    out[p.id] = s.boxes.filter((b) => b === i).length;
  });
  return out;
}

function freeLines(lines: number[]): number[] {
  const out: number[] = [];
  lines.forEach((v, i) => {
    if (!v) out.push(i);
  });
  return out;
}

/** Number of boxes a line would complete. */
function completes(lines: number[], n: number, line: number): number {
  return lineBoxes(n, line).filter((b) => sidesDrawn(lines, n, b) === 3).length;
}

/** Would drawing this line create a box with 3 sides (gift to opponent)? */
function gives(lines: number[], n: number, line: number): boolean {
  return lineBoxes(n, line).some((b) => sidesDrawn(lines, n, b) === 2);
}

/** Simulate the opponent greedily taking every capturable box after `line`. */
function chainGift(lines: number[], n: number, line: number): number {
  const l = lines.slice();
  l[line] = 1;
  let taken = 0;
  for (;;) {
    const cap = freeLines(l).find((x) => completes(l, n, x) > 0);
    if (cap === undefined) break;
    taken += completes(l, n, cap);
    l[cap] = 1;
  }
  return taken;
}

function applyLine(s: DotsState, line: number): void {
  const n = s.config.size;
  s.lines[line] = 1;
  s.lineOwner[line] = s.turn;
  s.lastLine = line;
  let made = 0;
  for (const b of lineBoxes(n, line)) {
    if (s.boxes[b] === -1 && sidesDrawn(s.lines, n, b) === 4) {
      s.boxes[b] = s.turn;
      made++;
    }
  }
  const me = s.players[s.turn];
  if (made > 0) pushLog(s, 'dots.boxed', { name: me?.name ?? '?', n: made });
  if (s.boxes.every((b) => b !== -1)) {
    s.over = true;
    s.deadline = null;
    const sc = countScores(s);
    const best = Math.max(...Object.values(sc));
    const winners = s.players.filter((p) => sc[p.id] === best).map((p) => p.name);
    pushLog(s, winners.length > 1 ? 'game.tie' : 'game.winner', { name: winners.join(', ') });
    return;
  }
  if (made === 0) s.turn = (s.turn + 1) % s.players.length;
}

export const dots: GameDefinition<DotsConfig, DotsState, DotsAction, DotsView> = {
  meta: { id: 'dots', minPlayers: 2, maxPlayers: 4, hiddenInfo: false, simultaneous: false, voice: false },

  defaultConfig: () => ({ size: 4, turnSeconds: 0 }),

  sanitizeConfig(raw) {
    const r = isObj(raw) ? raw : {};
    return { size: r.size === 5 ? 5 : 4, turnSeconds: clampInt(r.turnSeconds, 0, 120, 0) };
  },

  createGame(config, players, rng: Rng, ctx) {
    if (players.length < 2 || players.length > 4) throw new Error('Dots and Boxes needs 2-4 players');
    const cfg = dots.sanitizeConfig(config, players.length);
    const n = cfg.size;
    const s: DotsState = {
      ...baseState('dots', players, rng),
      config: cfg,
      lines: new Array(dotsLineCount(n)).fill(0),
      lineOwner: new Array(dotsLineCount(n)).fill(-1),
      boxes: new Array(n * n).fill(-1),
      turn: 0,
      lastLine: -1,
    };
    s.deadline = deadlineIn(ctx, cfg.turnSeconds);
    pushLog(s, 'game.started');
    return s;
  },

  getPublicState: (s) => view(s, null),
  getPlayerView: (s, id) => view(s, hasPlayer(s, id) ? id : null),

  listLegalActions(s, id) {
    if (s.over || s.players[s.turn]?.id !== id) return [];
    return freeLines(s.lines).map((line) => ({ type: 'line', line }));
  },

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (state.players[state.turn]?.id !== id) return reject('not_your_turn');
    if (action.type !== 'line') return reject('unknown_action');
    if (!isInt(action.line) || action.line < 0 || action.line >= state.lines.length) return reject('invalid_line');
    if (state.lines[action.line]) return reject('line_taken');
    const s = clone(state);
    applyLine(s, action.line);
    if (!s.over) s.deadline = deadlineIn(ctx, s.config.turnSeconds);
    return accept(s);
  },

  pendingActors: (s) => (s.over ? [] : [s.players[s.turn]?.id ?? '']),

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    const id = s.players[s.turn]?.id ?? '';
    const rng = new Rng(s.rng);
    const a = dots.getBotAction(s, id, 'easy', rng);
    s.rng = rng.state;
    if (a) applyLine(s, a.line);
    pushLog(s, 'game.timeoutMove', { name: playerName(s, id) });
    if (!s.over) s.deadline = deadlineIn(ctx, s.config.turnSeconds);
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,
  scores: countScores,

  getBotAction(s, botId, difficulty, rng) {
    if (s.players[s.turn]?.id !== botId || s.over) return null;
    const n = s.config.size;
    const free = freeLines(s.lines);
    if (free.length === 0) return null;
    const act = (line: number): DotsAction => ({ type: 'line', line });
    if (difficulty === 'easy') {
      const cap = free.filter((l) => completes(s.lines, n, l) > 0);
      if (cap.length && rng.chance(0.6)) return act(rng.pick(cap));
      return act(rng.pick(free));
    }
    const cap = free.filter((l) => completes(s.lines, n, l) > 0);
    if (cap.length) return act(rng.pick(cap));
    const safe = free.filter((l) => !gives(s.lines, n, l));
    if (safe.length) return act(rng.pick(safe));
    if (difficulty === 'medium') return act(rng.pick(free));
    // hard: give away the smallest chain
    let best = Infinity;
    let bestLines: number[] = [];
    for (const l of free) {
      const g = chainGift(s.lines, n, l);
      if (g < best) {
        best = g;
        bestLines = [l];
      } else if (g === best) bestLines.push(l);
    }
    return act(rng.pick(bestLines));
  },

  isAction(a): a is DotsAction {
    return isObj(a) && a.type === 'line' && isInt(a.line);
  },
};

function view(s: DotsState, me: PlayerId | null): DotsView {
  return {
    game: 'dots',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    waitingFor: dots.pendingActors(s),
    legal: me ? dots.listLegalActions(s, me) : [],
    config: clone(s.config),
    lines: s.lines.slice(),
    lineOwner: s.lineOwner.slice(),
    boxes: s.boxes.slice(),
    turn: s.turn,
    lastLine: s.lastLine,
    scores: countScores(s),
  };
}
