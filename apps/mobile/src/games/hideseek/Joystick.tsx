/** Virtual joystick (touch) + arrow keys / WASD on web. Writes a direction vector into `out`. */
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

export interface Stick {
  x: number;
  y: number;
  /** 0 = idle, 0.5 = walk, 1 = run */
  mag: number;
}

const SIZE = 132;
const KNOB = 54;
const R = (SIZE - KNOB) / 2;

export function Joystick({ onChange, disabled }: { onChange: (s: Stick) => void; disabled?: boolean }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const start = useRef({ x: 0, y: 0 });
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  const set = (dx: number, dy: number) => {
    const len = Math.sqrt(dx * dx + dy * dy);
    const k = len > R ? R / len : 1;
    setKnob({ x: dx * k, y: dy * k });
    const m = Math.min(1, len / R);
    cb.current(m < 0.18 ? { x: 0, y: 0, mag: 0 } : { x: dx / (len || 1), y: dy / (len || 1), mag: m < 0.6 ? 0.5 : 1 });
  };

  // Refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        start.current = { x: e.nativeEvent.locationX - SIZE / 2, y: e.nativeEvent.locationY - SIZE / 2 };
        set(start.current.x, start.current.y);
      },
      onPanResponderMove: (_, g) => set(start.current.x + g.dx, start.current.y + g.dy),
      onPanResponderRelease: () => set(0, 0),
      onPanResponderTerminate: () => set(0, 0),
    }),
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const MAP: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    const update = () => {
      let x = 0;
      let y = 0;
      for (const k of keys.current) {
        const v = MAP[k];
        if (v) {
          x += v[0];
          y += v[1];
        }
      }
      set(x * R, y * R);
    };
    const down = (e: KeyboardEvent) => {
      if (MAP[e.key]) {
        e.preventDefault();
        keys.current.add(e.key);
        update();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key);
      update();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <View style={[st.base, disabled && { opacity: 0.4 }]} {...pan.panHandlers} accessibilityLabel="Joystick: drag to move" testID="joystick">
      <View style={st.ring} />
      <View style={[st.knob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]} />
    </View>
  );
}

const st = StyleSheet.create({
  base: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: 'rgba(43,27,23,0.18)', borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: SIZE * 0.55, height: SIZE * 0.55, borderRadius: SIZE, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed' },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.saffron, borderWidth: 3, borderColor: colors.ink, boxShadow: `2px 3px 0px ${colors.ink}` },
});
