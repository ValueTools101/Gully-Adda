/** "Pass the phone" illustration: a phone held out with a shy, eyes-closed face (original SVG). */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export function PhoneArt({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={62} r={52} fill="#FFFFFF" opacity={0.12} />
      <Rect x={37} y={14} width={50} height={92} rx={10} fill={colors.ink} />
      <Rect x={34} y={10} width={50} height={92} rx={10} fill="#37474F" stroke={colors.ink} strokeWidth={2.5} />
      <Rect x={39} y={20} width={40} height={70} rx={5} fill={colors.mustard} />
      <Circle cx={59} cy={96} r={2.5} fill="#90A4AE" />
      <Circle cx={59} cy={52} r={17} fill="#F2C9A0" stroke={colors.ink} strokeWidth={2} />
      <Path d="M50 50 q4 4 8 0" stroke={colors.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M60 50 q4 4 8 0" stroke={colors.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx={51} cy={58} r={2.5} fill="#F48FB1" />
      <Circle cx={67} cy={58} r={2.5} fill="#F48FB1" />
      <Path d="M55 62 q4 2 8 0" stroke={colors.ink} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M18 70 q8 -10 18 -6 l0 22 q-12 6 -18 -4 z" fill="#F2C9A0" stroke={colors.ink} strokeWidth={2} />
      <Path d="M100 66 q-8 -10 -18 -6 l0 22 q12 6 18 -4 z" fill="#F2C9A0" stroke={colors.ink} strokeWidth={2} />
      <Path d="M96 24 l6 -6 M100 34 l8 -2 M92 16 l2 -8" stroke={colors.cream} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
