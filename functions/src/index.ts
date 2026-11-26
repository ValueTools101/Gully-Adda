/**
 * Gully Adda Cloud Functions (2nd gen). The ONLY writer of online game state.
 *
 * Firestore layout
 *   rooms/{code}                 lobby + public room info (members can read)
 *   rooms/{code}/private/state   full authoritative state (no client access)
 *   rooms/{code}/views/{uid}     redacted view for one player (only that uid can read)
 *   rooms/{code}/chat/{id}       chat message with a `readers` list (only readers can read)
 *   users/{uid}                  display name + blocked list (server only)
 *   reports/{id}                 moderation reports (server only)
 */
import { getGame, type BaseState, type ChatChannel } from '@gully/engine';
import { randomBytes, randomInt } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { CHAT_LIMIT, CODE_ALPHABET, CODE_LENGTH, REGION, ROOM_TTL_MS } from './config';
import {
  GameError, applySettings, chatPolicy, chatReaders, checkRate, heartbeat, joinRoom, kickPlayer, leaveRoom, makeCode,
  newRoom, processGame, startGame, submitAction, viewsFor, type PrivateDoc, type Room,
} from './core';
import { cleanChat, cleanName } from './text';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, mintToken, syncVoicePermissions, voiceReady } from './voice';

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: REGION, maxInstances: 20 });

const SECRETS = [LIVEKIT_API_KEY, LIVEKIT_API_SECRET];
const CALL_OPTS = { secrets: SECRETS, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true', cors: true };

const roomRef = (code: string) => db.collection('rooms').doc(code);
const privRef = (code: string) => roomRef(code).collection('private').doc('state');
const viewRef = (code: string, uid: string) => roomRef(code).collection('views').doc(uid);

function uidOf(req: CallableRequest<unknown>): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'sign_in_required');
  return req.auth.uid;
}

function codeOf(data: unknown): string {
  const raw = (data as { code?: unknown })?.code;
  if (typeof raw !== 'string') throw new HttpsError('invalid-argument', 'bad_code');
  const code = raw.trim().toUpperCase();
  if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) throw new HttpsError('invalid-argument', 'bad_code');
  return code;
}

function nameOf(data: unknown): string {
  const n = cleanName((data as { name?: unknown })?.name);
  if (!n) throw new HttpsError('invalid-argument', 'bad_name');
  return n;
}

function wrap<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((e: unknown) => {
    if (e instanceof HttpsError) throw e;
    if (e instanceof GameError) {
      const code = ['not_host', 'banned', 'not_in_game', 'not_in_room'].includes(e.code)
        ? 'permission-denied'
        : e.code === 'rate_limited' ? 'resource-exhausted' : 'failed-precondition';
      throw new HttpsError(code, e.code);
    }
    logger.error(e);
    throw new HttpsError('internal', 'internal');
  });
}

async function loadRoom(tx: Transaction, code: string): Promise<Room> {
  const snap = await tx.get(roomRef(code));
  if (!snap.exists) throw new HttpsError('not-found', 'room_not_found');
  return snap.data() as Room;
}

async function loadPriv(tx: Transaction, code: string): Promise<PrivateDoc | null> {
  const snap = await tx.get(privRef(code));
  return snap.exists ? (snap.data() as PrivateDoc) : null;
}

function writeRoom(tx: Transaction, room: Room): void {
  tx.set(roomRef(room.code), { ...room, expireAt: Timestamp.fromMillis(room.updatedAt + ROOM_TTL_MS) });
}

/** Write the authoritative state and every member's redacted view. */
function writeState(tx: Transaction, room: Room, priv: PrivateDoc, state: BaseState): void {
  tx.set(privRef(room.code), priv);
  const views = viewsFor(room, state);
  for (const [uid, json] of Object.entries(views)) {
    tx.set(viewRef(room.code, uid), { json, version: state.version, updatedAt: room.updatedAt });
  }
}

/** Voice permissions from the engine's chat policy (Mafia: day = living speak, night = all muted, dead = listen). */
async function afterPhaseChange(before: string, room: Room, state: BaseState | null): Promise<void> {
  if (!state || before === room.phaseKey || !getGame(room.game)?.meta.voice || !voiceReady()) return;
  const perms: Record<string, boolean> = {};
  for (const uid of room.memberUids) perms[uid] = chatPolicy(room, state, uid).canSpeak;
  await syncVoicePermissions(room.code, perms);
}

async function upsertUser(uid: string, name: string): Promise<void> {
  await db.collection('users').doc(uid).set({ name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

// ---------------------------------------------------------------- callables

export const createRoom = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const name = nameOf(req.data);
    const game = (req.data as { game?: unknown })?.game;
    await upsertUser(uid, name);
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = makeCode(() => randomInt(0, 1 << 30) / (1 << 30), CODE_ALPHABET, CODE_LENGTH);
      const created = await db.runTransaction(async (tx) => {
        const snap = await tx.get(roomRef(code));
        if (snap.exists) return false;
        let room = newRoom(code, uid, name, Date.now());
        if (typeof game === 'string') room = applySettings(room, uid, { game });
        writeRoom(tx, room);
        return true;
      });
      if (created) return { code };
    }
    throw new HttpsError('unavailable', 'try_again');
  }),
);

export const joinRoomFn = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    const name = nameOf(req.data);
    await upsertUser(uid, name);
    await db.runTransaction(async (tx) => {
      const room = joinRoom(await loadRoom(tx, code), uid, name, Date.now());
      const priv = room.status === 'lobby' ? null : await loadPriv(tx, code);
      writeRoom(tx, room);
      if (priv) tx.set(viewRef(code, uid), { json: JSON.stringify(getGame(room.game)!.getPlayerView(JSON.parse(priv.json), uid)), version: room.stateVersion, updatedAt: Date.now() });
    });
    return { code };
  }),
);

export const leaveRoomFn = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    await removeFromRoom(code, uid);
    return { ok: true };
  }),
);

async function removeFromRoom(code: string, uid: string, rename = false): Promise<void> {
  const del = await db.runTransaction(async (tx) => {
    const room = await loadRoom(tx, code);
    const priv = room.status === 'playing' ? await loadPriv(tx, code) : null;
    if (rename) {
      const seat = room.seats.find((s) => s.id === uid);
      if (seat) seat.name = 'Player';
    }
    const next = leaveRoom(room, uid);
    tx.delete(viewRef(code, uid));
    if (!next) return true;
    next.updatedAt = Date.now();
    if (priv) {
      const r = processGame(next, priv, Date.now());
      writeRoom(tx, r.room);
      writeState(tx, r.room, r.priv, r.state);
    } else writeRoom(tx, next);
    return false;
  });
  if (del) await db.recursiveDelete(roomRef(code));
}

export const setSettings = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    await db.runTransaction(async (tx) => {
      const room = applySettings(await loadRoom(tx, code), uid, req.data as object);
      room.updatedAt = Date.now();
      writeRoom(tx, room);
    });
    return { ok: true };
  }),
);

export const kick = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    const target = (req.data as { uid?: unknown })?.uid;
    if (typeof target !== 'string') throw new HttpsError('invalid-argument', 'bad_target');
    await db.runTransaction(async (tx) => {
      const room = kickPlayer(await loadRoom(tx, code), uid, target);
      tx.delete(viewRef(code, target));
      writeRoom(tx, room);
    });
    return { ok: true };
  }),
);

export const startGameFn = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    let after: { room: Room; state: BaseState } | null = null;
    await db.runTransaction(async (tx) => {
      const room = await loadRoom(tx, code);
      // Server-side randomness only: shuffles, roles and dice all derive from this seed.
      const seed = randomBytes(4).readUInt32LE(0);
      const r = startGame(room, uid, seed, Date.now());
      writeRoom(tx, r.room);
      writeState(tx, r.room, r.priv, r.state);
      after = r;
    });
    const a = after as { room: Room; state: BaseState } | null;
    if (a) await afterPhaseChange('', a.room, a.state);
    return { ok: true };
  }),
);

export const submitActionFn = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    const { action, seq } = (req.data ?? {}) as { action?: unknown; seq?: unknown };
    let result: { before: string; room: Room; state: BaseState } | null = null;
    await db.runTransaction(async (tx) => {
      const room = await loadRoom(tx, code);
      const priv = await loadPriv(tx, code);
      if (!priv) throw new HttpsError('failed-precondition', 'not_playing');
      const before = room.phaseKey;
      const r = submitAction(room, priv, uid, action, seq, Date.now());
      writeRoom(tx, r.room);
      writeState(tx, r.room, r.priv, r.state);
      result = { before, room: r.room, state: r.state };
    });
    const res = result as { before: string; room: Room; state: BaseState } | null;
    if (res) await afterPhaseChange(res.before, res.room, res.state);
    return { ok: true };
  }),
);

/** Keep-alive + "tick": reclaims the seat from a bot and processes due timers/bot turns. */
export const heartbeatFn = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    await tickRoom(code, uid);
    return { ok: true, now: Date.now() };
  }),
);

async function tickRoom(code: string, uid: string | null): Promise<void> {
  let result: { before: string; room: Room; state: BaseState } | null = null;
  await db.runTransaction(async (tx) => {
    let room = await loadRoom(tx, code);
    const now = Date.now();
    if (uid) room = heartbeat(room, uid, now);
    if (room.status !== 'playing') {
      writeRoom(tx, room);
      return;
    }
    const priv = await loadPriv(tx, code);
    if (!priv) return;
    const before = room.phaseKey;
    const r = processGame(room, priv, now);
    writeRoom(tx, r.room);
    if (r.changed) writeState(tx, r.room, r.priv, r.state);
    result = { before, room: r.room, state: r.state };
  });
  const res = result as { before: string; room: Room; state: BaseState } | null;
  if (res) await afterPhaseChange(res.before, res.room, res.state);
}

/** Every minute: progress stalled games (timeouts, dropped players) and delete stale rooms. */
export const sweepRooms = onSchedule({ schedule: 'every 1 minutes', secrets: SECRETS, timeoutSeconds: 120 }, async () => {
  const now = Date.now();
  const due = await db.collection('rooms').where('status', '==', 'playing').where('nextCheckAt', '<=', now).limit(100).get();
  await Promise.all(due.docs.map((d) => tickRoom(d.id, null).catch((e) => logger.warn('tick failed', d.id, String(e)))));
  const old = await db.collection('rooms').where('updatedAt', '<', now - ROOM_TTL_MS).limit(50).get();
  await Promise.all(old.docs.map((d) => db.recursiveDelete(d.ref)));
});

export const sendChat = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    const { channel, text } = (req.data ?? {}) as { channel?: unknown; text?: unknown };
    const clean = cleanChat(text, CHAT_LIMIT.maxLength);
    if (!clean) throw new HttpsError('invalid-argument', 'empty');
    if (!['all', 'living', 'dead', 'mafia'].includes(String(channel))) throw new HttpsError('invalid-argument', 'bad_channel');
    await db.runTransaction(async (tx) => {
      const room = await loadRoom(tx, code);
      if (!room.memberUids.includes(uid)) throw new GameError('not_in_room');
      const priv = room.status === 'playing' ? await loadPriv(tx, code) : null;
      const state = priv ? (JSON.parse(priv.json) as BaseState) : null;
      const policy = chatPolicy(room, state, uid);
      if (!policy.canWrite.includes(channel as ChatChannel)) throw new GameError('chat_closed');
      const rateRef = roomRef(code).collection('private').doc('chatRate');
      const rateSnap = await tx.get(rateRef);
      const rate = (rateSnap.data() ?? { rate: {} }) as Pick<PrivateDoc, 'rate'>;
      checkRate(rate as PrivateDoc, uid, Date.now(), { actions: CHAT_LIMIT.messages, windowMs: CHAT_LIMIT.windowMs });
      const userSnaps = await Promise.all(room.memberUids.map((m) => tx.get(db.collection('users').doc(m))));
      const blockedBy: Record<string, string[]> = {};
      userSnaps.forEach((s, i) => (blockedBy[room.memberUids[i]!] = (s.data()?.blocked as string[] | undefined) ?? []));
      const readers = chatReaders(room, state, uid, channel as ChatChannel, blockedBy);
      const seat = room.seats.find((s) => s.id === uid);
      tx.set(rateRef, rate);
      tx.set(roomRef(code).collection('chat').doc(), { from: uid, name: seat?.name ?? '?', channel, text: clean, at: Date.now(), readers });
    });
    return { ok: true };
  }),
);

export const getVoiceToken = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    if (!voiceReady()) throw new HttpsError('failed-precondition', 'voice_disabled');
    const snap = await roomRef(code).get();
    const room = snap.data() as Room | undefined;
    if (!room || !room.memberUids.includes(uid)) throw new HttpsError('permission-denied', 'not_in_room');
    if (!getGame(room.game)?.meta.voice || room.status === 'lobby') throw new HttpsError('failed-precondition', 'no_voice_for_game');
    const priv = (await privRef(code).get()).data() as PrivateDoc | undefined;
    const state = priv ? (JSON.parse(priv.json) as BaseState) : null;
    const canPublish = chatPolicy(room, state, uid).canSpeak;
    const name = room.seats.find((s) => s.id === uid)?.name ?? 'Player';
    return { token: await mintToken(code, uid, name, canPublish), url: LIVEKIT_URL.value() };
  }),
);

// ---------------------------------------------------------------- moderation

const REASONS = ['harassment', 'hate', 'cheating', 'inappropriate', 'other'];

export const reportPlayer = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const code = codeOf(req.data);
    const { target, reason, details } = (req.data ?? {}) as { target?: unknown; reason?: unknown; details?: unknown };
    if (typeof target !== 'string' || target === uid) throw new HttpsError('invalid-argument', 'bad_target');
    if (!REASONS.includes(String(reason))) throw new HttpsError('invalid-argument', 'bad_reason');
    const room = (await roomRef(code).get()).data() as Room | undefined;
    if (!room || !room.memberUids.includes(uid)) throw new HttpsError('permission-denied', 'not_in_room');
    const seat = room.seats.find((s) => s.id === target);
    if (!seat || seat.isBot) throw new HttpsError('invalid-argument', 'bad_target');
    const recent = await roomRef(code).collection('chat').where('from', '==', target).orderBy('at', 'desc').limit(20).get();
    await db.collection('reports').add({
      reporter: uid,
      target,
      targetName: seat.name,
      room: code,
      game: room.game,
      reason,
      details: cleanChat(details, 500) ?? '',
      recentChat: recent.docs.map((d) => ({ text: d.get('text'), channel: d.get('channel'), at: d.get('at') })),
      at: FieldValue.serverTimestamp(),
      status: 'open',
    });
    // Reporting also blocks, so the reporter stops seeing/hearing them right away.
    await db.collection('users').doc(uid).set({ blocked: FieldValue.arrayUnion(target) }, { merge: true });
    return { ok: true };
  }),
);

export const blockPlayer = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const { target, block } = (req.data ?? {}) as { target?: unknown; block?: unknown };
    if (typeof target !== 'string' || target === uid || target.length > 128) throw new HttpsError('invalid-argument', 'bad_target');
    await db.collection('users').doc(uid).set({ blocked: block === false ? FieldValue.arrayRemove(target) : FieldValue.arrayUnion(target) }, { merge: true });
    return { ok: true };
  }),
);

/** In-app account deletion: removes everything tied to this anonymous uid. */
export const deleteMyData = onCall(CALL_OPTS, (req) =>
  wrap(async () => {
    const uid = uidOf(req);
    const rooms = await db.collection('rooms').where('memberUids', 'array-contains', uid).get();
    for (const r of rooms.docs) await removeFromRoom(r.id, uid, true).catch((e) => logger.warn('leave failed', String(e)));
    const msgs = await db.collectionGroup('chat').where('from', '==', uid).get();
    await deleteRefs(msgs.docs.map((d) => d.ref));
    const reports = await db.collection('reports').where('reporter', '==', uid).get();
    await deleteRefs(reports.docs.map((d) => d.ref));
    await db.collection('users').doc(uid).delete();
    await getAuth().deleteUser(uid).catch(() => {});
    return { ok: true };
  }),
);

async function deleteRefs(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
}

// Public callable names used by the app.
export { joinRoomFn as joinRoom, leaveRoomFn as leaveRoom, startGameFn as startGame, submitActionFn as submitAction, heartbeatFn as heartbeat };
