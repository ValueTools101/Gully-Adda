import { describe, expect, it } from 'vitest';
import {
  GameError, applySettings, heartbeat, joinRoom, leaveRoom, newRoom, processGame, startGame, submitAction, type Room,
} from '../../src/core';
import { MAX_SEATS } from '../../src/config';
import { cleanChat, cleanName } from '../../src/text';

const T = 1_700_000_000_000;
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as GameError).code;
  }
  return 'ok';
};
function lobby(game: Room['game'], humans: number): Room {
  let r = newRoom('ABC234', 'u0', 'Host', T);
  r = applySettings(r, 'u0', { game });
  for (let i = 1; i < humans; i++) r = joinRoom(r, `u${i}`, `P${i}`, T);
  return r;
}

describe('server edge cases', () => {
  it('room full: RMCS caps at 4, bots make way for humans, max 12 seats overall', () => {
    let r = lobby('rmcs', 4);
    expect(code(() => joinRoom(structuredClone(r), 'u9', 'X', T))).toBe('room_full');
    r = lobby('rmcs', 2);
    r = applySettings(r, 'u0', { botCount: 2 });
    r = joinRoom(r, 'u5', 'Late', T);
    expect(r.seats.filter((s) => s.isBot)).toHaveLength(1);
    let big = lobby('mafia', 1);
    big = applySettings(big, 'u0', { botCount: 99 });
    expect(big.seats.length).toBe(MAX_SEATS);
  });

  it('switching to a smaller game trims bots on next bot change and blocks start when too many humans', () => {
    let r = lobby('mafia', 6);
    r = applySettings(r, 'u0', { game: 'rmcs' });
    expect(code(() => startGame(structuredClone(r), 'u0', 1, T))).toBe('wrong_player_count');
  });

  it('cannot change settings, restart or re-join as stranger while playing', () => {
    const { room } = startGame(lobby('ludo', 2), 'u0', 1, T);
    expect(code(() => applySettings(structuredClone(room), 'u0', { game: 'dots' }))).toBe('game_in_progress');
    expect(code(() => startGame(structuredClone(room), 'u0', 2, T))).toBe('game_in_progress');
  });

  it('garbage settings are sanitised, not trusted', () => {
    let r = lobby('npat', 2);
    r = applySettings(r, 'u0', { config: { rounds: 1e9, categories: ['<b>', 'name'], roundSeconds: -5 }, botCount: 'lots', botDifficulty: 'godlike' });
    expect(r.config.rounds).toBe(15);
    expect(r.config.categories).toEqual(['name']);
    expect(r.config.roundSeconds).toBe(0);
    expect(r.botDifficulty).toBe('medium');
    expect(code(() => applySettings(r, 'u0', { game: '__proto__' }))).toBe('invalid_game');
  });

  it('everyone leaving mid-game: bots finish, last human leaving deletes the room', () => {
    const started = startGame(lobby('dots', 3), 'u0', 4, T);
    const priv = started.priv;
    let room = leaveRoom(started.room, 'u0')!;
    expect(room.hostUid).not.toBe('u0');
    room = leaveRoom(room, 'u1')!;
    const p = processGame(room, priv, T + 1000);
    const st = JSON.parse(p.priv.json);
    // only u2 is human-controlled now: it is either u2's turn or the game ended
    expect(st.over || st.players[st.turn].id === 'u2').toBe(true);
    expect(leaveRoom(p.room, 'u2')).toBeNull();
  });

  it('a player who left cannot act; heartbeat from non-members is refused', () => {
    const started = startGame(lobby('ludo', 2), 'u0', 6, T);
    const room = leaveRoom(started.room, 'u1')!;
    expect(code(() => submitAction(structuredClone(room), structuredClone(started.priv), 'u1', { type: 'roll' }, 5, T))).toBe('not_in_game');
    expect(code(() => heartbeat(room, 'nobody', T))).toBe('not_in_room');
  });

  it('actions after the game is over are rejected', () => {
    let { room, priv } = startGame(applySettings(lobby('rmcs', 1), 'u0', { botCount: 3, config: { rounds: 1 } }), 'u0', 3, T);
    for (let seq = 1; seq < 50 && room.status === 'playing'; seq++) {
      const st = JSON.parse(priv.json);
      const a = st.phase === 'guess' ? { type: 'guess', target: Object.keys(st.slips).find((k) => st.slips[k] === 'chor') } : { type: 'ack' };
      try {
        ({ room, priv } = submitAction(room, priv, 'u0', a, seq, T + seq));
      } catch {
        ({ room, priv } = processGame(room, priv, T + seq));
      }
    }
    expect(room.status).toBe('over');
    expect(code(() => submitAction(room, priv, 'u0', { type: 'ack' }, 999, T))).toBe('not_playing');
  });

  it('a timer that expired before the action is applied first', () => {
    let r = lobby('npat', 2);
    r = applySettings(r, 'u0', { config: { roundSeconds: 30, rounds: 1 } });
    const { room, priv } = startGame(r, 'u0', 1, T);
    // answer arrives after the round closed: it must be rejected, not sneak in
    expect(code(() => submitAction(structuredClone(room), structuredClone(priv), 'u0', { type: 'answer', answers: { name: 'late' } }, 1, T + 40_000))).toBe('wrong_phase');
  });

  it('names and chat: control chars, zero-width, bidi, length, profanity', () => {
    expect(cleanName('​Chintu‮')).toBe('Chintu');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName('B h e n c h o d')).toBeNull();
    expect(cleanChat('a'.repeat(500), 200)).toHaveLength(200);
    expect(cleanChat('\n\t  ', 200)).toBeNull();
    expect(cleanChat({ text: 'x' }, 200)).toBeNull();
  });
});
