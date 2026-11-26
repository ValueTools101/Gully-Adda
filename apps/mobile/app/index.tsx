import { GAME_ORDER, getGame } from '@gully/engine';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GameArt } from '../src/art/GameArt';
import { Bunting, PopIn } from '../src/art/Decor';
import { Btn, P, Row, Screen } from '../src/components/ui';
import { GAME_UI } from '../src/games';
import { feedback } from '../src/lib/feedback';
import { t } from '../src/strings';
import { colors, fonts, radius, retroShadow } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  return (
    <Screen testID="home">
      <View style={{ marginHorizontal: -16, marginTop: -16, alignItems: 'center' }}>
        <Bunting width={Math.min(width, 640)} />
      </View>
      <View style={st.hero}>
        <Text style={st.kicker}>★ {t('tagline')} ★</Text>
        <Text style={st.logo} accessibilityRole="header">
          Gully <Text style={{ color: colors.saffron }}>Adda</Text>
        </Text>
        <View style={st.ribbon}>
          <Text style={st.ribbonText}>🪁 🎲 👑 🙈 ✍️ 🕶️</Text>
        </View>
      </View>

      <Btn label={t('home.playOnline')} icon="🌐" kind="secondary" onPress={() => router.push('/online')} testID="home-online" />

      <Text style={st.section}>{t('home.pickGame')}</Text>
      {GAME_ORDER.map((id, i) => {
        const ui = GAME_UI[id];
        const meta = getGame(id)!.meta;
        return (
          <PopIn key={id} delay={i * 60}>
          <Pressable
            testID={`game-${id}`}
            accessibilityRole="button"
            accessibilityLabel={t(`game.${id}.title`)}
            onPress={() => {
              feedback('tap');
              router.push({ pathname: '/setup/[game]', params: { game: id } });
            }}
            style={({ pressed }) => [st.tile, { backgroundColor: ui.color, transform: [{ rotate: i % 2 ? '0.6deg' : '-0.6deg' }] }, pressed ? { opacity: 0.85 } : retroShadow]}
          >
            <View style={st.art}>
              <GameArt game={id} size={64} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.tileTitle, id === 'mafia' && { color: colors.cream }]}>{t(`game.${id}.title`)}</Text>
              <Text style={[st.tileSub, id === 'mafia' && { color: colors.cream }]}>{t(`game.${id}.short`)}</Text>
              <Text style={[st.tilePlayers, id === 'mafia' && { color: colors.mustard }]}>
                👥 {meta.minPlayers === meta.maxPlayers ? t('home.playersExact', { n: meta.minPlayers }) : t('home.players', { min: meta.minPlayers, max: meta.maxPlayers })}
              </Text>
            </View>
          </Pressable>
          </PopIn>
        );
      })}

      <Row style={{ justifyContent: 'center', marginTop: 8 }}>
        <Btn small kind="ghost" label={`⚙️ ${t('home.settings')}`} onPress={() => router.push('/settings')} testID="home-settings" />
        <Btn small kind="ghost" label={`📜 ${t('house.title')}`} onPress={() => router.push('/house-rules')} />
      </Row>
      <P center style={{ color: colors.inkSoft, fontSize: 12 }}>No ads · No coins · Just adda</P>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  kicker: { fontFamily: fonts.bodyBold, color: colors.maroon, letterSpacing: 1, fontSize: 13, textTransform: 'uppercase' },
  logo: { fontFamily: fonts.display, fontSize: 56, lineHeight: 64, color: colors.maroon, textShadowColor: colors.mustard, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 },
  ribbon: { backgroundColor: colors.pink, borderWidth: 3, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 4, ...retroShadow, transform: [{ rotate: '-2deg' }] },
  ribbonText: { fontSize: 22 },
  section: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 8 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.ink, padding: 14, minHeight: 96 },
  art: { backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, borderWidth: 2, borderColor: colors.ink, padding: 2 },
  tileTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26, color: colors.ink },
  tileSub: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
  tilePlayers: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.maroon, marginTop: 2 },
});
