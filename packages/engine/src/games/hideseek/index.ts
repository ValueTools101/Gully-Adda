/**
 * Chhupan Chhupai (Hide & Seek), turn-based, 3-8 players.
 *
 * One seeker ("den"), everyone else hides in a spot in the mohalla.
 * Each round, at the same time:
 *   - the seeker searches one spot, or guards the den;
 *   - every hider stays, sneaks to a nearby spot (leaving a public "rustle"
 *     clue about which side of the mohalla they went to), or, from a spot next
 *     to the den, runs in and shouts "Dhappa!" (safe unless the den is guarded).
 * Hiders in the searched spot are found. Matches rotate the seeker.
 * Hider positions are secret: each hider sees only their own spot.
 */
import { Rng } from '../../core/rng';
import type { BaseState, BaseView, GameContext, GameDefinition, PlayerId } from '../../core/types';
import {
  accept, baseState, clampInt, clone, deadlineIn, hasPlayer, isObj, isStr, playerName, pushLog, reject, withRng,
} from '../../core/util';
import { HNS_ADJ, HNS_DIST, HNS_NEAR_DEN, HNS_SPOT_IDS, hnsSpot, type HnsZone } from './town';

export * from './town';

export const DEN = 'den';
export const HNS_POINTS = { foundPerRound: 10, safe: 150, survived: 100, seekerPerCatch: 100 } as const;

export interface HnsConfig {
  /** Seek rounds per match before the hiders win. */
  maxRounds: number;
  /** Matches (the seeker rotates each match). */
  matches: number;
  hideSeconds: number;
  roundSeconds: number;
  revealSeconds: number;
}

export type HnsPhase = 'hide' | 'seek' | 'reveal';
export type HnsStatus = 'hiding' | 'found' | 'safe';
export type HnsSeekerMove = string; // spot id or DEN (guard)
export type HnsHiderMove = { kind: 'stay' } | { kind: 'move'; spot: string } | { kind: 'dhappa' };

export interface HnsSearch {
  round: number;
  /** Spot id, or 'den' when guarding. */
  spot: string;
  found: PlayerId[];
}

export interface HnsClue {
  round: number;
  zone: HnsZone;
  count: number;
}

export interface HnsMatchResult {
  match: number;
  seeker: PlayerId;
  spots: Record<PlayerId, string>;
  status: Record<PlayerId, HnsStatus>;
  points: Record<PlayerId, number>;
}

export interface HnsState extends BaseState {
  game: 'hideseek';
  config: HnsConfig;
  match: number;
  seekerIndex: number;
  phase: HnsPhase;
  round: number;
  /** SECRET: where each hider is. */
  spots: Record<PlayerId, string>;
  status: Record<PlayerId, HnsStatus>;
  /** Round each hider was found (for scoring). */
  foundRound: Record<PlayerId, number>;
  /** SECRET until the round resolves. */
  seekerMove: HnsSeekerMove | null;
  hiderMoves: Record<PlayerId, HnsHiderMove>;
  searches: HnsSearch[];
  clues: HnsClue[];
  acked: PlayerId[];
  totals: Record<PlayerId, number>;
  history: HnsMatchResult[];
}

export type HnsAction =
  | { type: 'hide'; spot: string }
  | { type: 'search'; spot: string }
  | { type: 'guard' }
  | { type: 'stay' }
  | { type: 'move'; spot: string }
  | { type: 'dhappa' }
  | { type: 'ack' };

export interface HnsView extends BaseView {
  game: 'hideseek';
  config: HnsConfig;
  match: number;
  phase: HnsPhase;
  round: number;
  seeker: PlayerId;
  amSeeker: boolean;
  /** Only my own spot (or everyone's once the match is revealed). */
  mySpot: string | null;
  myStatus: HnsStatus | null;
  /** Spots of found players (public), and everyone at reveal. */
  knownSpots: Record<PlayerId, string>;
  status: Record<PlayerId, HnsStatus>;
  searches: HnsSearch[];
  clues: HnsClue[];
  /** What I picked this round (my own secret). */
  myPick: string | null;
  acked: PlayerId[];
  totals: Record<PlayerId, number>;
  history: HnsMatchResult[];
}

function seekerOf(s: HnsState): PlayerId {
  return s.players[s.seekerIndex % s.players.length]?.id ?? '';
}

function activeHiders(s: HnsState): PlayerId[] {
  return s.players.map((p) => p.id).filter((id) => id !== seekerOf(s) && s.status[id] === 'hiding');
}

function startMatch(s: HnsState, ctx: GameContext): void {
  const seeker = seekerOf(s);
  s.phase = 'hide';
  s.round = 0;
  s.spots = {};
  s.status = {};
  s.foundRound = {};
  for (const p of s.players) if (p.id !== seeker) s.status[p.id] = 'hiding';
  s.seekerMove = null;
  s.hiderMoves = {};
  s.searches = [];
  s.clues = [];
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.hideSeconds);
  pushLog(s, 'hns.match', { n: s.match, name: playerName(s, seeker) });
}

function startSeek(s: HnsState, ctx: GameContext): void {
  s.phase = 'seek';
  s.round = 1;
  s.seekerMove = null;
  s.hiderMoves = {};
  s.deadline = deadlineIn(ctx, s.config.roundSeconds);
  pushLog(s, 'hns.ready', { name: playerName(s, seekerOf(s)) });
}

function hiderOptions(s: HnsState, id: PlayerId): HnsAction[] {
  const at = s.spots[id];
  if (!at) return [];
  const out: HnsAction[] = [{ type: 'stay' }];
  for (const n of HNS_ADJ[at] ?? []) out.push({ type: 'move', spot: n });
  if (HNS_NEAR_DEN.includes(at)) out.push({ type: 'dhappa' });
  return out;
}

function pending(s: HnsState): PlayerId[] {
  if (s.over) return [];
  if (s.phase === 'hide') return activeHiders(s).filter((id) => !s.spots[id]);
  if (s.phase === 'seek') {
    const out = s.seekerMove === null ? [seekerOf(s)] : [];
    return out.concat(activeHiders(s).filter((id) => !s.hiderMoves[id]));
  }
  return s.players.map((p) => p.id).filter((id) => !s.acked.includes(id));
}

function resolveRound(s: HnsState, ctx: GameContext): void {
  const seeker = seekerOf(s);
  const target = s.seekerMove ?? DEN;
  const zoneCount = new Map<HnsZone, number>();
  const runners: PlayerId[] = [];
  for (const id of activeHiders(s)) {
    const m = s.hiderMoves[id] ?? { kind: 'stay' };
    if (m.kind === 'move') {
      s.spots[id] = m.spot;
      const z = hnsSpot(m.spot)!.zone;
      zoneCount.set(z, (zoneCount.get(z) ?? 0) + 1);
    } else if (m.kind === 'dhappa') runners.push(id);
  }
  const found: PlayerId[] = [];
  for (const id of runners) {
    if (target === DEN) {
      s.status[id] = 'found';
      s.foundRound[id] = s.round;
      found.push(id);
      pushLog(s, 'hns.caughtAtDen', { name: playerName(s, id), seeker: playerName(s, seeker) });
    } else {
      s.status[id] = 'safe';
      pushLog(s, 'hns.dhappa', { name: playerName(s, id) });
    }
  }
  if (target !== DEN) {
    for (const id of activeHiders(s)) {
      if (s.spots[id] === target) {
        s.status[id] = 'found';
        s.foundRound[id] = s.round;
        found.push(id);
        pushLog(s, 'hns.found', { name: playerName(s, id), spot: target });
      }
    }
    if (!found.length) pushLog(s, 'hns.empty', { spot: target });
  } else if (!runners.length) pushLog(s, 'hns.guardedNobody');
  s.searches.push({ round: s.round, spot: target, found });
  for (const [zone, count] of zoneCount) {
    s.clues.push({ round: s.round, zone, count });
    pushLog(s, 'hns.rustle', { zone, n: count });
  }
  s.seekerMove = null;
  s.hiderMoves = {};
  if (activeHiders(s).length === 0 || s.round >= s.config.maxRounds) endMatch(s, ctx);
  else {
    s.round += 1;
    s.deadline = deadlineIn(ctx, s.config.roundSeconds);
  }
}

function endMatch(s: HnsState, ctx: GameContext): void {
  const seeker = seekerOf(s);
  const points: Record<PlayerId, number> = {};
  let caught = 0;
  for (const p of s.players) {
    if (p.id === seeker) continue;
    const st = s.status[p.id];
    let pts = 0;
    if (st === 'found') {
      caught++;
      pts = HNS_POINTS.foundPerRound * Math.max(0, (s.foundRound[p.id] ?? 1) - 1);
    } else if (st === 'safe') pts = HNS_POINTS.safe;
    else pts = HNS_POINTS.survived;
    points[p.id] = pts;
  }
  points[seeker] = caught * HNS_POINTS.seekerPerCatch;
  for (const [id, pts] of Object.entries(points)) s.totals[id] = (s.totals[id] ?? 0) + pts;
  s.history.push({ match: s.match, seeker, spots: clone(s.spots), status: clone(s.status), points });
  pushLog(s, 'hns.matchOver', { n: caught, name: playerName(s, seeker) });
  s.phase = 'reveal';
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.revealSeconds);
}

function nextMatch(s: HnsState, ctx: GameContext): void {
  if (s.match >= s.config.matches) {
    s.over = true;
    s.deadline = null;
    s.acked = [];
    pushLog(s, 'game.over');
    return;
  }
  s.match += 1;
  s.seekerIndex += 1;
  startMatch(s, ctx);
}

function legalFor(s: HnsState, id: PlayerId): HnsAction[] {
  if (s.over || !pending(s).includes(id)) return [];
  if (s.phase === 'hide') return HNS_SPOT_IDS.map((spot) => ({ type: 'hide', spot }));
  if (s.phase === 'seek') {
    if (id === seekerOf(s)) return [...HNS_SPOT_IDS.map((spot) => ({ type: 'search', spot }) as HnsAction), { type: 'guard' }];
    return hiderOptions(s, id);
  }
  return [{ type: 'ack' }];
}

function view(s: HnsState, me: PlayerId | null): HnsView {
  const seeker = seekerOf(s);
  const known: Record<PlayerId, string> = {};
  if (s.phase === 'reveal' || s.over) Object.assign(known, s.spots);
  else for (const [id, st] of Object.entries(s.status)) if (st === 'found' && s.spots[id]) known[id] = s.spots[id] as string;
  let myPick: string | null = null;
  if (me && s.phase === 'seek') {
    if (me === seeker) myPick = s.seekerMove;
    else {
      const m = s.hiderMoves[me];
      myPick = m ? (m.kind === 'move' ? m.spot : m.kind) : null;
    }
  }
  return {
    game: 'hideseek',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    // Who still has to act is fine to show: every active player must act each round.
    waitingFor: pending(s),
    legal: me ? legalFor(s, me) : [],
    config: clone(s.config),
    match: s.match,
    phase: s.phase,
    round: s.round,
    seeker,
    amSeeker: me === seeker,
    mySpot: me && me !== seeker ? (s.spots[me] ?? null) : null,
    myStatus: me && me !== seeker ? (s.status[me] ?? null) : null,
    knownSpots: known,
    status: clone(s.status),
    searches: clone(s.searches),
    clues: clone(s.clues),
    myPick,
    acked: clone(s.acked),
    totals: clone(s.totals),
    history: clone(s.history),
  };
}

const zoneOf = (spot: string) => hnsSpot(spot)?.zone;

export const hideseek: GameDefinition<HnsConfig, HnsState, HnsAction, HnsView> = {
  meta: { id: 'hideseek', minPlayers: 3, maxPlayers: 8, hiddenInfo: true, simultaneous: true, voice: false },

  // Timers are for online play; local games switch them off (see the app's localConfig).
  defaultConfig: (n) => ({ maxRounds: 8, matches: Math.min(Math.max(n, 3), 4), hideSeconds: 45, roundSeconds: 30, revealSeconds: 15 }),

  sanitizeConfig(raw, n) {
    const r = isObj(raw) ? raw : {};
    return {
      maxRounds: clampInt(r.maxRounds, 3, 15, 8),
      matches: clampInt(r.matches, 1, 8, Math.min(Math.max(n, 3), 4)),
      hideSeconds: clampInt(r.hideSeconds, 0, 120, 0),
      roundSeconds: clampInt(r.roundSeconds, 0, 120, 0),
      revealSeconds: clampInt(r.revealSeconds, 0, 60, 0),
    };
  },

  createGame(config, players, rng: Rng, ctx) {
    if (players.length < 3 || players.length > 8) throw new Error('Hide & Seek needs 3-8 players');
    const s: HnsState = {
      ...baseState('hideseek', players, rng),
      config: hideseek.sanitizeConfig(config, players.length),
      match: 1,
      seekerIndex: rng.int(players.length),
      phase: 'hide',
      round: 0,
      spots: {},
      status: {},
      foundRound: {},
      seekerMove: null,
      hiderMoves: {},
      searches: [],
      clues: [],
      acked: [],
      totals: Object.fromEntries(players.map((p) => [p.id, 0])),
      history: [],
    };
    s.rng = rng.state;
    startMatch(s, ctx);
    return s;
  },

  getPublicState: (s) => view(s, null),
  getPlayerView: (s, id) => view(s, hasPlayer(s, id) ? id : null),
  listLegalActions: legalFor,

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (!hasPlayer(state, id)) return reject('not_in_game');
    if (!pending(state).includes(id)) return reject('not_your_turn');
    const s = clone(state);
    const seeker = seekerOf(s);
    switch (action.type) {
      case 'hide':
        if (s.phase !== 'hide') return reject('wrong_phase');
        if (!HNS_SPOT_IDS.includes(action.spot)) return reject('invalid_spot');
        s.spots[id] = action.spot;
        if (pending(s).length === 0) startSeek(s, ctx);
        return accept(s);
      case 'search':
      case 'guard':
        if (s.phase !== 'seek') return reject('wrong_phase');
        if (id !== seeker) return reject('not_seeker');
        if (action.type === 'search' && !HNS_SPOT_IDS.includes(action.spot)) return reject('invalid_spot');
        s.seekerMove = action.type === 'guard' ? DEN : action.spot;
        break;
      case 'stay':
      case 'move':
      case 'dhappa': {
        if (s.phase !== 'seek') return reject('wrong_phase');
        if (id === seeker) return reject('not_hider');
        const at = s.spots[id] ?? '';
        if (action.type === 'move') {
          if (!(HNS_ADJ[at] ?? []).includes(action.spot)) return reject('too_far');
          s.hiderMoves[id] = { kind: 'move', spot: action.spot };
        } else if (action.type === 'dhappa') {
          if (!HNS_NEAR_DEN.includes(at)) return reject('too_far_from_den');
          s.hiderMoves[id] = { kind: 'dhappa' };
        } else s.hiderMoves[id] = { kind: 'stay' };
        break;
      }
      case 'ack':
        if (s.phase !== 'reveal') return reject('wrong_phase');
        s.acked.push(id);
        if (pending(s).length === 0) nextMatch(s, ctx);
        return accept(s);
      default:
        return reject('unknown_action');
    }
    if (pending(s).length === 0) resolveRound(s, ctx);
    return accept(s);
  },

  pendingActors: pending,

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    if (s.phase === 'hide') {
      for (const id of pending(s)) s.spots[id] = withRng(s, (rng) => rng.pick(HNS_SPOT_IDS));
      startSeek(s, ctx);
    } else if (s.phase === 'seek') {
      if (s.seekerMove === null) s.seekerMove = withRng(s, (rng) => rng.pick(HNS_SPOT_IDS));
      resolveRound(s, ctx); // hiders who didn't choose simply stay
    } else nextMatch(s, ctx);
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,
  scores: (s) => clone(s.totals),

  getBotAction(s, botId, difficulty, rng) {
    const legal = legalFor(s, botId);
    if (!legal.length) return null;
    if (s.phase === 'reveal') return { type: 'ack' };
    if (s.phase === 'hide') {
      // Harder bots hide further from the den on average but not always (predictability is bad).
      const pool = difficulty === 'easy' ? HNS_SPOT_IDS : HNS_SPOT_IDS.filter((id) => rng.chance(0.5) || (HNS_DIST[id] ?? 1) >= 2);
      return { type: 'hide', spot: rng.pick(pool.length ? pool : HNS_SPOT_IDS) };
    }
    const seeker = seekerOf(s);
    const lastSearch = s.searches[s.searches.length - 1];
    if (botId === seeker) {
      const guardP = difficulty === 'easy' ? 0.05 : difficulty === 'medium' ? 0.15 : lastSearch?.spot === DEN ? 0.1 : 0.3;
      if (rng.chance(guardP)) return { type: 'guard' };
      const lastClues = s.clues.filter((c) => c.round === s.round - 1).map((c) => c.zone);
      const recent = new Set(s.searches.filter((x) => x.round >= s.round - 2).map((x) => x.spot));
      const weights = HNS_SPOT_IDS.map((id) => {
        if (difficulty === 'easy') return 1;
        let w = 1;
        if (lastClues.includes(zoneOf(id)!)) w += difficulty === 'hard' ? 4 : 2;
        if (recent.has(id)) w *= 0.25;
        if (difficulty === 'hard' && HNS_NEAR_DEN.includes(id)) w += s.round * 0.3;
        return w;
      });
      let r = rng.next() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i] as number;
        if (r <= 0) return { type: 'search', spot: HNS_SPOT_IDS[i] as string };
      }
      return { type: 'search', spot: rng.pick(HNS_SPOT_IDS) };
    }
    // Hider
    const at = s.spots[botId] ?? '';
    if (HNS_NEAR_DEN.includes(at)) {
      const p = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.45 : lastSearch?.spot === DEN ? 0.15 : 0.55;
      if (rng.chance(p)) return { type: 'dhappa' };
    }
    const danger = !!lastSearch && lastSearch.spot !== DEN && (HNS_ADJ[lastSearch.spot] ?? []).concat(lastSearch.spot).includes(at);
    const moveP = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.35 : danger ? 0.6 : 0.25;
    if (rng.chance(moveP)) {
      const here = HNS_DIST[at] ?? 3;
      const closer = (HNS_ADJ[at] ?? []).filter((n) => (HNS_DIST[n] ?? 3) < here && n !== lastSearch?.spot);
      const options = closer.length ? closer : (HNS_ADJ[at] ?? []);
      if (options.length) return { type: 'move', spot: rng.pick(options) };
    }
    return { type: 'stay' };
  },

  isAction(a): a is HnsAction {
    if (!isObj(a)) return false;
    if (['guard', 'stay', 'dhappa', 'ack'].includes(String(a.type))) return true;
    return ['hide', 'search', 'move'].includes(String(a.type)) && isStr(a.spot, 32);
  },
};

