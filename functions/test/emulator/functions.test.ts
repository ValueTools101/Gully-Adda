/**
 * End-to-end Cloud Function tests against the local emulators
 * (auth + firestore + functions). Run from repo root: npm run test:emulator
 */
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, where, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Client {
  app: FirebaseApp;
  uid: string;
  db: Firestore;
  fns: Functions;
  call<T = unknown>(name: string, data: unknown): Promise<T>;
}

let n = 0;
async function client(): Promise<Client> {
  const app = initializeApp({ projectId: 'demo-gully-adda', apiKey: 'demo-key', appId: 'demo' }, `c${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fns = getFunctions(app, 'asia-south1');
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const cred = await signInAnonymously(auth);
  return {
    app, uid: cred.user.uid, db, fns,
    call: async <T,>(name: string, data: unknown) => (await httpsCallable(fns, name)(data)).data as T,
  };
}

async function errCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return String((e as { message?: string }).message);
  }
  return 'no_error';
}

const clients: Client[] = [];
afterAll(async () => {
  await Promise.all(clients.map((c) => deleteApp(c.app)));
});

describe('online room flow', () => {
  let host: Client, a: Client, b: Client, outsider: Client;
  let code = '';
  let seq = 1;

  beforeAll(async () => {
    host = await client();
    a = await client();
    b = await client();
    outsider = await client();
    clients.push(host, a, b, outsider);
  });

  it('host creates a room and friends join with the 6-character code', async () => {
    ({ code } = await host.call<{ code: string }>('createRoom', { name: 'Host', game: 'mafia' }));
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    await a.call('joinRoom', { code, name: 'Asha' });
    await b.call('joinRoom', { code: code.toLowerCase(), name: 'Bunty' });
    const room = (await getDoc(doc(host.db, 'rooms', code))).data()!;
    expect(room.memberUids).toEqual([host.uid, a.uid, b.uid]);
  });

  it('rejects bad names and unknown rooms', async () => {
    expect(await errCode(outsider.call('joinRoom', { code, name: '' }))).toContain('bad_name');
    expect(await errCode(outsider.call('joinRoom', { code: 'ZZZZZZ', name: 'X' }))).toContain('room_not_found');
  });

  it('only the host can change settings; host fills seats with bots', async () => {
    expect(await errCode(a.call('setSettings', { code, botCount: 3 }))).toContain('not_host');
    await host.call('setSettings', { code, botCount: 3, config: { nightSeconds: 30 } });
    const room = (await getDoc(doc(host.db, 'rooms', code))).data()!;
    expect(room.seats).toHaveLength(6);
  });

  it('outsiders cannot read the room', async () => {
    await expect(getDoc(doc(outsider.db, 'rooms', code))).rejects.toThrow();
  });

  it('start: each player gets only their own redacted view; private state is unreadable', async () => {
    await host.call('startGame', { code });
    const views = await Promise.all([host, a, b].map(async (c) => JSON.parse((await getDoc(doc(c.db, 'rooms', code, 'views', c.uid))).data()!.json)));
    for (const [i, v] of views.entries()) {
      const me = [host, a, b][i]!.uid;
      expect(v.me).toBe(me);
      expect(v.myRole).toBeTruthy();
      expect(JSON.stringify(v)).not.toContain('"rng"');
      if (v.myRole !== 'mafia') expect(Object.keys(v.knownRoles)).toEqual([me]);
    }
    await expect(getDoc(doc(a.db, 'rooms', code, 'private', 'state'))).rejects.toThrow();
    await expect(getDoc(doc(a.db, 'rooms', code, 'views', host.uid))).rejects.toThrow();
  });

  it('validates actions: wrong player, duplicates/replays and garbage', async () => {
    expect(await errCode(outsider.call('submitAction', { code, action: { type: 'ack' }, seq: 1 }))).toContain('not_in_game');
    expect(await errCode(a.call('submitAction', { code, action: { type: 'nuke' }, seq: seq++ }))).toContain('bad_action');
    await a.call('submitAction', { code, action: { type: 'ack' }, seq: 100 });
    expect(await errCode(a.call('submitAction', { code, action: { type: 'ack' }, seq: 100 }))).toContain('stale_or_duplicate');
    expect(await errCode(a.call('submitAction', { code, action: { type: 'ack' }, seq: 101 }))).toContain('not_your_turn');
  });

  it('chat follows phase rules: closed during the role reveal and night', async () => {
    expect(await errCode(a.call('sendChat', { code, channel: 'living', text: 'psst' }))).toContain('chat_closed');
  });

  it('heartbeat keeps the game moving and the game reaches night', async () => {
    await host.call('submitAction', { code, action: { type: 'ack' }, seq: 1 });
    await b.call('submitAction', { code, action: { type: 'ack' }, seq: 1 });
    await host.call('heartbeat', { code });
    const v = JSON.parse((await getDoc(doc(host.db, 'rooms', code, 'views', host.uid))).data()!.json);
    expect(v.phase).toBe('night');
  });

  it('report blocks the target and is stored server-side only', async () => {
    await a.call('reportPlayer', { code, target: b.uid, reason: 'harassment', details: 'rude' });
    await expect(getDocs(collection(a.db, 'reports'))).rejects.toThrow();
  });

  it('voice tokens are refused while voice is disabled', async () => {
    expect(await errCode(a.call('getVoiceToken', { code }))).toContain('voice_disabled');
  });

  it('kick removes and bans a player', async () => {
    expect(await errCode(a.call('kick', { code, uid: b.uid }))).toContain('not_host');
    await host.call('kick', { code, uid: b.uid });
    await expect(getDoc(doc(b.db, 'rooms', code))).rejects.toThrow();
    expect(await errCode(b.call('joinRoom', { code, name: 'Bunty' }))).toContain('banned');
  });

  it('delete my data removes the player from rooms and the auth account', async () => {
    await a.call('deleteMyData', {});
    await expect(getDoc(doc(a.db, 'rooms', code))).rejects.toThrow();
    const room = (await getDoc(doc(host.db, 'rooms', code))).data()!;
    expect(room.memberUids).not.toContain(a.uid);
    const seat = room.seats.find((s: { id: string }) => s.id === a.uid);
    expect(seat.name).toBe('Player');
    expect(seat.botControlled).toBe(true);
  });
});

describe('chat in a lobby', () => {
  it('members chat; readers exclude players who blocked the sender', async () => {
    const h = await client();
    const x = await client();
    const y = await client();
    clients.push(h, x, y);
    const { code } = await h.call<{ code: string }>('createRoom', { name: 'H' });
    await x.call('joinRoom', { code, name: 'X' });
    await y.call('joinRoom', { code, name: 'Y' });
    await y.call('blockPlayer', { target: x.uid, block: true });
    await x.call('sendChat', { code, channel: 'all', text: 'hello shit' });
    const forH = await getDocs(query(collection(h.db, 'rooms', code, 'chat'), where('readers', 'array-contains', h.uid)));
    expect(forH.docs.map((d) => d.data().text)).toEqual(['hello s***']);
    const forY = await getDocs(query(collection(y.db, 'rooms', code, 'chat'), where('readers', 'array-contains', y.uid)));
    expect(forY.size).toBe(0);
  });

  it('rate limits chat floods', async () => {
    const h = await client();
    clients.push(h);
    const { code } = await h.call<{ code: string }>('createRoom', { name: 'H' });
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const e = await errCode(h.call('sendChat', { code, channel: 'all', text: `m${i}` }));
      if (e.includes('rate_limited')) limited = true;
    }
    expect(limited).toBe(true);
  });
});
