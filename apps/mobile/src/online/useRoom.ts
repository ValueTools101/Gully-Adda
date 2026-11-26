import type { BaseView } from '@gully/engine';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, type ChatMsg, type RoomDoc } from './api';
import { ensureSignedIn, firebase } from './firebase';

const HEARTBEAT_MS = 15_000;

/** Live room + my redacted view + chat, plus heartbeat/reconnect handling. */
export function useRoom(code: string) {
  const [uid, setUid] = useState<string | null>(null);
  /** undefined = loading, null = gone / not a member */
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  const [view, setView] = useState<BaseView | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    ensureSignedIn().then((u) => alive && setUid(u.uid)).catch((e) => setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    const { db } = firebase();
    const offRoom = onSnapshot(
      doc(db, 'rooms', code),
      { includeMetadataChanges: true },
      (s) => {
        setConnected(!s.metadata.fromCache);
        setRoom(s.exists() ? (s.data() as RoomDoc) : null);
      },
      (e) => setError(e.code === 'permission-denied' ? 'not_in_room' : e.message),
    );
    const offView = onSnapshot(
      doc(db, 'rooms', code, 'views', uid),
      (s) => setView(s.exists() ? (JSON.parse(s.get('json') as string) as BaseView) : null),
      () => setView(null),
    );
    const offChat = onSnapshot(
      query(collection(db, 'rooms', code, 'chat'), where('readers', 'array-contains', uid), orderBy('at', 'desc'), limit(60)),
      (s) => setChat(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMsg, 'id'>) })).reverse()),
      () => {},
    );
    return () => {
      offRoom();
      offView();
      offChat();
    };
  }, [uid, code]);

  // Heartbeat: keeps my seat (a bot takes over after ~45s of silence) and ticks timers.
  useEffect(() => {
    if (!uid) return;
    const beat = () => api.heartbeat(code).catch(() => {});
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') beat();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [uid, code]);

  // When a phase timer runs out, nudge the server so nobody waits for the scheduler.
  useEffect(() => {
    const d = view?.deadline ?? null;
    deadlineRef.current = d;
    if (!d || view?.over) return;
    const id = setTimeout(() => {
      if (deadlineRef.current === d) api.heartbeat(code).catch(() => {});
    }, Math.max(0, d - Date.now()) + 800);
    return () => clearTimeout(id);
  }, [view?.deadline, view?.over, code]);

  return { uid, room, view, chat, error, connected };
}
