/**
 * Pure room/game logic for online play. No Firestore here: index.ts loads
 * documents, calls these functions inside a transaction and writes results.
 * All game rules come from @gully/engine (the same code the app runs offline).
 */
import {
  GAMES, Rng, applyTimeoutIfDue, getGame, isGameId, pushLog, stepOneBot,
  type BaseState, type BotDifficulty, type ChatChannel, type ChatPolicy, type GameId, type PlayerInfo,
} from '@gully/engine';
import { MAX_AUTO_STEPS, MAX_SEATS, RATE_LIMIT, STALE_MS } from './config';

export const BOT_NAMES = ['Chintu', 'Pappu', 'Golu', 'Bunty', 'Pinky', 'Tinku', 'Sonu', 'Monu', 'Dolly', 'Raju', 'Guddu', 'Bablu'];

export interface Seat {
  id: string;
  name: string;
  isBot: boolean;
  difficulty: BotDifficulty;
  /** A bot is playing for this human (disconnected, timed out or left). */
  botControlled: boolean;
  lastSeen: number;
}

export interface Room {
  code: string;
  hostUid: string;
  status: 'lobby' | 'playing' | 'over';
  game: GameId;
  config: Record<string, unknown>;
  seats: Seat[];
  memberUids: string[];
  bannedUids: string[];
  botDifficulty: BotDifficulty;
  stateVersion: number;
  phaseKey: string;
  deadline: number | null;
  nextCheckAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface PrivateDoc {
  /** Full authoritative game state as JSON (never readable by clients). */
  json: string;
  /** Highest action sequence number seen per player (replay protection). */
  seqs: Record<string, number>;
  /** Recent action timestamps per player (rate limiting). */
  rate: Record<string, number[]>;
}

export class GameError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function newRoom(code: string, hostUid: string, hostName: string, now: number, game: GameId = 'ludo'): Room {
  return {
    code,
    hostUid,
    status: 'lobby',
    game,
    config: GAMES[game].defaultConfig(GAMES[game].meta.minPlayers) as Record<string, unknown>,
    seats: [humanSeat(hostUid, hostName, now)],
    memberUids: [hostUid],
    bannedUids: [],
    botDifficulty: 'medium',
    stateVersion: 0,
    phaseKey: '',
    deadline: null,
    nextCheckAt: now + 60_000,
    createdAt: now,
    updatedAt: now,
  };
}

function humanSeat(uid: string, name: string, now: number): Seat {
  return { id: uid, name, isBot: false, difficulty: 'medium', botControlled: false, lastSeen: now };
}

export function joinRoom(room: Room, uid: string, name: string, now: number): Room {
  if (room.bannedUids.includes(uid)) throw new GameError('banned');
  const seat = room.seats.find((s) => s.id === uid);
  if (seat) {
    // Reconnect: take the seat back from the bot.
    seat.botControlled = false;
    seat.lastSeen = now;
    if (room.status === 'lobby') seat.name = name;
    if (!room.memberUids.includes(uid)) room.memberUids.push(uid);
    return room;
  }
  if (room.status !== 'lobby') throw new GameError('game_in_progress');
  const max = Math.min(MAX_SEATS, getGame(room.game)!.meta.maxPlayers);
  const humans = room.seats.filter((s) => !s.isBot);
  if (room.seats.length >= max) {
    // Make room by dropping a bot if possible.
    const botIdx = room.seats.map((s) => s.isBot).lastIndexOf(true);
    if (botIdx < 0 || humans.length >= max) throw new GameError('room_full');
    room.seats.splice(botIdx, 1);
  }
  room.seats.push(humanSeat(uid, name, now));
  room.memberUids.push(uid);
  return room;
}

export function leaveRoom(room: Room, uid: string): Room | null {
  const seat = room.seats.find((s) => s.id === uid);
  room.memberUids = room.memberUids.filter((u) => u !== uid);
  if (seat) {
    if (room.status === 'lobby') room.seats = room.seats.filter((s) => s.id !== uid);
    else seat.botControlled = true; // a bot finishes the game for them
  }
  const humansLeft = room.seats.filter((s) => !s.isBot && room.memberUids.includes(s.id));
  if (humansLeft.length === 0) return null; // caller deletes the room
  if (room.hostUid === uid) room.hostUid = humansLeft[0]!.id;
  return room;
}

export function kickPlayer(room: Room, hostUid: string, target: string): Room {
  if (room.hostUid !== hostUid) throw new GameError('not_host');
  if (target === hostUid) throw new GameError('invalid_target');
  if (!room.bannedUids.includes(target)) room.bannedUids.push(target);
  const r = leaveRoom(room, target);
  if (!r) throw new GameError('invalid_target');
  return r;
}

export interface SettingsInput {
  game?: unknown;
  config?: unknown;
  botCount?: unknown;
  botDifficulty?: unknown;
}

export function applySettings(room: Room, uid: string, input: SettingsInput): Room {
  if (room.hostUid !== uid) throw new GameError('not_host');
  if (room.status === 'playing') throw new GameError('game_in_progress');
  if (room.status === 'over') room.status = 'lobby';
  if (input.game !== undefined) {
    if (!isGameId(input.game)) throw new GameError('invalid_game');
    if (input.game !== room.game) {
      room.game = input.game;
      room.config = GAMES[input.game].defaultConfig(Math.max(room.seats.length, GAMES[input.game].meta.minPlayers)) as Record<string, unknown>;
    }
  }
  const def = getGame(room.game)!;
  const humans = room.seats.filter((s) => !s.isBot);
  if (input.botDifficulty === 'easy' || input.botDifficulty === 'medium' || input.botDifficulty === 'hard') {
    room.botDifficulty = input.botDifficulty;
  }
  if (input.botCount !== undefined) {
    const max = Math.min(MAX_SEATS, def.meta.maxPlayers) - humans.length;
    const n = typeof input.botCount === 'number' && Number.isFinite(input.botCount) ? Math.max(0, Math.min(max, Math.floor(input.botCount))) : 0;
    const bots: Seat[] = Array.from({ length: n }, (_, i) => ({
      id: `bot-${i + 1}`,
      name: `${BOT_NAMES[i % BOT_NAMES.length]} 🤖`,
      isBot: true,
      difficulty: room.botDifficulty,
      botControlled: true,
      lastSeen: 0,
    }));
    room.seats = [...humans, ...bots];
  } else {
    for (const s of room.seats) if (s.isBot) s.difficulty = room.botDifficulty;
  }
  const playerCount = Math.max(room.seats.length, def.meta.minPlayers);
  room.config = def.sanitizeConfig(input.config !== undefined ? input.config : room.config, playerCount) as Record<string, unknown>;
  return room;
}

export function isBotControlled(room: Room): (id: string) => boolean {
  return (id) => {
    const s = room.seats.find((x) => x.id === id);
    return !s || s.isBot || s.botControlled;
  };
}

function difficultyOf(room: Room): (id: string) => BotDifficulty {
  return (id) => room.seats.find((x) => x.id === id)?.difficulty ?? room.botDifficulty;
}

export function startGame(room: Room, uid: string, seed: number, now: number): { room: Room; priv: PrivateDoc; state: BaseState } {
  if (room.hostUid !== uid) throw new GameError('not_host');
  if (room.status === 'playing') throw new GameError('game_in_progress');
  const def = getGame(room.game)!;
  const n = room.seats.length;
  if (n < def.meta.minPlayers || n > def.meta.maxPlayers) throw new GameError('wrong_player_count');
  const players: PlayerInfo[] = room.seats.map((s) => ({ id: s.id, name: s.name, isBot: s.isBot, ...(s.isBot ? { difficulty: s.difficulty } : {}) }));
  const config = def.sanitizeConfig(room.config, n);
  const state = def.createGame(config, players, new Rng(seed), { now }) as BaseState;
  room.status = 'playing';
  for (const s of room.seats) {
    if (!s.isBot) {
      s.botControlled = !room.memberUids.includes(s.id);
      s.lastSeen = now;
    }
  }
  const priv: PrivateDoc = { json: JSON.stringify(state), seqs: {}, rate: {} };
  const processed = processGame(room, priv, now);
  return { room: processed.room, priv: processed.priv, state: processed.state };
}

/**
 * Advance the game without human input: hand stale players to bots,
 * fire due timeouts and let bots act. Never stalls.
 */
export function processGame(room: Room, priv: PrivateDoc, now: number): { room: Room; priv: PrivateDoc; state: BaseState; changed: boolean } {
  let state = JSON.parse(priv.json) as BaseState;
  const def = getGame(room.game)!;
  const before = state.version;
  let changed = false;
  if (room.status !== 'playing') return { room, priv, state, changed };

  for (const s of room.seats) {
    if (!s.isBot && !s.botControlled && now - s.lastSeen > STALE_MS) {
      s.botControlled = true;
      pushLog(state, 'online.botTookOver', { name: s.name });
      changed = true;
    }
  }

  for (let i = 0; i < MAX_AUTO_STEPS && !state.over; i++) {
    const t = applyTimeoutIfDue(def, state, { now });
    if (t !== state) {
      state = t;
      continue;
    }
    const r = stepOneBot(def, state, { now }, isBotControlled(room), difficultyOf(room));
    if (!r.acted) break;
    state = r.state;
  }
  if (state.version !== before) changed = true;
  finalize(room, priv, state, now);
  return { room, priv, state, changed };
}

function finalize(room: Room, priv: PrivateDoc, state: BaseState, now: number): void {
  priv.json = JSON.stringify(state);
  room.stateVersion = state.version;
  room.deadline = state.deadline;
  room.phaseKey = phaseKeyOf(state);
  if (state.over) room.status = 'over';
  room.nextCheckAt = Math.min(state.deadline ?? Infinity, now + STALE_MS);
  room.updatedAt = now;
}

export function phaseKeyOf(state: BaseState): string {
  const s = state as BaseState & { phase?: string; day?: number; round?: number };
  return `${s.phase ?? ''}:${s.day ?? s.round ?? ''}:${state.over ? 'over' : ''}`;
}

export function checkRate(priv: PrivateDoc, uid: string, now: number, limit = RATE_LIMIT): void {
  const recent = (priv.rate[uid] ?? []).filter((t) => now - t < limit.windowMs);
  if (recent.length >= limit.actions) throw new GameError('rate_limited');
  recent.push(now);
  priv.rate[uid] = recent.slice(-limit.actions);
}

export function submitAction(
  room: Room, priv: PrivateDoc, uid: string, action: unknown, seq: unknown, now: number,
): { room: Room; priv: PrivateDoc; state: BaseState } {
  if (room.status !== 'playing') throw new GameError('not_playing');
  const seat = room.seats.find((s) => s.id === uid);
  if (!seat || seat.isBot || !room.memberUids.includes(uid)) throw new GameError('not_in_game');
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq <= (priv.seqs[uid] ?? 0)) throw new GameError('stale_or_duplicate');
  checkRate(priv, uid, now);
  priv.seqs[uid] = seq;
  const def = getGame(room.game)!;
  if (!def.isAction(action)) throw new GameError('bad_action');

  // Acting proves the player is here: take the seat back from the bot.
  seat.botControlled = false;
  seat.lastSeen = now;

  // Apply anything that was already due (timer expired) before the action.
  let state = applyTimeoutIfDue(def, JSON.parse(priv.json) as BaseState, { now });
  const res = def.applyAction(state, uid, action, { now });
  if (!res.ok) {
    priv.json = JSON.stringify(state);
    throw new GameError(res.reason);
  }
  state = res.state as BaseState;
  priv.json = JSON.stringify(state);
  const processed = processGame(room, priv, now);
  return { room: processed.room, priv: processed.priv, state: processed.state };
}

export function heartbeat(room: Room, uid: string, now: number): Room {
  const seat = room.seats.find((s) => s.id === uid);
  if (!seat || !room.memberUids.includes(uid)) throw new GameError('not_in_room');
  seat.lastSeen = now;
  seat.botControlled = false;
  return room;
}

/** Per-player redacted views. Only these ever reach clients. */
export function viewsFor(room: Room, state: BaseState): Record<string, string> {
  const def = getGame(room.game)!;
  const out: Record<string, string> = {};
  for (const uid of room.memberUids) out[uid] = JSON.stringify(def.getPlayerView(state, uid));
  return out;
}

const DEFAULT_POLICY: ChatPolicy = { canRead: ['all'], canWrite: ['all'], canSpeak: true, canListen: true };

export function chatPolicy(room: Room, state: BaseState | null, uid: string): ChatPolicy {
  if (!state || room.status !== 'playing') return DEFAULT_POLICY;
  const def = getGame(room.game)!;
  return def.chatPolicy ? def.chatPolicy(state, uid) : DEFAULT_POLICY;
}

/** Who may read a message on `channel` (respecting blocks). */
export function chatReaders(
  room: Room, state: BaseState | null, sender: string, channel: ChatChannel, blockedBy: Record<string, string[]>,
): string[] {
  return room.memberUids.filter((uid) => {
    if (uid === sender) return true;
    if ((blockedBy[uid] ?? []).includes(sender)) return false;
    return chatPolicy(room, state, uid).canRead.includes(channel);
  });
}

export function makeCode(rand: () => number, alphabet: string, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
}
