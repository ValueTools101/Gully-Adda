import type { Rng } from './rng';

export type PlayerId = string;
export type BotDifficulty = 'easy' | 'medium' | 'hard';

export type GameId = 'rmcs' | 'mafia' | 'npat' | 'dots' | 'ludo' | 'hideseek';

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  isBot: boolean;
  difficulty?: BotDifficulty;
}

/** A public, translatable log line, e.g. { key: 'ludo.rolled', params: { name: 'Asha', n: 6 } }. */
export interface LogEntry {
  key: string;
  params?: Record<string, string | number>;
}

export interface GameContext {
  /** Milliseconds since epoch. Engines never read the clock themselves. */
  now: number;
}

/**
 * Fields every game state carries. States are plain JSON (no classes, no
 * undefined) so they can be stored by the server and cloned cheaply.
 */
export interface BaseState {
  game: GameId;
  players: PlayerInfo[];
  /** PRNG state. Secret: never copied into any view. */
  rng: number;
  /** Incremented on every accepted action (used for replay protection). */
  version: number;
  over: boolean;
  /** When the current phase or turn times out (ms epoch), or null for no timer. */
  deadline: number | null;
  log: LogEntry[];
}

/** Fields every per-player view carries. Views never include `rng`. */
export interface BaseView {
  game: GameId;
  players: PlayerInfo[];
  me: PlayerId | null;
  version: number;
  over: boolean;
  deadline: number | null;
  log: LogEntry[];
  /** Players the game is waiting on right now. */
  waitingFor: PlayerId[];
  /** Legal actions for `me` (empty for spectators). */
  legal: unknown[];
}

export interface GameAction {
  type: string;
}

export type ActionResult<S> = { ok: true; state: S } | { ok: false; reason: string };

export type ChatChannel = 'all' | 'living' | 'dead' | 'mafia';

export interface ChatPolicy {
  canRead: ChatChannel[];
  canWrite: ChatChannel[];
  /** For voice: may this player publish audio right now? */
  canSpeak: boolean;
  /** For voice: may this player listen right now? */
  canListen: boolean;
}

export interface GameMeta {
  id: GameId;
  minPlayers: number;
  maxPlayers: number;
  recommendedMin?: number;
  /** Has secret per-player information (needs pass-the-phone reveal flow). */
  hiddenInfo: boolean;
  /** Supports simultaneous moves (several players act in the same phase). */
  simultaneous: boolean;
  /** Voice chat is offered for this game online. */
  voice: boolean;
}

export interface GameDefinition<
  C = unknown,
  S extends BaseState = BaseState,
  A extends GameAction = GameAction,
  V extends BaseView = BaseView,
> {
  meta: GameMeta;
  defaultConfig(playerCount: number): C;
  /** Clamp/repair untrusted config (host settings). Never throws. */
  sanitizeConfig(raw: unknown, playerCount: number): C;
  createGame(config: C, players: PlayerInfo[], rng: Rng, ctx: GameContext): S;
  /** Spectator-safe state: nothing secret. */
  getPublicState(state: S): V;
  /** What one player may see. Strips every secret they must not know. */
  getPlayerView(state: S, playerId: PlayerId): V;
  listLegalActions(state: S, playerId: PlayerId): A[];
  /** Pure: never mutates `state`. */
  applyAction(state: S, playerId: PlayerId, action: A, ctx: GameContext): ActionResult<S>;
  /** Players the game is waiting for. Empty when over. */
  pendingActors(state: S): PlayerId[];
  /** Called when ctx.now >= state.deadline. Must make progress (never stall). */
  onTimeout(state: S, ctx: GameContext): S;
  isGameOver(state: S): boolean;
  scores(state: S): Record<PlayerId, number>;
  getBotAction(state: S, botId: PlayerId, difficulty: BotDifficulty, rng: Rng): A | null;
  /** Runtime shape check for untrusted input from the network. */
  isAction(action: unknown): action is A;
  chatPolicy?(state: S, playerId: PlayerId): ChatPolicy;
}

export type AnyGame = GameDefinition<any, any, any, any>;
