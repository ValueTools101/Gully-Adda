import type { RmcsRole, RmcsView } from '@gully/engine';
import { StyleSheet, Text, View } from 'react-native';
import { GameOverPanel, LogFeed, PlayerStrip, TurnBanner, playerName } from '../components/game';
import { Btn, Card, Countdown, H2, P } from '../components/ui';
import { t } from '../strings';
import { colors, fonts, radius, retroShadow } from '../theme';
import { useGameNav } from './nav';
import type { BoardProps } from './types';

const ROLE_EMOJI: Record<RmcsRole, string> = { raja: '👑', mantri: '📜', chor: '🦹', sipahi: '👮' };
const ROLE_COLOR: Record<RmcsRole, string> = { raja: colors.mustard, mantri: colors.teal, chor: colors.inkSoft, sipahi: colors.sky };

export function Chit({ role, big }: { role: RmcsRole; big?: boolean }) {
  return (
    <View style={[st.chit, big && st.chitBig, { backgroundColor: ROLE_COLOR[role] }]} accessibilityLabel={t(`rmcs.${role}`)}>
      <Text style={[st.chitEmoji, big && { fontSize: 72 }]}>{ROLE_EMOJI[role]}</Text>
      <Text style={[st.chitText, big && { fontSize: 30 }]}>{t(`rmcs.${role}`)}</Text>
    </View>
  );
}

export function RmcsBoard({ view, act, actGroup, shared }: BoardProps<RmcsView>) {
  const legal = view.legal as { type: string; target?: string }[];
  const canAck = legal.some((a) => a.type === 'ack');
  const guesses = legal.filter((a) => a.type === 'guess');
  const mantri = Object.entries(view.known).find(([, r]) => r === 'mantri')?.[0];
  const last = view.history[view.history.length - 1];
  const nav = useGameNav();

  return (
    <View style={{ gap: 12 }}>
      <View style={st.top}>
        <H2>{t('common.round', { n: view.round, total: view.config.rounds })}</H2>
        <Countdown deadline={view.deadline} />
      </View>
      <PlayerStrip view={view} scores={view.totals} active={view.phase === 'guess' ? view.waitingFor : undefined} />

      {view.phase === 'peek' && (
        <Card style={{ alignItems: 'center' }}>
          {view.mySlip && !shared ? (
            <>
              <P>{t('rmcs.yourChit')}</P>
              <Chit role={view.mySlip} big />
            </>
          ) : (
            <P center>{t('rmcs.peekWait')}</P>
          )}
          {canAck && !shared ? <Btn label={t('rmcs.gotIt')} onPress={() => act({ type: 'ack' })} testID="rmcs-ack" /> : null}
          <View style={st.knownRow}>
            {Object.entries(view.known).map(([id, role]) => (
              <View key={id} style={{ alignItems: 'center' }}>
                <Chit role={role} />
                <Text style={st.knownName}>{playerName(view, id)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {view.phase === 'guess' && (
        <Card style={{ alignItems: 'center' }}>
          <View style={st.knownRow}>
            {Object.entries(view.known).map(([id, role]) => (
              <View key={id} style={{ alignItems: 'center' }}>
                <Chit role={role} />
                <Text style={st.knownName}>{playerName(view, id)}</Text>
              </View>
            ))}
          </View>
          {guesses.length ? (
            <>
              <H2>{t('rmcs.mantriGuess')}</H2>
              {guesses.map((g) => (
                <Btn key={g.target} label={`🦹 ${playerName(view, g.target)}?`} onPress={() => act({ type: 'guess', target: g.target } as never)} kind="secondary" style={{ alignSelf: 'stretch' }} />
              ))}
            </>
          ) : (
            <P center>{t('rmcs.waitingMantri', { name: playerName(view, mantri) })}</P>
          )}
        </Card>
      )}

      {view.phase === 'result' && last && (
        <Card style={{ alignItems: 'center' }}>
          <H2 style={{ color: last.correct ? colors.leaf : colors.danger }}>{last.correct ? t('rmcs.correct') : t('rmcs.wrong')}</H2>
          <View style={st.knownRow}>
            {view.players.map((p) => (
              <View key={p.id} style={{ alignItems: 'center' }}>
                <Chit role={last.slips[p.id] as RmcsRole} />
                <Text style={st.knownName}>{p.name}</Text>
                <Text style={st.pts}>+{last.points[p.id] ?? 0}</Text>
              </View>
            ))}
          </View>
          {!view.over && (canAck || shared) ? (
            <Btn label={t('rmcs.nextRound')} onPress={() => actGroup(() => ({ type: 'ack' }))} testID="rmcs-next" />
          ) : null}
        </Card>
      )}

      {view.over ? <GameOverPanel view={view} scores={view.totals} onAgain={nav.again} onHome={nav.home} /> : <TurnBanner view={view} />}
      <LogFeed log={view.log} />
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chit: { width: 76, height: 92, borderRadius: radius.sm, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...retroShadow, transform: [{ rotate: '-2deg' }] },
  chitBig: { width: 200, height: 230, borderWidth: 4, marginVertical: 8 },
  chitEmoji: { fontSize: 32 },
  chitText: { fontFamily: fonts.heading, fontSize: 15, color: colors.ink },
  knownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 4 },
  knownName: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 6, color: colors.ink },
  pts: { fontFamily: fonts.heading, fontSize: 16, color: colors.maroon },
});
