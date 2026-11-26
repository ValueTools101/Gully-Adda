import { describe, expect, it } from 'vitest';
import { replay, type MafiaView } from '@gully/engine';
import {
  GameError, applySettings, chatReaders, joinRoom, kickPlayer, leaveRoom, newRoom, processGame, startGame, submitAction, viewsFor,
  type PrivateDoc, type Room,
} from '../../src/core';
import { STALE_MS } from '../../src/config';
import { cleanChat, cleanName } from '../../src/text';

const T = 1_700_000_000_000;

function lobby(game: Room['game'], humans: number, bots = 0): Room {
  let r = newRoom('ABC234', 'u0', 'Host', T);
  r = applySettings(r, 'u0', { game });
  for (let i = 1; i < humans; i++) r = joinRoom(r, `u${i}`, `P${i}`, T);
  if (bots) r = applySettings(r, 'u0', { botCount: bots });
  return r;
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe('rooms', () => {
  it('host creates, friends join, host fills seats with bots', () => {
    const r = lobby('mafia', 3, 4);
    expect(r.seats).toHaveLength(7);
    expect(r.seats.filter((s) => s.isBot)).toHaveLength(4);
    expect(r.memberUids).toEqual(['u0', 'u1', 'u2']);
  });

  it('only the host changes settings or starts', () => {
    const r = lobby('ludo', 2);
    expectCode(() => applySettings(r, 'u1', { game: 'dots' }), 'not_host');
    expectCode(() => startGame(r, 'u1', 1, T), 'not_host');
  });

  it('rejects wrong player counts', () => {
    expectCode(() => startGame(lobby('rmcs', 2), 'u0', 1, T), 'wrong_player_count');
  });

  it('cannot join a game in progress, but a seated player can rejoin', () => {
    const r = startGame(lobby('ludo', 2), 'u0', 1, T).room;
    expectCode(() => joinRoom(structuredClone(r), 'stranger', 'X', T), 'game_in_progress');
    const back = joinRoom(structuredClone(r), 'u1', 'P1', T);
    expect(back.seats.find((s) => s.id === 'u1')?.botControlled).toBe(false);
  });

  it('kicked players are banned', () => {
    let r = lobby('ludo', 3);
    r = kickPlayer(r, 'u0', 'u2');
    expect(r.memberUids).not.toContain('u2');
    expectCode(() => joinRoom(r, 'u2', 'P2', T), 'banned');
  });

  it('host leaving hands the room to another human; last human leaving deletes it', () => {
    let r: Room | null = lobby('ludo', 2);
    r = leaveRoom(r, 'u0');
    expect(r?.hostUid).toBe('u1');
    expect(leaveRoom(r!, 'u1')).toBeNull();
  });
});

describe('online games', () => {
  it('views never contain other players\' secrets', () => {
    const { room, priv } = startGame(lobby('mafia', 6), 'u0', 99, T);
    const state = JSON.parse(priv.json);
    const views = viewsFor(room, state);
    for (const [uid, json] of Object.entries(views)) {
      const v = JSON.parse(json) as MafiaView;
      expect(json).not.toContain('"rng"');
      const knownOthers = Object.keys(v.knownRoles).filter((id) => id !== uid);
      if (state.roles[uid] !== 'mafia') expect(knownOthers).toEqual([]);
    }
  });

  it('hide & seek: the server replays inputs to score them; others\u2019 scores stay hidden until the round ends', () => {
    let { room, priv } = startGame(lobby('hideseek', 3), 'u0', 11, T);
    const st = JSON.parse(priv.json);
    const round = st.rounds[0];
    const honest = replay(round.seed, round.role, st.config.roundSeconds, st.config.aiLevel, '')!;
    ({ room, priv } = submitAction(room, priv, 'u0', { type: 'submit', inputs: '' }, 1, T));
    expect(JSON.parse(priv.json).results[0].u0).toEqual(honest);
    expect(() => submitAction(structuredClone(room), structuredClone(priv), 'u1', { type: 'submit', inputs: '~~~' }, 1, T)).toThrow();
    const views = viewsFor(room, JSON.parse(priv.json));
    expect(JSON.parse(views.u1!).results).toEqual([]);
    expect(JSON.parse(views.u1!).myResult).toBeNull();
  });

  it('rejects out-of-turn, malformed, duplicate and replayed actions', () => {
    const { room, priv } = startGame(lobby('ludo', 2), 'u0', 5, T);
    expectCode(() => submitAction(structuredClone(room), structuredClone(priv), 'u1', { type: 'roll' }, 1, T), 'not_your_turn');
    expectCode(() => submitAction(structuredClone(room), structuredClone(priv), 'u0', { type: 'hack' }, 1, T), 'bad_action');
    expectCode(() => submitAction(structuredClone(room), structuredClone(priv), 'stranger', { type: 'roll' }, 1, T), 'not_in_game');
    const ok = submitAction(structuredClone(room), structuredClone(priv), 'u0', { type: 'roll' }, 10, T);
    expectCode(() => submitAction(ok.room, ok.priv, 'u0', { type: 'roll' }, 10, T), 'stale_or_duplicate');
    expectCode(() => submitAction(ok.room, ok.priv, 'u0', { type: 'roll' }, 9, T), 'stale_or_duplicate');
  });

  it('rate limits action floods', () => {
    let { room, priv } = startGame(lobby('npat', 2), 'u0', 5, T);
    let limited = false;
    for (let i = 1; i <= 40; i++) {
      try {
        ({ room, priv } = submitAction(room, priv, 'u0', { type: 'answer', answers: { name: 'x' + i } }, i, T + i));
      } catch (e) {
        expect((e as GameError).code).toBe('rate_limited');
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it('bots fill seats and play their turns immediately', () => {
    const { room, priv } = startGame(lobby('dots', 1, 3), 'u0', 3, T);
    const s = JSON.parse(priv.json);
    expect(s.turn).toBe(0);
    const r = submitAction(room, priv, 'u0', { type: 'line', line: 0 }, 1, T);
    const after = JSON.parse(r.priv.json);
    // u0 drew one line, then three bots played until it was a human's turn again
    expect(after.lines.filter(Boolean).length).toBeGreaterThanOrEqual(4);
    expect(after.players[after.turn].id).toBe('u0');
  });

  it('a dropped player is replaced by a bot so the game never stalls, and can come back', () => {
    const { room, priv } = startGame(lobby('ludo', 2), 'u0', 8, T);
    const later = T + STALE_MS + 1000;
    room.seats.find((s) => s.id === 'u1')!.lastSeen = later; // u1 is still here
    const r = processGame(room, priv, later);
    expect(r.room.seats.find((s) => s.id === 'u0')?.botControlled).toBe(true);
    const st = JSON.parse(r.priv.json);
    expect(st.players[st.turn].id).toBe('u1'); // the bot played u0's turn(s)
    const back = joinRoom(r.room, 'u0', 'Host', later);
    expect(back.seats.find((s) => s.id === 'u0')?.botControlled).toBe(false);
  });

  it('timers expire server-side', () => {
    let r = lobby('npat', 2);
    r = applySettings(r, 'u0', { config: { roundSeconds: 30, rounds: 1 } });
    const { room, priv } = startGame(r, 'u0', 1, T);
    room.seats.forEach((s) => (s.lastSeen = T + 31_000));
    const p = processGame(room, priv, T + 31_000);
    expect(JSON.parse(p.priv.json).phase).toBe('challenge');
  });

  it('mafia chat readers follow the phase rules and blocks', () => {
    const { room, priv } = startGame(lobby('mafia', 6), 'u0', 4, T);
    const state = JSON.parse(priv.json);
    // roles phase: living chat readable by everyone alive
    const readers = chatReaders(room, state, 'u1', 'living', { u2: ['u1'] });
    expect(readers).toContain('u0');
    expect(readers).not.toContain('u2');
    const mafiaReaders = chatReaders(room, state, 'u1', 'mafia', {});
    for (const id of mafiaReaders) if (id !== 'u1') expect(state.roles[id]).toBe('mafia');
  });
});

describe('text', () => {
  it('cleans names and masks chat', () => {
    expect(cleanName('  Chintu  ')).toBe('Chintu');
    expect(cleanName('a‮b')).toBe('ab');
    expect(cleanName('')).toBeNull();
    expect(cleanName('x'.repeat(40))).toHaveLength(16);
    expect(cleanName('chutiya123')).toBeNull();
    expect(cleanChat('you shit', 200)).toBe('you s***');
  });
});

export type { PrivateDoc };
