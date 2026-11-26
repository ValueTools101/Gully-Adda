/**
 * Firestore security rules tests (run inside the emulator):
 *   npm run test:emulator   (from repo root)
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-gully-adda',
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'rooms/ABC234'), { code: 'ABC234', hostUid: 'alice', memberUids: ['alice', 'bob'], status: 'playing' });
    await setDoc(doc(db, 'rooms/ABC234/private/state'), { json: '{"roles":{"alice":"mafia"}}' });
    await setDoc(doc(db, 'rooms/ABC234/views/alice'), { json: '{"myRole":"mafia"}' });
    await setDoc(doc(db, 'rooms/ABC234/views/bob'), { json: '{"myRole":"villager"}' });
    await setDoc(doc(db, 'rooms/ABC234/chat/m1'), { from: 'alice', text: 'hi team', channel: 'mafia', readers: ['alice'] });
    await setDoc(doc(db, 'rooms/ABC234/chat/m2'), { from: 'bob', text: 'hello', channel: 'living', readers: ['alice', 'bob'] });
    await setDoc(doc(db, 'users/alice'), { name: 'Alice', blocked: [] });
    await setDoc(doc(db, 'reports/r1'), { reporter: 'bob', target: 'alice' });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('rooms', () => {
  it('members can read the room; outsiders and signed-out users cannot', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'rooms/ABC234')));
    await assertFails(getDoc(doc(as('mallory'), 'rooms/ABC234')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'rooms/ABC234')));
  });

  it('nobody can write rooms, even the host', async () => {
    await assertFails(updateDoc(doc(as('alice'), 'rooms/ABC234'), { status: 'over' }));
    await assertFails(setDoc(doc(as('mallory'), 'rooms/ZZZ999'), { memberUids: ['mallory'] }));
    await assertFails(deleteDoc(doc(as('alice'), 'rooms/ABC234')));
  });
});

describe('private game state', () => {
  it('is unreadable and unwritable by every client', async () => {
    await assertFails(getDoc(doc(as('alice'), 'rooms/ABC234/private/state')));
    await assertFails(getDoc(doc(as('bob'), 'rooms/ABC234/private/state')));
    await assertFails(setDoc(doc(as('alice'), 'rooms/ABC234/private/state'), { json: '{}' }));
    await assertFails(getDocs(collection(as('alice'), 'rooms/ABC234/private')));
  });
});

describe('views', () => {
  it('a player can read only their own view', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'rooms/ABC234/views/alice')));
    await assertFails(getDoc(doc(as('alice'), 'rooms/ABC234/views/bob')));
    await assertFails(getDoc(doc(as('bob'), 'rooms/ABC234/views/alice')));
    await assertFails(getDocs(collection(as('bob'), 'rooms/ABC234/views')));
  });

  it('a non-member cannot read a view even with a matching uid doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'rooms/ABC234/views/mallory'), { json: '{}' });
    });
    await assertFails(getDoc(doc(as('mallory'), 'rooms/ABC234/views/mallory')));
  });

  it('views cannot be written by clients', async () => {
    await assertFails(setDoc(doc(as('alice'), 'rooms/ABC234/views/alice'), { json: '{"myRole":"doctor"}' }));
  });
});

describe('chat', () => {
  it('only listed readers can read a message', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'rooms/ABC234/chat/m1')));
    await assertFails(getDoc(doc(as('bob'), 'rooms/ABC234/chat/m1')));
    await assertSucceeds(getDocs(query(collection(as('bob'), 'rooms/ABC234/chat'), where('readers', 'array-contains', 'bob'))));
    await assertFails(getDocs(collection(as('bob'), 'rooms/ABC234/chat')));
  });

  it('clients cannot post chat directly', async () => {
    await assertFails(setDoc(doc(as('alice'), 'rooms/ABC234/chat/x'), { from: 'alice', text: 'hi', readers: ['alice', 'bob'] }));
  });
});

describe('server-only collections', () => {
  it('users and reports are closed to clients', async () => {
    await assertFails(getDoc(doc(as('alice'), 'users/alice')));
    await assertFails(setDoc(doc(as('alice'), 'users/alice'), { blocked: [] }));
    await assertFails(getDoc(doc(as('bob'), 'reports/r1')));
    await assertFails(setDoc(doc(as('bob'), 'reports/r2'), { target: 'alice' }));
    await assertFails(getDoc(doc(as('alice'), 'anything/else')));
  });
});
