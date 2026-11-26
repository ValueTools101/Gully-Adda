/**
 * Mafia (5-12 players). The engine is the narrator.
 * Phases: roles (everyone checks their card) -> night (mafia pick a victim,
 * doctor saves, detective checks) -> day (discussion) -> vote -> night ...
 * Win: all mafia gone (village) or mafia >= everyone else (mafia).
 */
import { Rng } from '../../core/rng';
import type {
  BaseState, BaseView, ChatPolicy, GameContext, GameDefinition, PlayerId,
} from '../../core/types';
import {
  accept, asBool, baseState, clampInt, clone, deadlineIn, hasPlayer, isObj, isStr, playerName, pushLog, reject, withRng,
} from '../../core/util';

export type MafiaRole = 'mafia' | 'doctor' | 'detective' | 'villager';
export type MafiaPhase = 'roles' | 'night' | 'day' | 'vote';
export type MafiaWinner = 'mafia' | 'village' | 'draw' | null;
export const SKIP = '__skip__';

export interface MafiaConfig {
  mafiaCount: number;
  doctor: boolean;
  detective: boolean;
  nightSeconds: number;
  daySeconds: number;
  voteSeconds: number;
  /** Show the role of eliminated players to everyone. */
  revealOnDeath: boolean;
}

export interface MafiaDeath {
  id: PlayerId;
  day: number;
  cause: 'night' | 'vote';
  /** Only set when revealOnDeath is on (or the game is over). */
  role: MafiaRole | null;
}

export interface MafiaCheck {
  night: number;
  target: PlayerId;
  isMafia: boolean;
}

export interface MafiaState extends BaseState {
  game: 'mafia';
  config: MafiaConfig;
  roles: Record<PlayerId, MafiaRole>;
  alive: PlayerId[];
  phase: MafiaPhase;
  day: number;
  acked: PlayerId[];
  mafiaVotes: Record<PlayerId, PlayerId>;
  save: PlayerId | null;
  check: PlayerId | null;
  lastSave: PlayerId | null;
  checks: MafiaCheck[];
  votes: Record<PlayerId, PlayerId>;
  /** Public morning news. */
  lastNight: { killed: PlayerId | null; saved: boolean } | null;
  lastVote: { eliminated: PlayerId | null; tally: Record<PlayerId, number>; votes: Record<PlayerId, PlayerId> } | null;
  deaths: MafiaDeath[];
  winner: MafiaWinner;
}

export type MafiaAction =
  | { type: 'ack' }
  | { type: 'kill'; target: PlayerId }
  | { type: 'save'; target: PlayerId }
  | { type: 'check'; target: PlayerId }
  | { type: 'ready' }
  | { type: 'vote'; target: PlayerId };

export interface MafiaView extends BaseView {
  game: 'mafia';
  config: MafiaConfig;
  phase: MafiaPhase;
  day: number;
  myRole: MafiaRole | null;
  amAlive: boolean;
  alive: PlayerId[];
  /** Roles this player is allowed to know (own, fellow mafia, revealed deaths, all at end). */
  knownRoles: Record<PlayerId, MafiaRole>;
  acked: PlayerId[];
  /** Mafia-only: teammates' current night picks. */
  mafiaVotes: Record<PlayerId, PlayerId>;
  /** Doctor-only. */
  mySave: PlayerId | null;
  lastSave: PlayerId | null;
  /** Detective-only. */
  myChecks: MafiaCheck[];
  myCheckTonight: PlayerId | null;
  /** Who has voted (not for whom) during the vote. */
  voted: PlayerId[];
  myVote: PlayerId | null;
  lastNight: MafiaState['lastNight'];
  lastVote: MafiaState['lastVote'];
  deaths: MafiaDeath[];
  winner: MafiaWinner;
  roleCounts: Record<MafiaRole, number>;
}

export function defaultMafiaCount(n: number): number {
  if (n <= 6) return 1;
  if (n <= 9) return 2;
  return 3;
}

const MAX_DAYS = 40;

function aliveWith(s: MafiaState, role: MafiaRole): PlayerId[] {
  return s.alive.filter((id) => s.roles[id] === role);
}

function roleCounts(s: MafiaState): Record<MafiaRole, number> {
  const c: Record<MafiaRole, number> = { mafia: 0, doctor: 0, detective: 0, villager: 0 };
  for (const r of Object.values(s.roles)) c[r]++;
  return c;
}

function pending(s: MafiaState): PlayerId[] {
  if (s.over) return [];
  switch (s.phase) {
    case 'roles':
      return s.players.map((p) => p.id).filter((id) => !s.acked.includes(id));
    case 'night': {
      // Only roles that still have a valid target are waited on (e.g. a detective who has checked everyone).
      const out = aliveWith(s, 'mafia').filter((id) => !(id in s.mafiaVotes) && validNightTargets(s, id, 'kill').length > 0);
      if (s.save === null) out.push(...aliveWith(s, 'doctor').filter((id) => validNightTargets(s, id, 'save').length > 0));
      if (s.check === null) out.push(...aliveWith(s, 'detective').filter((id) => validNightTargets(s, id, 'check').length > 0));
      return out;
    }
    case 'day':
      return s.alive.filter((id) => !s.acked.includes(id));
    case 'vote':
      return s.alive.filter((id) => !(id in s.votes));
  }
}

function checkWin(s: MafiaState): boolean {
  const m = aliveWith(s, 'mafia').length;
  const others = s.alive.length - m;
  let w: MafiaWinner = null;
  if (m === 0) w = 'village';
  else if (m >= others) w = 'mafia';
  else if (s.day > MAX_DAYS) w = 'draw';
  if (!w) return false;
  s.winner = w;
  s.over = true;
  s.deadline = null;
  for (const d of s.deaths) d.role = s.roles[d.id] ?? null;
  pushLog(s, `mafia.win.${w}`);
  return true;
}

function kill(s: MafiaState, id: PlayerId, cause: 'night' | 'vote'): void {
  s.alive = s.alive.filter((x) => x !== id);
  s.deaths.push({ id, day: s.day, cause, role: s.config.revealOnDeath ? (s.roles[id] ?? null) : null });
}

function startNight(s: MafiaState, ctx: GameContext): void {
  s.phase = 'night';
  s.mafiaVotes = {};
  s.save = null;
  s.check = null;
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.nightSeconds);
  pushLog(s, 'mafia.night', { n: s.day });
  if (pending(s).length === 0) resolveNight(s, ctx);
}

function resolveNight(s: MafiaState, ctx: GameContext): void {
  // Mafia target: plurality of mafia picks; ties broken at random.
  const tally = new Map<PlayerId, number>();
  for (const t of Object.values(s.mafiaVotes)) tally.set(t, (tally.get(t) ?? 0) + 1);
  let target: PlayerId | null = null;
  if (tally.size) {
    const max = Math.max(...tally.values());
    const top = [...tally.entries()].filter(([, v]) => v === max).map(([k]) => k);
    target = withRng(s, (rng) => rng.pick(top));
  }
  if (s.check !== null) {
    s.checks.push({ night: s.day, target: s.check, isMafia: s.roles[s.check] === 'mafia' });
  }
  const saved = target !== null && target === s.save;
  if (target && !saved) kill(s, target, 'night');
  s.lastNight = { killed: saved ? null : target, saved };
  s.lastSave = s.save;
  pushLog(s, target && !saved ? 'mafia.killed' : 'mafia.quietNight', { name: target && !saved ? playerName(s, target) : '' });
  if (checkWin(s)) return;
  s.phase = 'day';
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.daySeconds);
  pushLog(s, 'mafia.day', { n: s.day });
}

function startVote(s: MafiaState, ctx: GameContext): void {
  s.phase = 'vote';
  s.votes = {};
  s.acked = [];
  s.deadline = deadlineIn(ctx, s.config.voteSeconds);
  pushLog(s, 'mafia.voteTime');
}

function resolveVote(s: MafiaState, ctx: GameContext): void {
  const tally: Record<PlayerId, number> = {};
  for (const t of Object.values(s.votes)) if (t !== SKIP) tally[t] = (tally[t] ?? 0) + 1;
  const entries = Object.entries(tally);
  let eliminated: PlayerId | null = null;
  if (entries.length) {
    const max = Math.max(...entries.map(([, v]) => v));
    const top = entries.filter(([, v]) => v === max);
    const skips = Object.values(s.votes).filter((t) => t === SKIP).length;
    if (top.length === 1 && max > skips) eliminated = (top[0] as [string, number])[0];
  }
  s.lastVote = { eliminated, tally, votes: clone(s.votes) };
  if (eliminated) {
    kill(s, eliminated, 'vote');
    pushLog(s, 'mafia.eliminated', { name: playerName(s, eliminated) });
  } else pushLog(s, 'mafia.noElimination');
  s.votes = {};
  if (checkWin(s)) return;
  s.day += 1;
  if (checkWin(s)) return;
  startNight(s, ctx);
}

function validNightTargets(s: MafiaState, id: PlayerId, type: 'kill' | 'save' | 'check'): PlayerId[] {
  if (type === 'kill') return s.alive.filter((t) => s.roles[t] !== 'mafia');
  if (type === 'save') return s.alive.filter((t) => t !== s.lastSave);
  return s.alive.filter((t) => t !== id && !s.checks.some((c) => c.target === t));
}

export const mafia: GameDefinition<MafiaConfig, MafiaState, MafiaAction, MafiaView> = {
  meta: { id: 'mafia', minPlayers: 5, maxPlayers: 12, recommendedMin: 6, hiddenInfo: true, simultaneous: true, voice: true },

  defaultConfig: (n) => ({
    mafiaCount: defaultMafiaCount(n),
    doctor: true,
    detective: true,
    nightSeconds: 45,
    daySeconds: 120,
    voteSeconds: 45,
    revealOnDeath: true,
  }),

  sanitizeConfig(raw, n) {
    const r = isObj(raw) ? raw : {};
    const maxMafia = Math.max(1, Math.floor((n - 1) / 2));
    return {
      mafiaCount: clampInt(r.mafiaCount, 1, maxMafia, Math.min(maxMafia, defaultMafiaCount(n))),
      doctor: asBool(r.doctor, true),
      detective: asBool(r.detective, true),
      nightSeconds: clampInt(r.nightSeconds, 0, 300, 45),
      daySeconds: clampInt(r.daySeconds, 0, 900, 120),
      voteSeconds: clampInt(r.voteSeconds, 0, 300, 45),
      revealOnDeath: asBool(r.revealOnDeath, true),
    };
  },

  createGame(config, players, rng: Rng, ctx) {
    const n = players.length;
    if (n < 5 || n > 12) throw new Error('Mafia needs 5-12 players');
    const cfg = mafia.sanitizeConfig(config, n);
    const deck: MafiaRole[] = [];
    for (let i = 0; i < cfg.mafiaCount; i++) deck.push('mafia');
    if (cfg.doctor) deck.push('doctor');
    if (cfg.detective) deck.push('detective');
    while (deck.length < n) deck.push('villager');
    const shuffled = rng.shuffle(deck);
    const s: MafiaState = {
      ...baseState('mafia', players, rng),
      config: cfg,
      roles: Object.fromEntries(players.map((p, i) => [p.id, shuffled[i] as MafiaRole])),
      alive: players.map((p) => p.id),
      phase: 'roles',
      day: 1,
      acked: [],
      mafiaVotes: {},
      save: null,
      check: null,
      lastSave: null,
      checks: [],
      votes: {},
      lastNight: null,
      lastVote: null,
      deaths: [],
      winner: null,
    };
    s.rng = rng.state;
    s.deadline = deadlineIn(ctx, cfg.nightSeconds > 0 ? 20 : 0);
    pushLog(s, 'mafia.rolesDealt');
    return s;
  },

  getPublicState: (s) => view(s, null),
  getPlayerView: (s, id) => view(s, hasPlayer(s, id) ? id : null),

  listLegalActions(s, id) {
    if (s.over || !pending(s).includes(id)) return [];
    switch (s.phase) {
      case 'roles':
        return [{ type: 'ack' }];
      case 'night': {
        const role = s.roles[id];
        const type = role === 'mafia' ? 'kill' : role === 'doctor' ? 'save' : role === 'detective' ? 'check' : null;
        if (!type) return [];
        return validNightTargets(s, id, type).map((target) => ({ type, target }) as MafiaAction);
      }
      case 'day':
        return [{ type: 'ready' }];
      case 'vote':
        return [...s.alive.filter((t) => t !== id), SKIP].map((target) => ({ type: 'vote', target }) as MafiaAction);
    }
  },

  applyAction(state, id, action, ctx) {
    if (state.over) return reject('game_over');
    if (!hasPlayer(state, id)) return reject('not_in_game');
    if (!pending(state).includes(id)) return reject('not_your_turn');
    const s = clone(state);
    const role = s.roles[id];
    switch (action.type) {
      case 'ack':
        if (s.phase !== 'roles') return reject('wrong_phase');
        s.acked.push(id);
        if (pending(s).length === 0) startNight(s, ctx);
        return accept(s);
      case 'kill':
      case 'save':
      case 'check': {
        if (s.phase !== 'night') return reject('wrong_phase');
        const need = action.type === 'kill' ? 'mafia' : action.type === 'save' ? 'doctor' : 'detective';
        if (role !== need) return reject('wrong_role');
        if (!validNightTargets(s, id, action.type).includes(action.target)) return reject('invalid_target');
        if (action.type === 'kill') s.mafiaVotes[id] = action.target;
        else if (action.type === 'save') s.save = action.target;
        else s.check = action.target;
        if (pending(s).length === 0) resolveNight(s, ctx);
        return accept(s);
      }
      case 'ready':
        if (s.phase !== 'day') return reject('wrong_phase');
        s.acked.push(id);
        if (pending(s).length === 0) startVote(s, ctx);
        return accept(s);
      case 'vote':
        if (s.phase !== 'vote') return reject('wrong_phase');
        if (action.target !== SKIP && (!s.alive.includes(action.target) || action.target === id)) return reject('invalid_target');
        s.votes[id] = action.target;
        if (pending(s).length === 0) resolveVote(s, ctx);
        return accept(s);
      default:
        return reject('unknown_action');
    }
  },

  pendingActors: pending,

  onTimeout(state, ctx) {
    if (state.over) return state;
    const s = clone(state);
    switch (s.phase) {
      case 'roles':
        startNight(s, ctx);
        break;
      case 'night': {
        // Sleepy mafia: if nobody picked, the night still claims someone at random.
        if (Object.keys(s.mafiaVotes).length === 0) {
          const killers = aliveWith(s, 'mafia');
          const targets = validNightTargets(s, killers[0] ?? '', 'kill');
          if (killers[0] && targets.length) s.mafiaVotes[killers[0]] = withRng(s, (rng) => rng.pick(targets));
        }
        resolveNight(s, ctx);
        break;
      }
      case 'day':
        startVote(s, ctx);
        break;
      case 'vote':
        resolveVote(s, ctx);
        break;
    }
    s.version += 1;
    return s;
  },

  isGameOver: (s) => s.over,

  scores(s) {
    const out: Record<PlayerId, number> = {};
    for (const p of s.players) {
      const team = s.roles[p.id] === 'mafia' ? 'mafia' : 'village';
      const won = s.winner === team;
      out[p.id] = (won ? 100 : 0) + (s.alive.includes(p.id) ? 20 : 0);
    }
    return out;
  },

  getBotAction(s, botId, difficulty, rng) {
    const legal = mafia.listLegalActions(s, botId);
    if (legal.length === 0) return null;
    const role = s.roles[botId];
    if (s.phase === 'roles' || s.phase === 'day') return legal[0] ?? null;
    if (s.phase === 'night') {
      if (role === 'mafia' && difficulty !== 'easy') {
        const mates = Object.values(s.mafiaVotes);
        const agreed = legal.find((a) => 'target' in a && mates.includes(a.target));
        if (agreed) return agreed;
      }
      if (role === 'doctor' && difficulty === 'hard' && rng.chance(0.4)) {
        const self = legal.find((a) => 'target' in a && a.target === botId);
        if (self) return self;
      }
      return rng.pick(legal);
    }
    // vote
    const targets = legal.filter((a): a is { type: 'vote'; target: PlayerId } => a.type === 'vote' && a.target !== SKIP);
    if (role === 'detective') {
      const known = s.checks.find((c) => c.isMafia && s.alive.includes(c.target));
      if (known) return { type: 'vote', target: known.target };
    }
    if (difficulty === 'easy' && rng.chance(0.2)) return { type: 'vote', target: SKIP };
    let pool = targets;
    if (role === 'mafia') pool = targets.filter((a) => s.roles[a.target] !== 'mafia');
    if (difficulty !== 'easy') {
      const tally = new Map<PlayerId, number>();
      for (const t of Object.values(s.votes)) if (t !== SKIP) tally.set(t, (tally.get(t) ?? 0) + 1);
      const leader = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
      if (leader && pool.some((a) => a.target === leader[0]) && rng.chance(0.6)) return { type: 'vote', target: leader[0] };
    }
    return pool.length ? rng.pick(pool) : { type: 'vote', target: SKIP };
  },

  isAction(a): a is MafiaAction {
    if (!isObj(a)) return false;
    if (a.type === 'ack' || a.type === 'ready') return true;
    return ['kill', 'save', 'check', 'vote'].includes(String(a.type)) && isStr(a.target, 128);
  },

  chatPolicy(s, id): ChatPolicy {
    if (s.over) return { canRead: ['all', 'living', 'dead', 'mafia'], canWrite: ['all'], canSpeak: true, canListen: true };
    const alive = s.alive.includes(id);
    if (!alive) return { canRead: ['living', 'dead'], canWrite: ['dead'], canSpeak: false, canListen: true };
    const isMafia = s.roles[id] === 'mafia';
    const talkPhase = s.phase === 'day' || s.phase === 'vote';
    return {
      canRead: isMafia ? ['living', 'mafia'] : ['living'],
      canWrite: talkPhase ? ['living'] : isMafia && s.phase === 'night' ? ['mafia'] : [],
      canSpeak: talkPhase,
      canListen: true,
    };
  },
};

function view(s: MafiaState, me: PlayerId | null): MafiaView {
  const myRole = me ? (s.roles[me] ?? null) : null;
  const amAlive = !!me && s.alive.includes(me);
  const known: Record<PlayerId, MafiaRole> = {};
  if (s.over) Object.assign(known, s.roles);
  else {
    for (const d of s.deaths) if (d.role) known[d.id] = d.role;
    if (me && myRole) known[me] = myRole;
    // Living mafia know their team. Dead players get a limited view: only their own role.
    if (myRole === 'mafia' && amAlive) for (const id of Object.keys(s.roles)) if (s.roles[id] === 'mafia') known[id] = 'mafia';
  }
  const seesMafiaVotes = myRole === 'mafia' && amAlive && s.phase === 'night';
  return {
    game: 'mafia',
    players: clone(s.players),
    me,
    version: s.version,
    over: s.over,
    deadline: s.deadline,
    log: clone(s.log),
    waitingFor: s.phase === 'night' && !s.over ? [] : pending(s), // never reveal who acts at night
    legal: me ? mafia.listLegalActions(s, me) : [],
    config: clone(s.config),
    phase: s.phase,
    day: s.day,
    myRole,
    amAlive,
    alive: clone(s.alive),
    knownRoles: known,
    acked: clone(s.acked),
    mafiaVotes: seesMafiaVotes ? clone(s.mafiaVotes) : {},
    mySave: myRole === 'doctor' && amAlive ? s.save : null,
    lastSave: myRole === 'doctor' ? s.lastSave : null,
    myChecks: myRole === 'detective' ? clone(s.checks) : [],
    myCheckTonight: myRole === 'detective' && amAlive ? s.check : null,
    voted: s.phase === 'vote' ? Object.keys(s.votes) : [],
    myVote: me && s.phase === 'vote' ? (s.votes[me] ?? null) : null,
    lastNight: clone(s.lastNight),
    lastVote: clone(s.lastVote),
    deaths: clone(s.deaths),
    winner: s.winner,
    roleCounts: roleCounts(s),
  };
}
