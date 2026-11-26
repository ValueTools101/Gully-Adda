import { getGame, isGameId, type BotDifficulty, type GameId, type PlayerInfo } from '@gully/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Field, H2, Header, P, Screen, Segment, Stepper } from '../../src/components/ui';
import { GAME_UI } from '../../src/games';
import { ConfigEditor, localConfig } from '../../src/games/ConfigEditor';
import { BOT_NAMES } from '../../src/local/botNames';
import { setLocalSetup } from '../../src/local/session';
import { useSettings } from '../../src/lib/settings';
import { t } from '../../src/strings';
import { colors } from '../../src/theme';

type Mode = 'bots' | 'pass' | 'online';

export default function Setup() {
  const params = useLocalSearchParams<{ game: string }>();
  const router = useRouter();
  const { settings } = useSettings();
  const id: GameId = isGameId(params.game) ? params.game : 'ludo';
  const def = getGame(id)!;
  const { minPlayers: min, maxPlayers: max } = def.meta;

  const [mode, setMode] = useState<Mode>('bots');
  const [total, setTotal] = useState(Math.max(min, Math.min(max, def.meta.recommendedMin ?? (id === 'npat' || id === 'hideseek' ? 4 : min))));
  const [humans, setHumans] = useState(Math.min(2, total));
  const [names, setNames] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [config, setConfig] = useState<Record<string, unknown>>(() => def.defaultConfig(total) as Record<string, unknown>);
  const [showRules, setShowRules] = useState(false);

  const humanCount = mode === 'bots' ? 1 : Math.min(humans, total);
  const botCount = total - humanCount;

  const players = useMemo<PlayerInfo[]>(() => {
    const out: PlayerInfo[] = [];
    for (let i = 0; i < humanCount; i++) {
      const fallback = mode === 'bots' ? settings.displayName || t('setup.you') : t('setup.namePlaceholder', { n: i + 1 });
      out.push({ id: `h${i}`, name: (names[i] ?? '').trim().slice(0, 16) || fallback, isBot: false });
    }
    for (let i = 0; i < botCount; i++) out.push({ id: `b${i}`, name: BOT_NAMES[i % BOT_NAMES.length]!, isBot: true, difficulty });
    return out;
  }, [humanCount, botCount, names, mode, difficulty, settings.displayName]);

  const start = () => {
    if (mode === 'online') {
      router.push({ pathname: '/online', params: { game: id } });
      return;
    }
    setLocalSetup({ game: id, mode, players, config: localConfig(id, total, config), difficulty });
    router.push('/play');
  };

  return (
    <Screen>
      <Header title={t(`game.${id}.title`)} />
      <Card style={{ backgroundColor: GAME_UI[id].color }}>
        <P style={{ color: id === 'mafia' ? colors.cream : colors.ink, fontSize: 16 }}>
          {GAME_UI[id].emoji} {t(`game.${id}.short`)}
        </P>
        <Btn small kind="ghost" label={`📖 ${t('home.howToPlay')}`} onPress={() => setShowRules((v) => !v)} />
        {showRules ? <P style={{ color: id === 'mafia' ? colors.cream : colors.ink }}>{t(`rules.${id}`)}</P> : null}
      </Card>

      <H2>{t('setup.mode')}</H2>
      <Segment<Mode>
        options={[
          { value: 'bots', label: `🤖 ${t('setup.bots')}` },
          { value: 'pass', label: `📱 ${t('setup.pass')}` },
          { value: 'online', label: `🌐 ${t('setup.online')}` },
        ]}
        value={mode}
        onChange={setMode}
      />
      <P style={{ color: colors.inkSoft }}>{t(mode === 'bots' ? 'setup.botsDesc' : mode === 'pass' ? 'setup.passDesc' : 'setup.onlineDesc')}</P>

      {mode !== 'online' ? (
        <Card>
          {min !== max ? (
            <Stepper testID="players" label={`👥 ${t('setup.players')}`} value={total} min={min} max={max} onChange={(v) => { setTotal(v); setHumans((h) => Math.min(h, v)); }} />
          ) : (
            <P>👥 {t('home.playersExact', { n: min })}</P>
          )}
          {def.meta.recommendedMin && total < def.meta.recommendedMin ? <P style={{ color: colors.danger }}>{t('setup.recommended', { n: def.meta.recommendedMin })}</P> : null}
          {mode === 'pass' ? <Stepper testID="humans" label={`🙋 ${t('setup.humans')}`} value={humanCount} min={1} max={total} onChange={setHumans} /> : null}
          <P>🤖 {t('setup.bots.count')}: {botCount}</P>
          {botCount > 0 ? (
            <View style={{ gap: 6 }}>
              <P>{t('setup.difficulty')}</P>
              <Segment<BotDifficulty>
                options={[{ value: 'easy', label: t('setup.easy') }, { value: 'medium', label: t('setup.medium') }, { value: 'hard', label: t('setup.hard') }]}
                value={difficulty}
                onChange={setDifficulty}
              />
            </View>
          ) : null}
          {mode === 'pass' ? (
            <View style={{ gap: 8 }}>
              <P>{t('setup.names')}</P>
              {Array.from({ length: humanCount }, (_, i) => (
                <Field
                  key={i}
                  value={names[i] ?? ''}
                  placeholder={t('setup.namePlaceholder', { n: i + 1 })}
                  maxLength={16}
                  onChangeText={(v) => setNames((prev) => { const next = prev.slice(); next[i] = v; return next; })}
                />
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {mode !== 'online' ? (
        <Card>
          <H2>{t('setup.settings')}</H2>
          <ConfigEditor game={id} players={total} config={config} onChange={setConfig} />
        </Card>
      ) : null}

      <Btn label={t('setup.start')} icon="▶" onPress={start} testID="setup-start" />
    </Screen>
  );
}
