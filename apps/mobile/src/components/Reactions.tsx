/** Quick emoji reactions that float up the screen: cheap, fun, and they keep waiting players involved. */
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { feedback } from '../lib/feedback';
import { colors, fonts } from '../theme';

export const REACTIONS = ['😂', '🔥', '👏', '😱', '🤫', '😤', '🙏', '🎉'];
export const REACTION_PREFIX = '::r:';

interface Floater {
  id: number;
  emoji: string;
  name: string;
  left: number;
  v: Animated.Value;
}

let nextId = 1;

export function useFloaters() {
  const [items, setItems] = useState<Floater[]>([]);
  const add = useCallback((emoji: string, name: string) => {
    const f: Floater = { id: nextId++, emoji, name, left: 10 + ((nextId * 37) % 70), v: new Animated.Value(0) };
    setItems((xs) => [...xs.slice(-8), f]);
    Animated.timing(f.v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
      setItems((xs) => xs.filter((x) => x.id !== f.id)),
    );
  }, []);
  return { items, add };
}

export function FloatingReactions({ items }: { items: Floater[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((f) => (
        <Animated.View
          key={f.id}
          style={[
            st.floater,
            {
              left: `${f.left}%`,
              opacity: f.v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: f.v.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) },
                { scale: f.v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.3, 1] }) },
              ],
            },
          ]}
        >
          <Text style={st.emoji}>{f.emoji}</Text>
          {f.name ? <Text style={st.who}>{f.name}</Text> : null}
        </Animated.View>
      ))}
    </View>
  );
}

export function ReactionBar({ onReact, dark, disabled }: { onReact: (emoji: string) => void; dark?: boolean; disabled?: boolean }) {
  const [cool, setCool] = useState(false);
  useEffect(() => {
    if (!cool) return;
    const id = setTimeout(() => setCool(false), 900);
    return () => clearTimeout(id);
  }, [cool]);
  return (
    <View style={[st.bar, dark && { backgroundColor: colors.nightSoft, borderColor: colors.cream }, disabled && { opacity: 0.4 }]}>
      {REACTIONS.map((e) => (
        <Pressable
          key={e}
          accessibilityRole="button"
          accessibilityLabel={`React ${e}`}
          disabled={disabled || cool}
          onPress={() => {
            feedback('tap');
            setCool(true);
            onReact(e);
          }}
          style={({ pressed }) => [st.btn, pressed && { transform: [{ scale: 1.3 }] }]}
          hitSlop={4}
        >
          <Text style={st.btnText}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', backgroundColor: colors.paper, borderRadius: 999, borderWidth: 2, borderColor: colors.ink, paddingVertical: 2, paddingHorizontal: 6 },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 24 },
  floater: { position: 'absolute', bottom: 90, alignItems: 'center' },
  emoji: { fontSize: 44 },
  who: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white, backgroundColor: 'rgba(43,27,23,0.7)', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
});
