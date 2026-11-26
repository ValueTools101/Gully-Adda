import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { colors } from '../theme';

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

/** Original vector die. `rollKey` changes trigger a little tumble animation. */
export function Dice({ value, size = 72, color = colors.white, rollKey }: { value: number | null; size?: number; color?: string; rollKey?: number }) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
  }, [rollKey, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '0deg'] });
  const scale = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.15, 1] });
  const pips = value ? (PIPS[value] ?? []) : [];
  return (
    <Animated.View style={{ transform: [{ rotate }, { scale }] }} accessibilityLabel={value ? `Dice shows ${value}` : 'Dice'}>
      <Svg width={size} height={size}>
        <Rect x={3} y={5} width={size - 6} height={size - 6} rx={size * 0.2} fill={colors.ink} />
        <Rect x={2} y={2} width={size - 7} height={size - 7} rx={size * 0.2} fill={color} stroke={colors.ink} strokeWidth={3} />
        {pips.map(([x, y], i) => (
          <Circle key={i} cx={2 + x * (size - 7)} cy={2 + y * (size - 7)} r={size * 0.075} fill={value === 1 ? colors.danger : colors.ink} />
        ))}
      </Svg>
    </Animated.View>
  );
}
