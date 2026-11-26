import { SKIP, type MafiaRole, type MafiaView, type PlayerId } from '@gully/engine';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SkyBanner } from '../art/Decor';
import { GameOverPanel, LogFeed, playerName } from '../components/game';
import { Btn, Card, Countdown, H2, P } from '../components/ui';
import { t } from '../strings';
import { colors, fonts, radius, retroShadow } from '../theme';
import { useGameNav } from './nav';
import type { BoardProps } from './types';

export const ROLE_EMOJI: Record<MafiaRole, string> = { mafia: '🕶️', doctor: '🩺', detective: '🔍', villager: '🧑‍🌾' };
const ROLE_BG: Record<MafiaRole, string> = { mafia: '#3A0D1A', doctor: colors.leaf, detective: colors.sky, villager: colors.saffron };

function RoleCard({ role, team, view }: { role: MafiaRole; team: PlayerId[]; view: MafiaView }) {
  return (
    <View style={[st.role, { backgroundColor: ROLE_BG[role] }]} testID="mafia-role">
      <Text style={st.roleEmoji}>{ROLE_EMOJI[role]}</Text>
      <Text style={st.roleTitle}>{t(`mafia.${role}`)}</Text>
      <Text style={st.roleDesc}>{t(`mafia.role.${role}`)}</Text>
      {role === 'mafia' && team.length > 1 ? (
        <Text style={st.roleDesc}>
          {t('mafia.team')}: {team.map((id) => playerName(view, id)).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function PeopleGrid({ view }: { view: MafiaView }) {
  return (
    <View style={st.grid}>
      {view.players.map((p) => {
        const alive = view.alive.includes(p.id);
        const role = view.knownRoles[p.id];
        return (
          <View key={p.id} style={[st.person, !alive && st.personOut]}>
            <Text style={st.personEmoji}>{alive ? (role && p.id !== view.me ? ROLE_EMOJI[role] : '🙂') : '👻'}</Text>
            <Text style={st.personName} numberOfLines={1}>
              {p.name}
              {p.id === view.me && p.name !== t('setup.you') ? ` (${t('common.you')})` : ''}
            </Text>
            {!alive && role ? <Text style={st.personRole}>{t(`mafia.${role}`)}</Text> : null}
            {view.voted.includes(p.id) ? <Text style={st.personRole}>🗳 {t('mafia.voted')}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function MafiaBoard({ view, act, actGroup, shared }: BoardProps<MafiaView>) {
  const nav = useGameNav();
  const { width } = useWindowDimensions();
  const legal = view.legal as { type: string; target?: string }[];
  const night = view.phase === 'night' || view.phase === 'roles';
  const team = Object.entries(view.knownRoles).filter(([, r]) => r === 'mafia').map(([id]) => id);
  const showPrivate = !shared && !!view.myRole;
  const nightType = legal[0]?.type;
  const title = view.phase === 'roles' ? t('mafia.yourRole') : night ? `🌙 ${t('mafia.night', { n: view.day })}` : `☀️ ${t('mafia.day', { n: view.day })}`;

  if (view.over) {
    const title2 = view.winner === 'village' ? t('mafia.winVillage') : view.winner === 'mafia' ? t('mafia.winMafia') : t('mafia.winDraw');
    const scores = Object.fromEntries(
      view.players.map((p) => {
        const team2 = view.knownRoles[p.id] === 'mafia' ? 'mafia' : 'village';
        return [p.id, (view.winner === team2 ? 100 : 0) + (view.alive.includes(p.id) ? 20 : 0)];
      }),
    );
    return (
      <View style={{ gap: 12 }}>
        <PeopleGrid view={view} />
        <View style={st.grid}>
          {view.players.map((p) => (
            <Text key={p.id} style={st.reveal}>
              {ROLE_EMOJI[view.knownRoles[p.id] ?? 'villager']} {p.name}: {t(`mafia.${view.knownRoles[p.id] ?? 'villager'}`)}
            </Text>
          ))}
        </View>
        <GameOverPanel view={view} scores={scores} title={title2} onAgain={nav.again} onHome={nav.home} dark />
        <LogFeed log={view.log} dark max={5} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View>
        <SkyBanner night={night} width={Math.min(width - 32, 608)} />
        <View style={st.skyTitle}>
          <H2 style={{ color: night ? colors.cream : colors.ink }}>{title}</H2>
          <Countdown deadline={view.deadline} dark />
        </View>
      </View>

      {showPrivate && !view.amAlive ? (
        <Card dark>
          <P style={{ color: colors.cream }}>👻 {t('mafia.youAreOut')}</P>
        </Card>
      ) : null}

      {showPrivate && view.myRole && (view.phase === 'roles' || view.phase === 'night') ? <RoleCard role={view.myRole} team={team} view={view} /> : null}

      {view.phase === 'roles' && showPrivate && legal.length ? (
        <Btn label={t('rmcs.gotIt')} onPress={() => act({ type: 'ack' } as never)} testID="mafia-ack" />
      ) : null}

      {view.phase === 'night' && showPrivate && view.amAlive ? (
        <Card dark>
          {legal.length ? (
            <>
              <H2 style={{ color: colors.mustard }}>
                {nightType === 'kill' ? t('mafia.pickVictim') : nightType === 'save' ? t('mafia.pickSave') : t('mafia.pickCheck')}
              </H2>
              {legal.map((a) => {
                const picks = Object.entries(view.mafiaVotes).filter(([, tg]) => tg === a.target).map(([id]) => playerName(view, id));
                return (
                  <Btn
                    key={a.target}
                    kind="dark"
                    label={`${playerName(view, a.target)}${picks.length ? `  ← ${picks.join(', ')}` : ''}`}
                    onPress={() => act({ type: nightType, target: a.target } as never)}
                    testID={`mafia-target-${a.target}`}
                  />
                );
              })}
            </>
          ) : (
            <P style={{ color: colors.cream }}>{view.myRole === 'villager' ? t('mafia.sleeping') : `✅ ${t('mafia.doneTonight')}`}</P>
          )}
          {view.myCheckTonight ? <P style={{ color: colors.cream }}>🔍 {playerName(view, view.myCheckTonight)}</P> : null}
          {view.mySave ? <P style={{ color: colors.cream }}>🩺 {playerName(view, view.mySave)}</P> : null}
        </Card>
      ) : null}

      {view.myChecks.length && showPrivate ? (
        <Card dark>
          <H2 style={{ color: colors.cream }}>{t('mafia.checks')}</H2>
          {view.myChecks.map((c) => (
            <P key={`${c.night}-${c.target}`} style={{ color: c.isMafia ? colors.pink : colors.cream }}>
              {c.isMafia ? t('mafia.isMafia', { name: playerName(view, c.target) }) : t('mafia.notMafia', { name: playerName(view, c.target) })}
            </P>
          ))}
        </Card>
      ) : null}

      {night && shared ? (
        <Card dark style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 56 }}>🌙</Text>
          <P center style={{ color: colors.cream }}>{t('mafia.nightWait')}</P>
        </Card>
      ) : null}

      {view.phase === 'day' ? (
        <Card style={{ backgroundColor: colors.mustard }}>
          {view.lastNight ? (
            <H2>
              {view.lastNight.killed ? t('log.mafia.killed', { name: playerName(view, view.lastNight.killed) }) : t('log.mafia.quietNight')}
            </H2>
          ) : null}
          <P>{t('mafia.discuss')}</P>
          {shared || legal.length ? (
            <Btn
              label={shared ? t('mafia.startVote') : t('mafia.readyToVote')}
              onPress={() => actGroup(() => ({ type: 'ready' } as never))}
              testID="mafia-ready"
            />
          ) : null}
          <P>{view.acked.length}/{view.alive.length} ✋</P>
        </Card>
      ) : null}

      {view.phase === 'vote' && !shared && view.amAlive && legal.length ? (
        <Card>
          <H2>{t('mafia.vote')}</H2>
          {legal.map((a) => (
            <Btn
              key={a.target}
              kind={a.target === SKIP ? 'ghost' : 'secondary'}
              label={a.target === SKIP ? t('mafia.skipVote') : playerName(view, a.target)}
              onPress={() => act({ type: 'vote', target: a.target } as never)}
              testID={`mafia-vote-${a.target}`}
            />
          ))}
        </Card>
      ) : null}
      {view.phase === 'vote' && (shared || !legal.length) ? (
        <Card>
          <H2>{t('log.mafia.voteTime')}</H2>
          <P>{view.voted.length}/{view.alive.length} {t('mafia.voted')}</P>
        </Card>
      ) : null}

      {view.lastVote && (view.phase === 'night' ? shared || !showPrivate : true) && Object.keys(view.lastVote.tally).length ? (
        <Card dark>
          <H2 style={{ color: colors.cream }}>{t('mafia.tally')}</H2>
          {Object.entries(view.lastVote.tally).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
            <P key={id} style={{ color: colors.cream }}>{playerName(view, id)}: {n}</P>
          ))}
        </Card>
      ) : null}

      <PeopleGrid view={view} />
      <View style={st.counts}>
        <Text style={st.countText}>
          {t('mafia.roles')}: {(Object.entries(view.roleCounts) as [MafiaRole, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${ROLE_EMOJI[r]}×${n}`).join('  ')}
        </Text>
      </View>
      <LogFeed log={view.log} dark max={4} />
    </View>
  );
}

const st = StyleSheet.create({
  skyTitle: { position: 'absolute', left: 14, top: 8, gap: 2 },
  role: { borderRadius: radius.lg, borderWidth: 3, borderColor: colors.cream, padding: 18, alignItems: 'center', gap: 6, ...retroShadow },
  roleEmoji: { fontSize: 64 },
  roleTitle: { fontFamily: fonts.display, fontSize: 36, color: colors.white },
  roleDesc: { fontFamily: fonts.body, fontSize: 15, color: colors.white, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  person: { width: 96, alignItems: 'center', backgroundColor: colors.nightSoft, borderRadius: radius.md, borderWidth: 2, borderColor: colors.cream, padding: 6 },
  personOut: { opacity: 0.5 },
  personEmoji: { fontSize: 30 },
  personName: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.cream },
  personRole: { fontFamily: fonts.body, fontSize: 11, color: colors.mustard },
  reveal: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream, width: '45%' },
  counts: { alignItems: 'center' },
  countText: { fontFamily: fonts.bodyBold, color: colors.cream, fontSize: 14 },
});
