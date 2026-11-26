/** Original cover illustrations for each game (pure SVG, CC0, made for Gully Adda). */
import type { GameId } from '@gully/engine';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

const INK = colors.ink;

function Rmcs() {
  const chit = (x: number, rot: number, fill: string, label: string) => (
    <G transform={`rotate(${rot} ${x + 14} 70)`}>
      <Rect x={x + 2} y={34} width={28} height={38} rx={3} fill={INK} />
      <Rect x={x} y={31} width={28} height={38} rx={3} fill={fill} stroke={INK} strokeWidth={2} />
      <Line x1={x + 5} y1={52} x2={x + 23} y2={52} stroke={INK} strokeWidth={1} opacity={0.4} />
      <SvgText x={x + 14} y={47} fontSize={12} fontWeight="bold" textAnchor="middle" fill={INK}>{label}</SvgText>
    </G>
  );
  return (
    <G>
      {chit(8, -18, '#FFF8E1', '?')}
      {chit(26, -6, '#B3E5FC', 'M')}
      {chit(44, 6, '#FFE0B2', 'S')}
      {chit(60, 18, '#FFF8E1', 'C')}
      <Polygon points="30,26 36,10 44,22 50,6 56,22 64,10 70,26" fill={colors.mustard} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={30} y={24} width={40} height={7} fill="#E0A800" stroke={INK} strokeWidth={2} />
      <Circle cx={50} cy={27} r={2.5} fill={colors.danger} />
    </G>
  );
}

function Mafia() {
  return (
    <G>
      <Rect x={2} y={2} width={96} height={76} rx={14} fill={colors.night} />
      {[[14, 14], [80, 22], [30, 30], [64, 10], [88, 44], [12, 40]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.4} fill="#FFF59D" />
      ))}
      <Circle cx={74} cy={22} r={11} fill="#FFF3C4" />
      <Circle cx={79} cy={18} r={10} fill={colors.night} />
      <Polygon points="8,78 8,52 20,44 32,52 32,78" fill="#3B2F63" stroke="#000" strokeWidth={1} />
      <Polygon points="66,78 66,48 80,40 94,48 94,78" fill="#3B2F63" stroke="#000" strokeWidth={1} />
      <Rect x={14} y={58} width={6} height={6} fill="#FFD54F" />
      <Rect x={76} y={56} width={6} height={6} fill="#FFD54F" />
      <Ellipse cx={50} cy={42} rx={24} ry={5} fill="#222" stroke="#000" strokeWidth={1.5} />
      <Path d="M34 42 Q36 22 50 22 Q64 22 66 42 Z" fill="#2B2B2B" stroke="#000" strokeWidth={1.5} />
      <Rect x={35} y={36} width={30} height={4} fill={colors.danger} />
      <Ellipse cx={50} cy={58} rx={14} ry={13} fill="#F2C9A0" stroke={INK} strokeWidth={1.5} />
      <Rect x={37} y={52} width={11} height={6} rx={2} fill="#111" />
      <Rect x={52} y={52} width={11} height={6} rx={2} fill="#111" />
      <Line x1={48} y1={54} x2={52} y2={54} stroke="#111" strokeWidth={1.5} />
      <Path d="M44 64 Q50 67 56 64" stroke={INK} strokeWidth={1.5} fill="none" />
    </G>
  );
}

function HideSeek() {
  return (
    <G>
      <Polygon points="50,40 92,60 50,80 8,60" fill="#8BC34A" stroke={INK} strokeWidth={1.5} />
      <Polygon points="20,56 40,66 40,44 20,34" fill="#EC407A" stroke={INK} strokeWidth={1.5} />
      <Polygon points="40,66 56,58 56,36 40,44" fill="#D81B60" stroke={INK} strokeWidth={1.5} />
      <Polygon points="20,34 40,44 56,36 36,26" fill="#FFAB91" stroke={INK} strokeWidth={1.5} />
      <Polygon points="18,34 38,16 58,36 40,44" fill="#8D6E63" stroke={INK} strokeWidth={1.5} />
      <Line x1={72} y1={62} x2={72} y2={44} stroke="#5D4037" strokeWidth={4} />
      <Circle cx={72} cy={34} r={15} fill="#388E3C" stroke={INK} strokeWidth={1.5} />
      <Circle cx={66} cy={30} r={6} fill="#4CAF50" />
      <Circle cx={83} cy={38} r={5} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />
      <Circle cx={84} cy={38} r={2.2} fill={INK} />
      <Circle cx={90} cy={37} r={4.5} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />
      <Circle cx={91} cy={37} r={2} fill={INK} />
      <Path d="M80 30 q4 -3 8 0" stroke={INK} strokeWidth={1.2} fill="none" />
      <SvgText x={14} y={22} fontSize={10} fontWeight="bold" fill={colors.maroon}>Dhappa!</SvgText>
    </G>
  );
}

function Npat() {
  return (
    <G>
      <G transform="rotate(-6 50 42)">
        <Rect x={16} y={8} width={66} height={70} rx={4} fill="#FFFDF6" stroke={INK} strokeWidth={2} />
        {[24, 34, 44, 54, 64].map((y) => (
          <Line key={y} x1={18} y1={y} x2={80} y2={y} stroke="#90CAF9" strokeWidth={1} />
        ))}
        <Line x1={28} y1={10} x2={28} y2={76} stroke="#EF9A9A" strokeWidth={1.5} />
        <SvgText x={52} y={58} fontSize={38} fontWeight="bold" fill={colors.maroon} textAnchor="middle">A</SvgText>
      </G>
      <G transform="rotate(35 78 40)">
        <Rect x={72} y={6} width={10} height={52} fill="#FFCA28" stroke={INK} strokeWidth={1.5} />
        <Rect x={72} y={6} width={10} height={7} fill="#EF9A9A" stroke={INK} strokeWidth={1.5} />
        <Polygon points="72,58 82,58 77,70" fill="#F5D6A8" stroke={INK} strokeWidth={1.5} />
        <Polygon points="75.5,66 78.5,66 77,70" fill={INK} />
      </G>
    </G>
  );
}

function Dots() {
  const n = 4;
  const s = 18;
  const ox = 23;
  const oy = 6;
  const fills: Record<string, string> = { '0,0': '#EF5350', '1,0': '#EF5350', '0,1': '#42A5F5', '2,2': '#66BB6A', '2,1': '#66BB6A' };
  return (
    <G>
      <Rect x={ox - 8} y={oy - 4} width={s * (n - 1) + 16} height={s * (n - 1) + 16} rx={8} fill="#FFFDF6" stroke={INK} strokeWidth={2} />
      {Object.entries(fills).map(([k, c]) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return <Rect key={k} x={ox + x * s + 2} y={oy + 4 + y * s + 2} width={s - 4} height={s - 4} rx={3} fill={c} opacity={0.7} />;
      })}
      {[[0, 0, 1, 0], [1, 0, 2, 0], [0, 0, 0, 1], [0, 1, 0, 2], [0, 2, 1, 2], [2, 1, 3, 1], [2, 2, 3, 2], [3, 1, 3, 2], [1, 1, 2, 1], [2, 0, 2, 1]].map(([a, b, c, d], i) => (
        <Line key={i} x1={ox + (a as number) * s} y1={oy + 4 + (b as number) * s} x2={ox + (c as number) * s} y2={oy + 4 + (d as number) * s} stroke={i % 2 ? '#1E88E5' : '#E53935'} strokeWidth={3.5} strokeLinecap="round" />
      ))}
      {Array.from({ length: n * n }, (_, k) => (
        <Circle key={k} cx={ox + (k % n) * s} cy={oy + 4 + Math.floor(k / n) * s} r={3} fill={INK} />
      ))}
    </G>
  );
}

function Ludo() {
  const q = [['#E53935', 8, 6], ['#43A047', 50, 6], ['#1E88E5', 8, 44], ['#FBC02D', 50, 44]] as const;
  return (
    <G>
      <Rect x={6} y={4} width={84} height={74} rx={6} fill="#fff" stroke={INK} strokeWidth={2} />
      {q.map(([c, x, y], i) => (
        <G key={i}>
          <Rect x={x} y={y} width={38} height={32} fill={c} stroke={INK} strokeWidth={1.5} />
          <Rect x={x + 7} y={y + 6} width={24} height={20} rx={5} fill="#fff" />
          <Circle cx={x + 19} cy={y + 16} r={5} fill={c} stroke={INK} strokeWidth={1.2} />
        </G>
      ))}
      <G transform="rotate(14 72 60)">
        <Rect x={60} y={50} width={26} height={26} rx={6} fill={INK} />
        <Rect x={58} y={47} width={26} height={26} rx={6} fill="#fff" stroke={INK} strokeWidth={2} />
        {[[64, 53], [78, 53], [64, 60], [78, 60], [64, 67], [78, 67]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.1} fill={INK} />
        ))}
      </G>
    </G>
  );
}

const ART: Record<GameId, () => React.JSX.Element> = { rmcs: Rmcs, mafia: Mafia, hideseek: HideSeek, npat: Npat, dots: Dots, ludo: Ludo };

export function GameArt({ game, size = 84 }: { game: GameId; size?: number }) {
  const A = ART[game];
  return (
    <Svg width={size * 1.2} height={size} viewBox="0 0 100 82">
      <A />
    </Svg>
  );
}
