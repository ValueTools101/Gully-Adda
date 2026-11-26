import { HNS_ADJ, hnsSpot, type HnsView, type HnsZone, type PlayerId } from '@gully/engine';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GameOverPanel, LogFeed, PlayerStrip, TurnBanner, playerName, seatColor } from '../components/game';
import { Btn, Card, Chip, Countdown, H2, P, Row } from '../components/ui';
import { feedback } from '../lib/feedback';
import { t } from '../strings';
import { colors, fonts } from '../theme';
import { useGameNav } from './nav';
import { TownView, type TownMarker } from './TownView';
import type { BoardProps } from './types';

export const spotName = (id: string | null | undefined) => (id ? t(`hns.spot.${id}`) : '');

export function HideSeekBoard({ view, act, actGroup, shared }: BoardProps<HnsView>) {
  const { width } = useWindowDimensions();
  const nav = useGameNav();
  const mapW = Math.min(width - 32, 520);
  const legal = view.legal as { type: string; spot?: string }[];
  const spotActs = legal.filter((a) => a.spot);
  const can = (type: string) => legal.some((a) => a.type === type);
  const seekerName = playerName(view, view.seeker);
  const lastRound = view.round - 1;
  const lastSearch = view.searches[view.searches.length - 1];
  const rustle: HnsZone[] = view.phase === 'seek' ? view.clues.filter((c) => c.round === lastRound).map((c) => c.zone) : [];
  const initial = (id: PlayerId) => playerName(view, id).slice(0, 1).toUpperCase();

  const markers: TownMarker[] = Object.entries(view.knownSpots).map(([id, spot]) => ({
    spot,
    label: initial(id),
    color: view.status[id] === 'found' ? colors.inkSoft : seatColor(view, id),
    faded: view.phase !== 'reveal' && !view.over,
  }));
  if (!shared && view.mySpot && !view.knownSpots[view.me ?? '']) markers.push({ spot: view.mySpot, label: initial(view.me ?? ''), color: seatColor(view, view.me ?? '') });

  const pick = (spot: string) => {
    const a = spotActs.find((x) => x.spot === spot);
    if (!a) return;
    feedback('move');
    act({ type: a.type, spot } as never);
  };

  const statusIcon = (id: PlayerId) => {
    if (id === view.seeker) return <Text>🙈</Text>;
    const st = view.status[id];
    return <Text>{st === 'found' ? '🫣' : st === 'safe' ? '🏁' : '🤫'}</Text>;
  };

  const showPrivate = !shared;
  const mySelectable = showPrivate ? spotActs.map((a) => a.spot as string) : [];

  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>
          {t('hns.matchOf', { n: view.match, total: view.config.matches })}
          {view.phase === 'seek' ? ` · ${t('hns.roundOf', { n: view.round, total: view.config.maxRounds })}` : ''}
        </H2>
        <Countdown deadline={view.deadline} />
      </Row>
      <PlayerStrip view={view} scores={view.totals} extra={statusIcon} active={[view.seeker]} />

      <View style={{ alignItems: 'center' }}>
        <TownView
          width={mapW}
          selectable={mySelectable}
          onSelect={pick}
          selected={showPrivate ? view.myPick : null}
          mine={showPrivate ? view.mySpot : null}
          markers={markers}
          searched={view.phase === 'seek' && lastSearch?.spot !== 'den' ? lastSearch?.spot : null}
          denGuarded={view.phase === 'seek' && lastSearch?.spot === 'den'}
          rustle={rustle}
        />
      </View>

      {rustle.length ? (
        <Card style={st.clue}>
          <P>🌿 {t('hns.rustleHint', { zones: rustle.map((z) => t(`hns.zone.${z}`)).join(', ') })}</P>
        </Card>
      ) : null}

      {/* HIDE PHASE */}
      {view.phase === 'hide' ? (
        <Card>
          {showPrivate && view.amSeeker ? (
            <P>🙈 {t('hns.countEyes')}</P>
          ) : showPrivate && view.myStatus === 'hiding' && can('hide') ? (
            <>
              <H2>{t('hns.pickSpot')}</H2>
              <P style={{ color: colors.inkSoft }}>{t('hns.pickSpotHint', { name: seekerName })}</P>
              <SpotChips spots={mySelectable} selected={view.mySpot} onPick={pick} />
            </>
          ) : showPrivate && view.mySpot ? (
            <P>🤫 {t('hns.hidingAt', { spot: spotName(view.mySpot) })}</P>
          ) : (
            <P>🙈 {t('hns.seekerCounting', { name: seekerName })}</P>
          )}
        </Card>
      ) : null}

      {/* SEEK PHASE */}
      {view.phase === 'seek' && showPrivate && view.amSeeker ? (
        <Card>
          {can('search') ? (
            <>
              <H2>{t('hns.whereLook')}</H2>
              <SpotChips spots={mySelectable} selected={view.myPick} onPick={pick} />
              <Btn kind="danger" icon="🛡️" label={t('hns.guard')} onPress={() => act({ type: 'guard' } as never)} testID="hns-guard" />
            </>
          ) : (
            <P>✅ {view.myPick === 'den' ? t('hns.guarding') : t('hns.lookingAt', { spot: spotName(view.myPick) })}</P>
          )}
        </Card>
      ) : null}
      {view.phase === 'seek' && showPrivate && !view.amSeeker && view.myStatus === 'hiding' ? (
        <Card>
          <P>🤫 {t('hns.hidingAt', { spot: spotName(view.mySpot) })}</P>
          {can('stay') ? (
            <>
              <Btn label={t('hns.stay')} icon="🤐" onPress={() => act({ type: 'stay' } as never)} testID="hns-stay" />
              {can('dhappa') ? <Btn kind="danger" label={t('hns.dhappa')} icon="🏃" onPress={() => act({ type: 'dhappa' } as never)} testID="hns-dhappa" /> : null}
              <P style={{ color: colors.inkSoft }}>{t('hns.sneakHint')}</P>
              <SpotChips spots={(HNS_ADJ[view.mySpot ?? ''] ?? []).filter((s) => mySelectable.includes(s))} selected={null} onPick={pick} prefix="👣 " />
            </>
          ) : (
            <P>✅ {view.myPick === 'stay' ? t('hns.stayingPut') : view.myPick === 'dhappa' ? t('hns.running') : t('hns.sneakingTo', { spot: spotName(view.myPick) })}</P>
          )}
        </Card>
      ) : null}
      {view.phase === 'seek' && showPrivate && !view.amSeeker && view.myStatus && view.myStatus !== 'hiding' ? (
        <Card>
          <P>{view.myStatus === 'safe' ? `🏁 ${t('hns.youAreSafe')}` : `🫣 ${t('hns.youWereFound')}`}</P>
        </Card>
      ) : null}
      {view.phase === 'seek' && shared ? (
        <Card>
          <P>{t('hns.sharedSeek', { name: seekerName })}</P>
        </Card>
      ) : null}

      {view.searches.length && view.phase !== 'reveal' ? (
        <Card>
          <H2>{t('hns.searchLog')}</H2>
          {view.searches.slice(-4).reverse().map((s) => (
            <P key={s.round}>
              {t('hns.roundShort', { n: s.round })}: {s.spot === 'den' ? `🛡️ ${t('hns.guardedDen')}` : `🔍 ${spotName(s.spot)}`}
              {s.found.length ? ` → ${s.found.map((id) => playerName(view, id)).join(', ')}` : ''}
            </P>
          ))}
        </Card>
      ) : null}

      {/* REVEAL */}
      {view.phase === 'reveal' && !view.over ? (
        <Card>
          <H2>{t('hns.matchResult')}</H2>
          {view.players.map((p) => {
            const last = view.history[view.history.length - 1];
            const stt = p.id === view.seeker ? null : view.status[p.id];
            return (
              <P key={p.id}>
                {p.id === view.seeker ? '🙈' : stt === 'found' ? '🫣' : stt === 'safe' ? '🏁' : '🤫'} <Text style={{ fontFamily: fonts.bodyBold }}>{p.name}</Text>
                {p.id !== view.seeker ? ` · ${spotName(view.knownSpots[p.id])}` : ` · ${t('hns.seeker')}`} · +{last?.points[p.id] ?? 0}
              </P>
            );
          })}
          {can('ack') || shared ? <Btn label={t('hns.nextMatch')} onPress={() => actGroup(() => ({ type: 'ack' } as never))} testID="hns-next" /> : null}
        </Card>
      ) : null}

      {view.over ? <GameOverPanel view={view} scores={view.totals} onAgain={nav.again} onHome={nav.home} /> : <TurnBanner view={view} />}
      <LogFeed log={view.log} max={4} />
    </View>
  );
}

function SpotChips({ spots, selected, onPick, prefix = '' }: { spots: string[]; selected: string | null; onPick: (s: string) => void; prefix?: string }) {
  return (
    <Row>
      {spots.map((s) => (
        <Chip key={s} label={`${prefix}${spotName(s)}`} active={s === selected} onPress={() => onPick(s)} />
      ))}
    </Row>
  );
}

export const zoneOfSpot = (id: string) => hnsSpot(id)?.zone;

const st = StyleSheet.create({
  clue: { backgroundColor: '#FCE4EC' },
});
