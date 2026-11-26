import { type HnsView, type RoundResult } from '@gully/engine';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GameOverPanel, LogFeed, PlayerStrip, TurnBanner, playerName } from '../components/game';
import { Btn, Bullets, Card, Countdown, H2, P, Row } from '../components/ui';
import { t } from '../strings';
import { colors, fonts } from '../theme';
import { RealtimeRound } from './hideseek/RealtimeRound';
import { useGameNav } from './nav';
import type { BoardProps } from './types';
import { BOT_NAMES } from '../local/botNames';

function ResultLine({ r }: { r: RoundResult }) {
  return r.role === 'seeker' ? (
    <Text style={st.stat}>🫣 {t('hns.stat.caught', { n: r.caught })}{r.allCaught ? ` · ⚡ ${t('hns.stat.allCaught')}` : ''}</Text>
  ) : (
    <Text style={st.stat}>
      {r.wasCaught ? `🫣 ${t('hns.stat.caughtAt', { s: r.survivedSeconds })}` : `🏁 ${t('hns.stat.survived')}`} · 🔮 {r.marbles} · 🤝 {r.rescues}
    </Text>
  );
}

export function HideSeekBoard({ view, act, actGroup, shared }: BoardProps<HnsView>) {
  const nav = useGameNav();
  const [playing, setPlaying] = useState(false);
  const [local, setLocal] = useState<RoundResult | null>(null);
  const role = view.current.role;
  const canPlay = (view.legal as { type: string }[]).some((a) => a.type === 'submit');
  const canAck = (view.legal as { type: string }[]).some((a) => a.type === 'ack');

  // In my round, the AI kids are named after the other players (and bots), so everyone feels present.
  const others = view.players.filter((p) => p.id !== view.me).map((p) => p.name.replace(' 🤖', ''));
  const names = [t('common.you'), ...others, ...BOT_NAMES].slice(0, 6);
  if (role === 'hider') names[1] = `${others[0] ?? BOT_NAMES[0]} (${t('hns.seeker')})`;

  const done = useCallback(
    (inputs: string, r: RoundResult) => {
      setLocal(r);
      setPlaying(false);
      act({ type: 'submit', inputs } as never);
    },
    [act],
  );

  if (playing && !shared) {
    return (
      <RealtimeRound
        key={`${view.round}-${view.me}`}
        seed={view.current.seed}
        role={role}
        seconds={view.config.roundSeconds}
        aiLevel={view.config.aiLevel}
        names={names}
        onDone={done}
      />
    );
  }

  const mine = view.myResult ?? (canPlay ? null : local);
  const roundResults = view.phase === 'results' || view.over ? view.results[view.round - 1] : undefined;

  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{t('common.round', { n: view.round, total: view.config.rounds })}</H2>
        <Countdown deadline={view.deadline} />
      </Row>
      <PlayerStrip view={view} scores={view.totals} extra={(id) => (view.phase === 'play' && view.done.includes(id) ? <Text>✅</Text> : null)} />

      {view.phase === 'play' && !shared && canPlay ? (
        <Card style={{ backgroundColor: role === 'hider' ? '#E3F2FD' : '#FFEBEE' }}>
          <Text style={st.roleBig}>{role === 'hider' ? `🤫 ${t('hns.youHide')}` : `🔦 ${t('hns.youSeek')}`}</Text>
          <Bullets items={(role === 'hider' ? t('hns.brief.hide') : t('hns.brief.seek')).split('\n')} />
          <Btn label={t('hns.startRound')} icon="▶" onPress={() => { setLocal(null); setPlaying(true); }} testID="hns-start" />
        </Card>
      ) : null}

      {view.phase === 'play' && !shared && !canPlay && mine ? (
        <Card style={{ alignItems: 'center' }}>
          <Text style={st.scoreBig}>+{mine.score}</Text>
          <ResultLine r={mine} />
          <P center>{t('hns.waitOthers', { n: view.players.length - view.done.length })}</P>
        </Card>
      ) : null}

      {view.phase === 'play' && shared ? (
        <Card>
          <H2>{role === 'hider' ? `🤫 ${t('hns.youHide')}` : `🔦 ${t('hns.youSeek')}`}</H2>
          <P>{t('hns.sharedTurns')}</P>
          <P>{view.done.length}/{view.players.length} ✅</P>
        </Card>
      ) : null}

      {roundResults && !view.over ? (
        <Card>
          <H2>{t('hns.roundResults')}</H2>
          {Object.entries(roundResults)
            .sort((a, b) => b[1].score - a[1].score)
            .map(([id, r], i) => (
              <View key={id} style={st.resRow}>
                <Text style={st.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.resName}>{playerName(view, id)}</Text>
                  <ResultLine r={r} />
                </View>
                <Text style={st.resPts}>+{r.score}</Text>
              </View>
            ))}
          {canAck || shared ? <Btn label={t('hns.nextRound')} onPress={() => actGroup(() => ({ type: 'ack' } as never))} testID="hns-next" /> : null}
        </Card>
      ) : null}

      {view.over ? <GameOverPanel view={view} scores={view.totals} onAgain={nav.again} onHome={nav.home} /> : <TurnBanner view={view} />}
      <LogFeed log={view.log} max={3} />
    </View>
  );
}

const st = StyleSheet.create({
  roleBig: { fontFamily: fonts.display, fontSize: 30, color: colors.maroon },
  scoreBig: { fontFamily: fonts.display, fontSize: 56, color: colors.leaf },
  stat: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.cream },
  rank: { fontSize: 22, width: 34, textAlign: 'center', fontFamily: fonts.heading, color: colors.ink },
  resName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  resPts: { fontFamily: fonts.heading, fontSize: 20, color: colors.maroon },
});
