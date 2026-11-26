import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { feedback } from '../lib/feedback';
import { useSettings } from '../lib/settings';
import { t } from '../strings';
import { colors, fonts, radius, retroShadow, retroShadowSmall, space, TAP } from '../theme';

export function Screen({ children, dark, scroll = true, testID }: { children: ReactNode; dark?: boolean; scroll?: boolean; testID?: string }) {
  const bg = dark ? colors.night : colors.cream;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }]} edges={['top', 'bottom', 'left', 'right']} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, onBack, dark, right }: { title: string; onBack?: () => void; dark?: boolean; right?: ReactNode }) {
  const router = useRouter();
  const { settings, update } = useSettings();
  const fg = dark ? colors.cream : colors.ink;
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.iconBtn}
        hitSlop={8}
      >
        <Text style={[styles.icon, { color: fg }]}>‹</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: settings.sound }}
        accessibilityLabel={t('settings.sound')}
        onPress={() => update({ sound: !settings.sound })}
        style={styles.iconBtn}
        hitSlop={8}
      >
        <Text style={[styles.iconSmall]}>{settings.sound ? '🔊' : '🔇'}</Text>
      </Pressable>
    </View>
  );
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

export function Btn({
  label, onPress, kind = 'primary', disabled, small, style, testID, icon, loading,
}: {
  label: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; small?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string; icon?: string; loading?: boolean;
}) {
  const bg = { primary: colors.saffron, secondary: colors.teal, ghost: colors.paper, danger: colors.danger, dark: colors.nightSoft }[kind];
  const fg = kind === 'ghost' ? colors.ink : colors.white;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={() => {
        feedback('tap');
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        pressed ? styles.pressed : retroShadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style, dark }: { children: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[styles.card, dark && { backgroundColor: colors.nightSoft, borderColor: colors.cream }, style]}>{children}</View>;
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function P({ children, style, center }: { children: ReactNode; style?: StyleProp<TextStyle>; center?: boolean }) {
  return <Text style={[styles.p, center && { textAlign: 'center' }, style]}>{children}</Text>;
}

export function Chip({ label, color, active, onPress, style }: { label: string; color?: string; active?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const content = (
    <View style={[styles.chip, { backgroundColor: active ? (color ?? colors.mustard) : colors.paper }, style]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={() => { feedback('tap'); onPress(); }} hitSlop={4}>
      {content}
    </Pressable>
  );
}

export function Segment<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.row}>
        <RoundBtn label="−" disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} />
        <Text style={styles.stepVal}>{value}</Text>
        <RoundBtn label="+" disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} />
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => { feedback('tap'); onChange(!value); }}
      style={styles.settingRow}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.toggle, value && { backgroundColor: colors.leaf }]}>
        <View style={[styles.knob, value && { alignSelf: 'flex-end' }]} />
      </View>
    </Pressable>
  );
}

export function RoundBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => { feedback('tap'); onPress(); }}
      style={({ pressed }) => [styles.round, { opacity: disabled ? 0.35 : 1 }, pressed ? styles.pressed : retroShadowSmall]}
    >
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={styles.settingLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.inkSoft} {...rest} style={[styles.input, style]} />
    </View>
  );
}

/** Live countdown to a deadline (ms epoch). Renders nothing without a deadline. */
export function Countdown({ deadline, dark, onTick }: { deadline: number | null; dark?: boolean; onTick?: (s: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  const s = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  useEffect(() => {
    if (deadline && onTick) onTick(s);
  }, [s, deadline, onTick]);
  if (!deadline) return null;
  const urgent = s <= 5;
  return (
    <View style={[styles.timer, urgent && { backgroundColor: colors.danger }, dark && !urgent && { backgroundColor: colors.nightSoft }]}>
      <Text style={styles.timerText}>⏱ {t('common.timeLeft', { s })}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: space(4), gap: space(3), flexGrow: 1, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: TAP },
  headerTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 24 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 40, lineHeight: 44, fontFamily: fonts.heading },
  iconSmall: { fontSize: 22 },
  btn: {
    minHeight: TAP, borderRadius: radius.md, borderWidth: 3, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(5), paddingVertical: space(2),
  },
  btnSmall: { minHeight: 44, paddingHorizontal: space(3), borderWidth: 2 },
  btnText: { fontFamily: fonts.heading, fontSize: 20 },
  btnTextSmall: { fontSize: 16 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 3 }] },
  card: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.ink, padding: space(4), gap: space(2), ...retroShadow },
  h1: { fontFamily: fonts.display, fontSize: 34, color: colors.maroon, lineHeight: 40 },
  h2: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 22 },
  chip: { borderWidth: 2, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TAP, gap: space(2) },
  settingLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, flexShrink: 1 },
  stepVal: { fontFamily: fonts.heading, fontSize: 22, minWidth: 36, textAlign: 'center', color: colors.ink },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.mustard, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, lineHeight: 28 },
  toggle: { width: 56, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.inkSoft, padding: 2, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink },
  input: { borderWidth: 2, borderColor: colors.ink, borderRadius: radius.sm, backgroundColor: colors.white, paddingHorizontal: 12, minHeight: 48, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  timer: { alignSelf: 'flex-start', backgroundColor: colors.teal, borderRadius: 999, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 4 },
  timerText: { fontFamily: fonts.heading, fontSize: 16, color: colors.white },
});
