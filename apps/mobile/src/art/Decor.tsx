/** Decorative desi bits: bunting garland (jhandi), sky banners, confetti. Original SVG. */
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { colors } from '../theme';

const FLAG_COLORS = ['#FF9933', '#E84A8A', '#1FA2A6', '#F2C14E', '#3E9E4F', '#7A1F3D', '#3B7DD8'];

/** Festival bunting string across the top of a screen. */
export function Bunting({ width, flags = 14, height = 34 }: { width: number; flags?: number; height?: number }) {
  const step = width / flags;
  const sag = 10;
  const y = (x: number) => 4 + sag * Math.sin((Math.PI * x) / width);
  return (
    <Svg width={width} height={height + sag} pointerEvents="none">
      <Path d={`M0 4 Q ${width / 2} ${4 + sag * 2} ${width} 4`} stroke={colors.ink} strokeWidth={1.5} fill="none" />
      {Array.from({ length: flags }, (_, i) => {
        const x1 = i * step + 2;
        const x2 = (i + 1) * step - 2;
        const xm = (x1 + x2) / 2;
        return (
          <Polygon
            key={i}
            points={`${x1},${y(x1)} ${x2},${y(x2)} ${xm},${y(xm) + height - 8}`}
            fill={FLAG_COLORS[i % FLAG_COLORS.length]}
            stroke={colors.ink}
            strokeWidth={1.2}
          />
        );
      })}
    </Svg>
  );
}

/** Night sky (moon + twinkling stars) or day sky (sun) behind Mafia's phase title. */
export function SkyBanner({ night, width }: { night: boolean; width: number }) {
  const [tw] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!night) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(tw, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(tw, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [night, tw]);
  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => [((i * 97) % 100) / 100, ((i * 53) % 70) / 100, (i % 3) + 1] as const), []);
  const h = 70;
  return (
    <View style={[styles.sky, { width, height: h, backgroundColor: night ? '#14102E' : '#87D3F8' }]} pointerEvents="none">
      {night ? (
        <>
          <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
            {stars.map(([x, y, r], i) => (i % 2 ? <Circle key={i} cx={x * width} cy={y * h + 6} r={r * 0.7} fill="#FFF59D" /> : null))}
            <Circle cx={width - 46} cy={34} r={20} fill="#FFF3C4" />
            <Circle cx={width - 37} cy={27} r={18} fill="#14102E" />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: tw }]}>
            <Svg width={width} height={h}>
              {stars.map(([x, y, r], i) => (i % 2 ? null : <Circle key={i} cx={x * width} cy={y * h + 6} r={r * 0.7} fill="#FFFFFF" />))}
            </Svg>
          </Animated.View>
        </>
      ) : (
        <Svg width={width} height={h}>
          <Circle cx={width - 46} cy={34} r={18} fill="#FFD54F" stroke="#F9A825" strokeWidth={3} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <Path key={i} d={`M${width - 46 + Math.cos(a) * 24} ${34 + Math.sin(a) * 24} L${width - 46 + Math.cos(a) * 31} ${34 + Math.sin(a) * 31}`} stroke="#F9A825" strokeWidth={3} strokeLinecap="round" />;
          })}
          <Path d={`M20 52 q12 -14 26 -4 q10 -10 22 0 q10 2 8 10 h-58 q-6 -4 2 -6z`} fill="#fff" />
        </Svg>
      )}
    </View>
  );
}

/** Confetti burst (falls once). Lightweight: ~36 Animated views using the native driver. */
export function Confetti({ count = 36 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      delay: Math.random() * 500,
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() - 0.5) * 720,
      color: FLAG_COLORS[i % FLAG_COLORS.length] as string,
      w: 6 + Math.random() * 6,
      v: new Animated.Value(0),
    })),
  );
  useEffect(() => {
    Animated.stagger(15, pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: 2200 + p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }))).start();
  }, [pieces]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.w,
            height: p.w * 1.6,
            backgroundColor: p.color,
            borderRadius: 2,
            opacity: p.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Springy entrance for cards and panels. */
export function PopIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sky: { borderRadius: 16, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
});
