import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { PassGate, playerName, useLogSounds } from '../src/components/game';
import { FloatingReactions, ReactionBar, useFloaters } from '../src/components/Reactions';
import { Btn, Header, HelpButton, P, Screen } from '../src/components/ui';
import { GameNavContext } from '../src/games/nav';
import { getLocalSetup, type LocalSetup } from '../src/local/session';
import { useLocalGame } from '../src/local/useLocalGame';
import { t } from '../src/strings';
import { colors } from '../src/theme';

export default function Play() {
  const setup = getLocalSetup();
  const router = useRouter();
  const [round, setRound] = useState(0);
  if (!setup) {
    return (
      <Screen>
        <Header title={t('appName')} />
        <Btn label={t('common.home')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <LocalGame key={round} setup={setup} onAgain={() => setRound((r) => r + 1)} />;
}

function LocalGame({ setup, onAgain }: { setup: LocalSetup; onAgain: () => void }) {
  const router = useRouter();
  const { state, screen, humans, act, actGroup, reveal, hide, ui } = useLocalGame(setup);
  const dark = setup.game === 'mafia';
  const viewForSounds = screen.kind === 'gate' ? null : screen.view;
  useLogSounds(viewForSounds?.log ?? state.log, state.version);

  const nav = useMemo(
    () => ({
      home: () => router.replace('/'),
      again: onAgain,
    }),
    [router, onAgain],
  );

  const leave = () => {
    if (state.over || Platform.OS === 'web') return router.back();
    Alert.alert(t('common.leaveGame'), t('common.leaveGameBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.leave'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const Board = ui.Board;
  const floaters = useFloaters();
  return (
    <GameNavContext.Provider value={nav}>
      <View style={{ flex: 1 }}>
      <Screen dark={dark} testID={`play-${setup.game}`}>
        <Header title={t(`game.${setup.game}.title`)} dark={dark} onBack={leave} right={<HelpButton game={setup.game} dark={dark} />} />
        {screen.kind === 'gate' ? (
          <PassGate name={playerName(state, screen.player)} onReveal={() => reveal(screen.player)} dark={dark} />
        ) : null}
        {screen.kind === 'private' ? (
          <View style={{ gap: 12 }}>
            <P style={{ color: dark ? colors.mustard : colors.maroon, fontSize: 13 }}>🔒 {t('pass.private')}: {playerName(state, screen.player)}</P>
            <Board view={screen.view} mode={setup.mode} shared={false} act={act} actGroup={actGroup} humans={humans} />
            <Btn label={t('pass.hideAndPass')} icon="🙈" kind={dark ? 'dark' : 'primary'} disabled={!screen.canHide} onPress={() => hide(screen.player)} testID="hide-pass" />
          </View>
        ) : null}
        {screen.kind === 'board' ? (
          <Board view={screen.view} mode={setup.mode} shared={setup.mode === 'pass'} act={act} actGroup={actGroup} humans={humans} />
        ) : null}
        {screen.kind !== 'gate' && !state.over ? <ReactionBar dark={dark} onReact={(e) => floaters.add(e, '')} /> : null}
      </Screen>
      <FloatingReactions items={floaters.items} />
      </View>
    </GameNavContext.Provider>
  );
}
