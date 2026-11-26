/**
 * Name Place Animal Thing.
 * Phases: answer -> (stop pressed) grace -> challenge -> result -> next round.
 * Answers are hidden from other players until the answer phase closes.
 */
import { Rng } from '../../core/rng';
import type { BaseState, BaseView, GameContext, GameDefinition, PlayerId } from '../../core/types';
import {
  accept, asBool, baseState, clampInt, clone, deadlineIn, hasPlayer, isObj, isStr, playerName, pushLog, reject, withRng,
} from '../../core/util';
import { botWords } from './words';

export const NPAT_DEFAULT_CATEGORIES = ['name', 'place', 'animal', 'thing'];
export const NPAT_EXTRA_CATEGORIES = ['food', 'movie', 'colour', 'brand', 'city'];
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY'.split(''); // skip Q, X, Z (too hard)
export const NPAT_POINTS = { unique: 10, duplicate: 5, invalid: 0 } as const;
export const NPAT_MAX_ANSWER = 40;

export interface NpatConfig {
  categories: string[];
  rounds: number;
  /** Seconds to write answers (0 = no timer; pass-and-play uses UI timer). */
  roundSeconds: number;
  /** Seconds others get after someone presses Stop. */
  graceSeconds: number;
  /** Seconds for challenge voting (0 = no timer). */
  challengeSeconds: number;
  challenges: boolean;
}

export type NpatPhase = 'answer' | 'challenge' | 'result';

export interface NpatCell {
  answer: string;
  /** Starts with the letter and looks like a word. */
  valid: boolean;
  rejected: boolean;
  points: number;
}

export interface NpatRound {
  letter: string;
  cells: Record<PlayerId, Record<string, NpatCell>>;
}

export interface NpatState extends BaseState {
  game: 'npat';
  config: NpatConfig;
  round: number;
  letter: string;
  usedLetters: string[];
  phase: NpatPhase;
  /** Secret until the answer phase closes. */
  answers: Record<PlayerId, Record<string, string>>;
  submitted: PlayerId[];
  stoppedBy: PlayerId | null;
  /** votes[target][category] = voters who want to reject it. */
  votes: Record<PlayerId, Record<string, PlayerId[]>>;
  ready: PlayerId[];
  totals: Record<PlayerId, number>;
  history: NpatRound[];
}

export type NpatAction =
  | { type: 'answer'; answers: Record<string, string> }
  | { type: 'submit' }
  | { type: 'stop' }
  | { type: 'challenge'; target: PlayerId; category: string; reject: boolean }
  | { type: 'ready' };

export interface NpatView extends BaseView {
  game: 'npat';
  config: NpatConfig;
  round: number;
  letter: string;
  phase: NpatPhase;
  myAnswers: Record<string, string>;
  /** Everyone's answers; only filled once answers are revealed. */
  revealed: Record<PlayerId, Record<string, string>>;
  submitted: PlayerId[];
  stoppedBy: PlayerId | null;
  votes: Record<PlayerId, Record<string, PlayerId[]>>;
  ready: PlayerId[];
  totals: Record<PlayerId, number>;
  history: NpatRound[];
}

export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isValidAnswer(answer: string, letter: string): boolean {
  const a = normalizeAnswer(answer);
  if (a.length < 2) return false;
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(a)) return false;
  return a[0] === letter.toLowerCase();
}

function pickLetter(s: NpatState): string {
  const left = LETTERS.filter((l) => !s.usedLetters.includes(l));
  const pool = left.length ? left : LETTERS;
  const l = withRng(s, (rng) => rng.pick(pool));
  s.usedLetters.push(l);
  return l;
}

function startRound(s: NpatState, ctx: GameContext): void {
  s.letter = pickLetter(s);
  s.phase = 'answer';
  s.answers = Object.fromEntries(s.players.map((p) => [p.id, Object.fromEntries(s.config.categories.map((c) => [c, '']))]));
  s.submitted = [];
  s.stoppedBy = null;
  s.votes = {};
  s.ready = [];
  s.deadline = deadlineIn(ctx, s.config.roundSeconds);
  pushLog(s, 'npat.letter', { n: s.round, letter: s.letter });
}

function computeCells(s: NpatState): Record<PlayerId, Record<string, NpatCell>> {
  return scoreNpat(s.players.map((p) => p.id), s.config.categories, s.letter, s.answers, s.votes);
}

/**
 * Score one round. Exported so the UI can preview scores from a view
 * during the challenge step (answers are public by then).
 */
export function scoreNpat(
  playerIds: PlayerId[],
  categories: string[],
  letter: string,
  answers: Record<PlayerId, Record<string, string>>,
  votes: Record<PlayerId, Record<string, PlayerId[]>>,
): Record<PlayerId, Record<string, NpatCell>> {
  const cells: Record<PlayerId, Record<string, NpatCell>> = {};
  const others = playerIds.length - 1;
  for (const id of playerIds) {
    cells[id] = {};
    for (const c of categories) {
      const answer = answers[id]?.[c] ?? '';
      const voters = votes[id]?.[c] ?? [];
      const rejected = others > 0 && voters.length * 2 > others;
      (cells[id] as Record<string, NpatCell>)[c] = { answer, valid: isValidAnswer(answer, letter), rejected, points: 0 };
    }
  }
  const s = { players: playerIds.map((id) => ({ id })), config: { categories } };
  for (const c of s.config.categories) {
    const counts = new Map<string, number>();
    for (const p of s.players) {
      const cell = cells[p.id]?.[c];
      if (cell && cell.valid && !cell.rejected) {
        const k = normalizeAnswer(cell.answer);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    for (const p of s.players) {
      const cell = cells[p.id]?.[c];
      if (!cell) continue;
      if (!cell.valid || cell.rejected) cell.points = NPAT_POINTS.invalid;
      else cell.points = (counts.get(normalizeAnswer(cell.answer)) ?? 0) > 1 ? NPAT_POINTS.duplicate : NPAT_POINTS.unique;
    }
  }
  return cells;
}

function closeAnswers(s: NpatState, ctx: GameContext): void {
  if (s.config.challenges && s.players.length > 1) {
    s.phase = 'challenge';
    s.ready = [];
    s.deadline = deadlineIn(ctx, s.config.challengeSeconds);
    pushLog(s, 'npat.challengeTime');
  } else finishRound(s, ctx);
}

function finishRound(s: NpatState, ctx: GameContext): void {
  const cells = computeCells(s);
  for (const p of s.players) {
    const pts = Object.values(cells[p.id] ?? {}).reduce((a, c) => a + c.points, 0);
    s.totals[p.id] = (s.totals[p.id] ?? 0) + pts;
  }
  s.history.push({ letter: s.letter, cells });
  s.phase = 'result';
  s.ready = [];
  s.deadline = deadlineIn(ctx, s.config.challengeSeconds > 0 ? 10 : 0);
  pushLog(s, 'npat.roundDone', { n: s.round });
}

function nextRound(s: NpatState, ctx: GameContext): void {
  if (s.round >= s.config.rounds) {
    s.over = true;
    s.deadline = null;
    pushLog(s, 'game.over');
    return;
  }
  s.round += 1;
  startRound(s, ctx);
}

function pending(s: NpatState): PlayerId[] {
  if (s.over) return [];
  const ids = s.players.map((p) => p.id);
  if (s.phase === 'answer') return ids.filter((id) => !s.submitted.includes(id));
  return ids.filter((id) => !s.ready.includes(id));
}

function cleanAnswers(cats: string[], raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of cats) {
    const v = raw[c];
    out[c] = typeof v === 'string' ? v.slice(0, NPAT_MAX_ANSWER).replace(/[\u0000-\u001f]/g, '') : '';
  }
  return out;
}

export const npat: GameDefinition<NpatConfig, NpatState, NpatAction, NpatView> = {
  meta: { id: 'npat', minPlayers: 2, maxPlayers: 10, hiddenInfo: true, simultaneous: true, voice: false },

  defaultConfig: () => ({
    categories: NPAT_DEFAULT_CATEGORIES.slice(),
    rounds: 5,
    roundSeconds: 60,
    graceSeconds: 5,
    challengeSeconds: 30,
    challenges: true,
  }),

  sanitizeConfig(raw) {
    const r = isObj(raw) ? raw : {};
    let cats = Array.isArray(r.categories)
      ? r.categories.filter((c): c is string => typeof c === 'string').map((c) => c.trim().toLowerCase().slice(0, 16)).filter((c) => /^[a-z][a-z ]*$/.test(c))
      : NPAT_DEFAULT_CATEGORIES.slice();
    cats = Array.from(new Set(cats)).slice(0, 8);
    if (cats.length === 0) cats = NPAT_DEFAULT_CATEGORIES.slice();
    return {
      categories: cats,
      rounds: clampInt(r.rounds, 1, 15, 5),
      roundSeconds: clampInt(r.roundSeconds, 0, 300, 60),
      graceSeconds: clampInt(r.graceSeconds, 0, 30, 5),
      challengeSeconds: clampInt(r.challengeSeconds, 0, 120, 30),
      challenges: asBool(r.challenges, true),
    };
  },

  createGame(config, players, rng: Rng, ctx) {
    if (players.length < 2 || players.length > 10) throw new Error('NPAT needs 2-10 players');
    const s: NpatState = {
      ...baseState('npat', players, rng),
      config: npat.sanitizeConfig(config, players.length),
      round: 1,
      letter: 'A',
      usedLetters: [],
      phase: 'answer',
      answers: {},
      submitted: [],
      stoppedBy: null,
      votes: {},
      ready: [],
      totals: Object.fromEntries(players.map((p) => [p.id, 0])),
      history: [],
    };
    startRound(s, ctx);
    return s;
  },

  getPublicState: (s) => view(s, null),
  getPlayerView: (s, id) => view(s, hasPlayer(s, id) ? id : null),

  listLegalActions(s, id) {
    if (s.over || !hasPlayer(s, id)) return [];
    if (s.phase === 'answer') {
      if (s.submitted.includes(id)) return [];
      const acts: NpatAction[] = [{ type: 'answer', answers: s.answers[id] ?? {} }, { type: 'submit' }];
      const mine = s.answers[id] ?? {};
      if (!s.stoppedBy && s.config.categories.every((c) => (mine[c] ?? '').trim().length > 0)) acts.push({ type: 'stop' });
      return acts;
    }
    if (s.ready.includes(id)) return [];
    if (s.phase === 'challenge') {
      const acts: NpatAction[] = [{ type: 'ready' }];
      for (const p of s.players) {
        if (p.id === id) continue;
        for (const c of s.config.categories) {
          if ((s.answers[p.id]?.[c] ?? '').trim()) {
            const has = (s.votes[p.id]?.[c] ?? []).includes(id);
            acts.push({ type: 'challenge', target: p.id, category: c, reject: !has });
          }
        }
      }
      return acts;
    }
    return [{ type: 'ready' }];
  },

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (!hasPlayer(state, id)) return reject('not_in_game');
    const s = clone(state);
    switch (action.type) {
      case 'answer': {
        if (s.phase !== 'answer') return reject('wrong_phase');
        if (s.submitted.includes(id)) return reject('already_submitted');
        s.answers[id] = cleanAnswers(s.config.categories, action.answers);
        return accept(s);
      }
      case 'submit':
      case 'stop': {
        if (s.phase !== 'answer') return reject('wrong_phase');
        if (s.submitted.includes(id)) return reject('already_submitted');
        if (action.type === 'stop') {
          if (s.stoppedBy) return reject('already_stopped');
          const mine = s.answers[id] ?? {};
          if (!s.config.categories.every((c) => (mine[c] ?? '').trim())) return reject('fill_all_first');
          s.stoppedBy = id;
          pushLog(s, 'npat.stop', { name: playerName(s, id) });
          const grace = deadlineIn(ctx, s.config.graceSeconds);
          if (grace !== null && (s.deadline === null || grace < s.deadline)) s.deadline = grace;
        }
        s.submitted.push(id);
        if (s.submitted.length >= s.players.length || (action.type === 'stop' && s.config.graceSeconds === 0)) closeAnswers(s, ctx);
        return accept(s);
      }
      case 'challenge': {
        if (s.phase !== 'challenge') return reject('wrong_phase');
        if (s.ready.includes(id)) return reject('already_ready');
        if (action.target === id) return reject('cannot_challenge_self');
        if (!hasPlayer(s, action.target) || !s.config.categories.includes(action.category)) return reject('invalid_target');
        const byCat = (s.votes[action.target] ??= {});
        const list = (byCat[action.category] ??= []);
        const i = list.indexOf(id);
        if (action.reject && i < 0) list.push(id);
        if (!action.reject && i >= 0) list.splice(i, 1);
        return accept(s);
      }
      case 'ready': {
        if (s.phase === 'answer') return reject('wrong_phase');
        if (s.ready.includes(id)) return reject('already_ready');
        s.ready.push(id);
        if (s.ready.length >= s.players.length) {
          if (s.phase === 'challenge') finishRound(s, ctx);
          else nextRound(s, ctx);
        }
        return accept(s);
      }
      default:
        return reject('unknown_action');
    }
  },

  pendingActors: pending,

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    if (s.phase === 'answer') {
      s.submitted = s.players.map((p) => p.id);
      closeAnswers(s, ctx);
    } else if (s.phase === 'challenge') finishRound(s, ctx);
    else nextRound(s, ctx);
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,
  scores: (s) => clone(s.totals),

  getBotAction(s, botId, difficulty, rng) {
    if (s.over || !pending(s).includes(botId)) return null;
    if (s.phase === 'answer') {
      const mine = s.answers[botId] ?? {};
      const blank = s.config.categories.every((c) => !(mine[c] ?? ''));
      if (blank) {
        const fill = difficulty === 'easy' ? 0.5 : difficulty === 'medium' ? 0.75 : 0.95;
        const answers: Record<string, string> = {};
        for (const c of s.config.categories) {
          const words = botWords(c, s.letter);
          answers[c] = words.length && rng.chance(fill) ? rng.pick(words) : '';
        }
        if (Object.values(answers).some(Boolean)) return { type: 'answer', answers };
      }
      return { type: 'submit' };
    }
    if (s.phase === 'challenge') {
      // Bots only challenge answers that are obviously junk (no vowels, repeated letters).
      for (const p of s.players) {
        if (p.id === botId) continue;
        for (const c of s.config.categories) {
          const a = normalizeAnswer(s.answers[p.id]?.[c] ?? '');
          const junk = a.length >= 2 && (!/[aeiouy]/.test(a) || /(.)\1\1/.test(a));
          const already = (s.votes[p.id]?.[c] ?? []).includes(botId);
          if (junk && !already && isValidAnswer(a, s.letter)) return { type: 'challenge', target: p.id, category: c, reject: true };
        }
      }
      return { type: 'ready' };
    }
    return { type: 'ready' };
  },

  isAction(a): a is NpatAction {
    if (!isObj(a)) return false;
    switch (a.type) {
      case 'answer':
        return isObj(a.answers) && Object.keys(a.answers).length <= 8 && Object.values(a.answers).every((v) => isStr(v, NPAT_MAX_ANSWER));
      case 'submit':
      case 'stop':
      case 'ready':
        return true;
      case 'challenge':
        return isStr(a.target, 128) && isStr(a.category, 16) && typeof a.reject === 'boolean';
      default:
        return false;
    }
  },
};

function view(s: NpatState, me: PlayerId | null): NpatView {
  const hidden = s.phase === 'answer' && !s.over;
  return {
    game: 'npat',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    waitingFor: pending(s),
    legal: me ? npat.listLegalActions(s, me) : [],
    config: clone(s.config),
    round: s.round,
    letter: s.letter,
    phase: s.phase,
    myAnswers: me ? clone(s.answers[me] ?? {}) : {},
    revealed: hidden ? {} : clone(s.answers),
    submitted: clone(s.submitted),
    stoppedBy: s.stoppedBy,
    votes: hidden ? {} : clone(s.votes),
    ready: clone(s.ready),
    totals: clone(s.totals),
    history: clone(s.history),
  };
}
