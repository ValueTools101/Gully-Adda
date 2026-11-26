import type { BotDifficulty, ChatChannel, GameAction, GameId } from '@gully/engine';
import { call } from './firebase';

/** Monotonic action sequence numbers (server rejects duplicates and replays). */
let lastSeq = 0;
function nextSeq(): number {
  lastSeq = Math.max(Date.now(), lastSeq + 1);
  return lastSeq;
}

export interface Seat {
  id: string;
  name: string;
  isBot: boolean;
  difficulty: BotDifficulty;
  botControlled: boolean;
  lastSeen: number;
}

export interface RoomDoc {
  code: string;
  hostUid: string;
  status: 'lobby' | 'playing' | 'over';
  game: GameId;
  config: Record<string, unknown>;
  seats: Seat[];
  memberUids: string[];
  botDifficulty: BotDifficulty;
  stateVersion: number;
  deadline: number | null;
}

export interface ChatMsg {
  id: string;
  from: string;
  name: string;
  channel: ChatChannel;
  text: string;
  at: number;
}

export const api = {
  createRoom: (name: string, game?: GameId) => call<object, { code: string }>('createRoom', { name, game }),
  joinRoom: (code: string, name: string) => call<object, { code: string }>('joinRoom', { code, name }),
  leaveRoom: (code: string) => call<object, unknown>('leaveRoom', { code }),
  setSettings: (code: string, s: { game?: GameId; config?: unknown; botCount?: number; botDifficulty?: BotDifficulty }) => call<object, unknown>('setSettings', { code, ...s }),
  startGame: (code: string) => call<object, unknown>('startGame', { code }),
  submitAction: (code: string, action: GameAction) => call<object, unknown>('submitAction', { code, action, seq: nextSeq() }),
  heartbeat: (code: string) => call<object, { now: number }>('heartbeat', { code }),
  sendChat: (code: string, channel: ChatChannel, text: string) => call<object, unknown>('sendChat', { code, channel, text }),
  report: (code: string, target: string, reason: string, details = '') => call<object, unknown>('reportPlayer', { code, target, reason, details }),
  block: (target: string, block: boolean) => call<object, unknown>('blockPlayer', { target, block }),
  kick: (code: string, uid: string) => call<object, unknown>('kick', { code, uid }),
  voiceToken: (code: string) => call<object, { token: string; url: string }>('getVoiceToken', { code }),
};

export function errorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?:\s*/, '');
}
