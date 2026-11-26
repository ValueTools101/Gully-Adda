import { GAME_ORDER, getGame, type BotDifficulty, type GameAction, type MafiaView } from '@gully/engine';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useLogSounds } from '../../src/components/game';
import { Btn, Card, Chip, H2, Header, HelpButton, P, Row, Screen, Segment, Stepper } from '../../src/components/ui';
import { GAME_UI } from '../../src/games';
import { ConfigEditor } from '../../src/games/ConfigEditor';
import { GameNavContext } from '../../src/games/nav';
import { feedback } from '../../src/lib/feedback';
import { useSettings } from '../../src/lib/settings';
import { api, errorMessage, type RoomDoc } from '../../src/online/api';
import { ChatPanel } from '../../src/online/ChatPanel';
import { FloatingReactions, REACTION_PREFIX, ReactionBar, useFloaters } from '../../src/components/Reactions';
import { canSpeak, writableChannels } from '../../src/online/chatPolicy';
import { PlayersSheet } from '../../src/online/PlayersSheet';
import { useRoom } from '../../src/online/useRoom';
import { t } from '../../src/strings';
import { colors, fonts, radius, retroShadow } from '../../src/theme';
import { VoicePanel } from '../../src/voice/VoicePanel';

export default function OnlineRoom() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = String(raw ?? '').toUpperCase();
  const router = useRouter();
  const { uid, room, view, chat, error, connected } = useRoom(code);
  const { settings } = useSettings();
  const [err, setErr] = useState('');
  useLogSounds(view?.log ?? [], view?.version ?? 0);
  const floaters = useFloaters();
  const addFloater = floaters.add;
  const seenChat = useRef<Set<string> | null>(null);
  useEffect(() => {
    // Float new reactions (ignore ones that were already there when we opened the room).
    if (!seenChat.current) {
      seenChat.current = new Set(chat.map((m) => m.id));
      return;
    }
    for (const m of chat) {
      if (seenChat.current.has(m.id)) continue;
      seenChat.current.add(m.id);
      if (m.text.startsWith(REACTION_PREFIX) && !settings.blocked[m.from]) addFloater(m.text.slice(REACTION_PREFIX.length, REACTION_PREFIX.length + 4), m.from === uid ? t('common.you') : m.name);
    }
  }, [chat, addFloater, settings.blocked, uid]);

  const leave = async () => {
    await api.leaveRoom(code).catch(() => {});
    router.replace('/');
  };
  const nav = useMemo(() => ({ home: leave, again: room?.hostUid === uid ? () => api.setSettings(code, {}).catch(() => {}) : undefined }), [room?.hostUid, uid, code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error || room === null) {
    return (
      <Screen>
        <Header title={t('online.lobby', { code })} onBack={() => router.replace('/')} />
        <Card>
          <P>{t('online.error', { msg: error ?? 'room_not_found' })}</P>
          <Btn label={t('common.home')} onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }
  if (!uid || !room) {
    return (
      <Screen>
        <Header title={t('online.lobby', { code })} />
        <P>{t('online.signingIn')}</P>
      </Screen>
    );
  }

  const dark = room.game === 'mafia' && room.status !== 'lobby';
  const inGame = room.status !== 'lobby' && view;
  const Board = GAME_UI[room.game].Board;

  const act = (action: GameAction) => {
    setErr('');
    api.submitAction(code, action).catch((e) => {
      feedback('tap', 'warning');
      setErr(errorMessage(e));
    });
  };

  const reactChannel = writableChannels(view, room.status)[0];
  const react = (e: string) => {
    if (reactChannel) api.sendChat(code, reactChannel, `${REACTION_PREFIX}${e}`).catch((x) => setErr(errorMessage(x)));
  };

  return (
    <GameNavContext.Provider value={nav}>
      <View style={{ flex: 1 }}>
      <Screen dark={dark} testID="online-room">
        <Header title={inGame ? t(`game.${room.game}.title`) : t('online.lobby', { code })} dark={dark} onBack={leave} right={<HelpButton game={room.game} dark={dark} />} />
        {!connected ? <P style={{ color: colors.danger }}>📡 {t('online.offline')}</P> : null}
        {inGame ? (
          <>
            {room.game === 'mafia' ? (
              <VoicePanel
                code={code}
                canSpeak={canSpeak(view)}
                amAlive={(view as MafiaView).amAlive}
                night={(view as MafiaView).phase === 'night'}
                blocked={settings.blocked}
                dark={dark}
              />
            ) : null}
            <Board view={view} mode="online" shared={false} act={act} actGroup={(make) => { const a = make(uid); if (a) act(a); }} humans={[uid]} />
            {err ? <P style={{ color: colors.danger }}>{err}</P> : null}
          </>
        ) : (
          <Lobby room={room} uid={uid} onError={setErr} />
        )}
        {err && !inGame ? <P style={{ color: colors.danger }}>{err}</P> : null}
        <ReactionBar dark={dark} onReact={react} disabled={!reactChannel} />
        <ChatPanel code={code} chat={chat.filter((m) => !m.text.startsWith(REACTION_PREFIX))} view={view} status={room.status} uid={uid} dark={dark} />
        <PlayersSheet room={room} uid={uid} dark={dark} />
        <Btn kind="ghost" small label={t('online.leave')} onPress={leave} />
      </Screen>
      <FloatingReactions items={floaters.items} />
      </View>
    </GameNavContext.Provider>
  );
}

function Lobby({ room, uid, onError }: { room: RoomDoc; uid: string; onError: (e: string) => void }) {
  const isHost = room.hostUid === uid;
  const def = getGame(room.game)!;
  const { minPlayers: min, maxPlayers: max } = def.meta;
  const humans = room.seats.filter((s) => !s.isBot).length;
  const bots = room.seats.length - humans;
  const okCount = room.seats.length >= min && room.seats.length <= max;
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const set = (s: Parameters<typeof api.setSettings>[1]) => api.setSettings(room.code, s).catch((e) => onError(errorMessage(e)));
  const share = () =>
    Share.share({ message: `Join my Gully Adda room! Open the app > Play online > Join room > ${room.code}` }).catch(() => {});

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ alignItems: 'center', backgroundColor: colors.mustard }}>
        <P>{t('online.shareCode')}</P>
        <Text style={st.code} selectable testID="room-code">{room.code}</Text>
        <Row>
          <Btn small kind="ghost" label={copied ? t('online.copied') : t('online.copy')} onPress={() => { Clipboard.setStringAsync(room.code).catch(() => {}); setCopied(true); }} />
          <Btn small kind="ghost" label="📤 Share" onPress={share} />
        </Row>
      </Card>

      <Card>
        <H2>{t('online.game')}: {GAME_UI[room.game].emoji} {t(`game.${room.game}.title`)}</H2>
        {isHost ? (
          <Row>
            {GAME_ORDER.map((g) => (
              <Chip key={g} label={`${GAME_UI[g].emoji} ${t(`game.${g}.title`)}`} active={g === room.game} onPress={() => set({ game: g })} />
            ))}
          </Row>
        ) : null}
        <P>
          👥 {room.seats.length} · {okCount ? '✅' : t('online.needPlayers', { min, max })}
        </P>
        {isHost ? (
          <>
            <Stepper label={`🤖 ${t('setup.bots.count')}`} value={bots} min={0} max={Math.max(0, max - humans)} onChange={(v) => set({ botCount: v })} />
            {bots > 0 ? (
              <Segment<BotDifficulty>
                options={[{ value: 'easy', label: t('setup.easy') }, { value: 'medium', label: t('setup.medium') }, { value: 'hard', label: t('setup.hard') }]}
                value={room.botDifficulty}
                onChange={(d) => set({ botDifficulty: d })}
              />
            ) : null}
            <Btn small kind="ghost" label={t('online.fillBots')} disabled={room.seats.length >= min} onPress={() => set({ botCount: Math.max(0, min - humans) })} />
          </>
        ) : null}
      </Card>

      {isHost ? (
        <Card>
          <H2>{t('setup.settings')}</H2>
          <ConfigEditor game={room.game} players={room.seats.length} config={room.config} onChange={(c) => set({ config: c })} online />
        </Card>
      ) : null}

      {isHost ? (
        <Btn
          label={t('online.start')}
          icon="▶"
          disabled={!okCount}
          loading={starting}
          onPress={async () => {
            setStarting(true);
            await api.startGame(room.code).catch((e) => onError(errorMessage(e)));
            setStarting(false);
          }}
          testID="online-start"
        />
      ) : (
        <Card>
          <P center>⏳ {t('online.waitingHost')}</P>
        </Card>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  code: { fontFamily: fonts.display, fontSize: 52, letterSpacing: 8, color: colors.maroon, backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 16, ...retroShadow },
});
