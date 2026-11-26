import type { BaseView, LogEntry, PlayerId, PlayerInfo } from '@gully/engine';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { feedback, type HapticKind, type SoundName } from '../lib/feedback';
import { t } from '../strings';
import { colors, fonts, radius, retroShadow, seatColors } from '../theme';
import { Btn, Card, H1, H2, P } from './ui';

export function playerName(view: { players: PlayerInfo[] }, id: PlayerId | null | undefined): string {
  return view.players.find((p) => p.id === id)?.name ?? '?';
}

export function seatColor(view: { players: PlayerInfo[] }, id: PlayerId): string {
  const i = view.players.findIndex((p) => p.id === id);
  return seatColors[i % seatColors.length] ?? colors.inkSoft;
}

export function logText(e: LogEntry): string {
  return t(`log.${e.key}`, e.params);
}

/** Scores strip: every player with points and turn marker. */
export function PlayerStrip({
  view, scores, active, dark, extra, colorOf,
}: {
  view: BaseView; scores?: Record<PlayerId, number>; active?: PlayerId[]; dark?: boolean;
  extra?: (id: PlayerId) => ReactNode; colorOf?: (id: PlayerId) => string;
}) {
  return (
    <View style={s.strip}>
      {view.players.map((p) => {
        const on = active?.includes(p.id);
        return (
          <View key={p.id} style={[s.player, on && s.playerOn, dark && { backgroundColor: colors.nightSoft, borderColor: colors.cream }]}>
            <View style={[s.dot, { backgroundColor: colorOf ? colorOf(p.id) : seatColor(view, p.id) }]} />
            <Text style={[s.pname, dark && { color: colors.cream }]} numberOfLines={1}>
              {p.name}
              {p.isBot ? ' 🤖' : ''}
              {p.id === view.me && p.name !== t('setup.you') ? ` (${t('common.you')})` : ''}
            </Text>
            {scores ? <Text style={[s.pscore, dark && { color: colors.mustard }]}>{scores[p.id] ?? 0}</Text> : null}
            {extra?.(p.id)}
          </View>
        );
      })}
    </View>
  );
}

/** Latest game events, newest first. */
export function LogFeed({ log, dark, max = 4 }: { log: LogEntry[]; dark?: boolean; max?: number }) {
  const items = log.slice(-max).reverse();
  return (
    <View style={[s.log, dark && { backgroundColor: colors.nightSoft, borderColor: colors.cream }]} accessibilityLiveRegion="polite">
      {items.map((e, i) => (
        <Text key={`${log.length}-${i}`} style={[s.logLine, i === 0 && s.logFirst, dark && { color: colors.cream }]}>
          {logText(e)}
        </Text>
      ))}
    </View>
  );
}

const LOG_SOUNDS: Record<string, SoundName> = {
  'ludo.rolled': 'dice',
  'ludo.captured': 'capture',
  'ludo.tokenHome': 'box',
  'dots.boxed': 'box',
  'npat.stop': 'stop',
  'npat.letter': 'reveal',
  'npat.challengeTime': 'phase',
  'mafia.night': 'phase',
  'mafia.day': 'phase',
  'mafia.voteTime': 'phase',
  'mafia.killed': 'lose',
  'mafia.eliminated': 'lose',
  'rmcs.rajaIs': 'reveal',
  'rmcs.caught': 'win',
  'rmcs.escaped': 'lose',
  'game.winner': 'win',
  'game.over': 'win',
  'mafia.win.village': 'win',
  'mafia.win.mafia': 'win',
};

const LOG_HAPTICS: Record<string, HapticKind> = {
  'ludo.captured': 'heavy',
  'npat.stop': 'heavy',
  'mafia.killed': 'warning',
  'mafia.eliminated': 'warning',
  'rmcs.escaped': 'warning',
  'game.winner': 'success',
  'game.over': 'success',
  'rmcs.caught': 'success',
  'mafia.win.village': 'success',
  'mafia.win.mafia': 'success',
};

/** Plays a sound (and haptic) for each new log entry (works for local and online views). */
export function useLogSounds(log: LogEntry[], version: number): void {
  const last = useRef<number | null>(null);
  const seen = useRef(0);
  useEffect(() => {
    if (last.current === null) {
      last.current = version;
      seen.current = log.length;
      return;
    }
    if (version === last.current) return;
    last.current = version;
    const fresh = log.slice(Math.min(seen.current, log.length));
    seen.current = log.length;
    const key = fresh.map((e) => e.key).reverse().find((k) => LOG_SOUNDS[k]);
    if (key) feedback(LOG_SOUNDS[key] as SoundName, LOG_HAPTICS[key] ?? 'tap');
  }, [log, version]);
}

/** Full-screen "pass the phone" gate for hidden information. */
export function PassGate({ name, onReveal, dark }: { name: string; onReveal: () => void; dark?: boolean }) {
  return (
    <Pressable
      testID="pass-gate"
      accessibilityRole="button"
      accessibilityLabel={t('pass.tapToReveal', { name })}
      onPress={() => {
        feedback('reveal', 'heavy');
        onReveal();
      }}
      style={[s.gate, dark && { backgroundColor: colors.night }]}
    >
      <Text style={s.gateEmoji}>📱🤫</Text>
      <P center style={{ color: colors.cream, fontSize: 18 }}>{t('pass.to')}</P>
      <H1 style={{ color: colors.mustard, textAlign: 'center', fontSize: 44 }}>{name}</H1>
      <View style={s.gateBtn}>
        <Text style={s.gateBtnText}>{t('pass.tapToReveal', { name })}</Text>
      </View>
    </Pressable>
  );
}

export function GameOverPanel({
  view, scores, title, onAgain, onHome, dark,
}: { view: BaseView; scores: Record<PlayerId, number>; title?: string; onAgain?: () => void; onHome: () => void; dark?: boolean }) {
  const ranked = view.players.slice().sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const best = scores[ranked[0]?.id ?? ''] ?? 0;
  const winners = ranked.filter((p) => (scores[p.id] ?? 0) === best).map((p) => p.name);
  return (
    <Card style={{ alignItems: 'stretch' }} dark={dark}>
      <Text style={s.trophy}>🏆</Text>
      <H1 style={{ textAlign: 'center', color: dark ? colors.mustard : colors.maroon }}>
        {title ?? (winners.length > 1 ? t('over.tie', { name: winners.join(', ') }) : t('over.winner', { name: winners[0] ?? '' }))}
      </H1>
      <H2 style={dark ? { color: colors.cream } : undefined}>{t('common.leaderboard')}</H2>
      {ranked.map((p, i) => (
        <View key={p.id} style={s.rankRow}>
          <Text style={[s.rank, dark && { color: colors.cream }]}>{i + 1}.</Text>
          <Text style={[s.rankName, dark && { color: colors.cream }]}>{p.name}</Text>
          <Text style={[s.rankPts, dark && { color: colors.mustard }]}>{scores[p.id] ?? 0}</Text>
        </View>
      ))}
      <View style={{ gap: 10, marginTop: 8 }}>
        {onAgain ? <Btn label={t('common.playAgain')} onPress={onAgain} testID="play-again" /> : null}
        <Btn label={t('common.home')} kind="ghost" onPress={onHome} />
      </View>
    </Card>
  );
}

/** Small banner showing whose turn it is / who we're waiting for. */
export function TurnBanner({ view, dark }: { view: BaseView; dark?: boolean }) {
  if (view.over) return null;
  const mine = view.me && view.waitingFor.includes(view.me);
  const names = view.waitingFor.map((id) => playerName(view, id)).join(', ');
  return (
    <View style={[s.banner, mine && { backgroundColor: colors.leaf }, dark && !mine && { backgroundColor: colors.nightSoft }]}>
      <Text style={s.bannerText}>{mine ? t('common.yourTurn') : names ? t('common.waitingFor', { names }) : '…'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%' },
  playerOn: { backgroundColor: colors.mustard, borderWidth: 3 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink },
  pname: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, maxWidth: 140 },
  pscore: { fontFamily: fonts.heading, fontSize: 15, color: colors.maroon },
  log: { backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md, padding: 10, gap: 2, borderStyle: 'dashed' },
  logLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  logFirst: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 14 },
  gate: { flex: 1, minHeight: 480, backgroundColor: colors.maroon, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  gateEmoji: { fontSize: 64 },
  gateBtn: { marginTop: 24, backgroundColor: colors.mustard, borderRadius: radius.md, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 18, paddingVertical: 14, ...retroShadow },
  gateBtnText: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, textAlign: 'center' },
  trophy: { fontSize: 56, textAlign: 'center' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  rank: { fontFamily: fonts.heading, fontSize: 20, width: 32, color: colors.ink },
  rankName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  rankPts: { fontFamily: fonts.heading, fontSize: 20, color: colors.maroon },
  banner: { backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'stretch' },
  bannerText: { fontFamily: fonts.heading, fontSize: 17, color: colors.white, textAlign: 'center' },
});
