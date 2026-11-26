/**
 * LiveKit voice for online Mafia (native only, behind EXPO_PUBLIC_VOICE_ENABLED).
 * The server mints the token only for room members and flips publish
 * permissions on every phase change: day = living may talk, night = all muted,
 * out = listen only. If anything fails we fall back to text chat.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, P, Row } from '../components/ui';
import { api, errorMessage } from '../online/api';
import { t } from '../strings';
import { colors } from '../theme';
import { VOICE_FLAG } from './flag';
import type { VoicePanelProps } from './VoicePanel';

type LkRoom = {
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  on(ev: string, cb: (...a: unknown[]) => void): void;
  localParticipant: { setMicrophoneEnabled(on: boolean): Promise<unknown>; permissions?: { canPublish?: boolean } };
  remoteParticipants: Map<string, { identity: string; setVolume(v: number): void }>;
};

let globalsRegistered = false;

function loadLiveKit(): { Room: new () => LkRoom; RoomEvent: Record<string, string>; AudioSession: { startAudioSession(): Promise<void>; stopAudioSession(): Promise<void> } } | null {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const rn = require('@livekit/react-native');
    const lk = require('livekit-client');
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (!globalsRegistered) {
      rn.registerGlobals();
      globalsRegistered = true;
    }
    return { Room: lk.Room, RoomEvent: lk.RoomEvent, AudioSession: rn.AudioSession };
  } catch {
    return null; // e.g. running in Expo Go
  }
}

export function VoicePanel({ code, canSpeak, amAlive, night, blocked, dark }: VoicePanelProps) {
  const [status, setStatus] = useState<'off' | 'connecting' | 'on' | 'error'>('off');
  const [mic, setMic] = useState(false);
  const [err, setErr] = useState('');
  const roomRef = useRef<LkRoom | null>(null);
  const lkRef = useRef<ReturnType<typeof loadLiveKit>>(null);

  // Server-side permissions are authoritative; mirror them locally too.
  useEffect(() => {
    if (!canSpeak && mic && roomRef.current) {
      roomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      setMic(false);
    }
  }, [canSpeak, mic]);

  // Blocked players are silenced on this device.
  useEffect(() => {
    roomRef.current?.remoteParticipants.forEach((p) => p.setVolume(blocked[p.identity] ? 0 : 1));
  }, [blocked, status]);

  useEffect(
    () => () => {
      roomRef.current?.disconnect().catch(() => {});
      lkRef.current?.AudioSession.stopAudioSession().catch(() => {});
    },
    [],
  );

  if (!VOICE_FLAG) return null;

  const join = async () => {
    setErr('');
    const lk = loadLiveKit();
    if (!lk) {
      setStatus('error');
      setErr(t('voice.unavailable'));
      return;
    }
    lkRef.current = lk;
    setStatus('connecting');
    try {
      const { token, url } = await api.voiceToken(code);
      await lk.AudioSession.startAudioSession();
      const room = new lk.Room();
      room.on(lk.RoomEvent.ParticipantConnected ?? 'participantConnected', (p) => {
        const rp = p as { identity: string; setVolume(v: number): void };
        if (blocked[rp.identity]) rp.setVolume(0);
      });
      room.on(lk.RoomEvent.Disconnected ?? 'disconnected', () => {
        setStatus('off');
        setMic(false);
      });
      await room.connect(url || process.env.EXPO_PUBLIC_LIVEKIT_URL || '', token);
      roomRef.current = room;
      setStatus('on');
    } catch (e) {
      setStatus('error');
      setErr(`${t('voice.unavailable')} (${errorMessage(e)})`);
    }
  };

  const leave = async () => {
    await roomRef.current?.disconnect().catch(() => {});
    await lkRef.current?.AudioSession.stopAudioSession().catch(() => {});
    roomRef.current = null;
    setStatus('off');
    setMic(false);
  };

  const toggleMic = async () => {
    if (!roomRef.current || !canSpeak) return;
    const next = !mic;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(next);
      setMic(next);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  const fg = dark ? colors.cream : colors.ink;
  return (
    <Card dark={dark}>
      <Row style={{ justifyContent: 'space-between' }}>
        {status === 'on' ? (
          <>
            <Btn small kind={mic ? 'danger' : 'secondary'} disabled={!canSpeak} label={mic ? `🎙️ ${t('voice.talk')}` : `🔇 ${t('voice.muted')}`} onPress={toggleMic} />
            <Btn small kind="ghost" label={t('voice.leave')} onPress={leave} />
          </>
        ) : (
          <Btn small kind="secondary" label={`🎧 ${t('voice.join')}`} loading={status === 'connecting'} onPress={join} />
        )}
      </Row>
      <View>
        {!amAlive ? <P style={{ color: fg }}>{t('voice.deadListen')}</P> : night ? <P style={{ color: fg }}>{t('voice.nightMuted')}</P> : null}
        {err ? <P style={{ color: colors.danger }}>{err}</P> : null}
      </View>
    </Card>
  );
}
