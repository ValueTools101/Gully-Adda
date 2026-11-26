/**
 * Isometric "3D" mohalla for Chhupan Chhupai, drawn with react-native-svg.
 * Original art: every building is extruded boxes/pyramids in code (no assets).
 */
import { HNS_DEN, HNS_GRID, HNS_SPOTS, type HnsZone } from '@gully/engine';
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

export interface TownMarker {
  spot: string;
  label: string;
  color: string;
  faded?: boolean;
}

export interface TownViewProps {
  width: number;
  /** Spots that can be tapped right now. */
  selectable: string[];
  onSelect?: (spot: string) => void;
  /** Currently chosen spot (highlight). */
  selected?: string | null;
  /** My own hiding spot (glow). */
  mine?: string | null;
  /** Avatars to draw at spots (found players, or everyone at the reveal). */
  markers?: TownMarker[];
  /** Spot searched last round. */
  searched?: string | null;
  denGuarded?: boolean;
  /** Zones where a rustle was heard last round. */
  rustle?: HnsZone[];
  dark?: boolean;
}

type P = [number, number];
const pts = (a: P[]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export function TownView({ width, selectable, onSelect, selected, mine, markers = [], searched, denGuarded, rustle = [], dark }: TownViewProps) {
  const TW = width / (HNS_GRID + 0.6);
  const TH = TW / 2;
  const top = TW * 1.25; // headroom for tall buildings
  const height = top + HNS_GRID * TH + TH * 0.8;
  const ox = width / 2;
  const center = (x: number, y: number): P => [ox + (x - y) * (TW / 2), top + (x + y) * (TH / 2) + TH / 2];

  const diamond = (x: number, y: number, f = 1, lift = 0): [P, P, P, P] => {
    const [cx, cy] = center(x, y);
    const hw = (TW / 2) * f;
    const hh = (TH / 2) * f;
    return [[cx, cy - hh - lift], [cx + hw, cy - lift], [cx, cy + hh - lift], [cx - hw, cy - lift]];
  };

  /** Extruded box on tile (x, y). */
  const box = (key: string, x: number, y: number, f: number, h: number, c: { top: string; left: string; right: string }, lift = 0): ReactNode => {
    const [t, r, b, l] = diamond(x, y, f, lift);
    const up = (p: P): P => [p[0], p[1] - h];
    return (
      <G key={key}>
        <Polygon points={pts([l, b, up(b), up(l)])} fill={c.left} stroke={colors.ink} strokeWidth={1} />
        <Polygon points={pts([b, r, up(r), up(b)])} fill={c.right} stroke={colors.ink} strokeWidth={1} />
        <Polygon points={pts([up(t), up(r), up(b), up(l)])} fill={c.top} stroke={colors.ink} strokeWidth={1} />
      </G>
    );
  };

  /** Pyramid roof sitting at height h. */
  const roof = (key: string, x: number, y: number, f: number, h: number, rh: number, left: string, right: string): ReactNode => {
    const [, r, b, l] = diamond(x, y, f);
    const [cx, cy] = center(x, y);
    const apex: P = [cx, cy - h - rh];
    const up = (p: P): P => [p[0], p[1] - h];
    return (
      <G key={key}>
        <Polygon points={pts([up(l), up(b), apex])} fill={left} stroke={colors.ink} strokeWidth={1} />
        <Polygon points={pts([up(b), up(r), apex])} fill={right} stroke={colors.ink} strokeWidth={1} />
      </G>
    );
  };

  const u = TW / 40; // art unit (art was designed at TW = 40)

  const art = (id: string, x: number, y: number): ReactNode => {
    const [cx, cy] = center(x, y);
    switch (id) {
      case 'temple':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.7, 6 * u, { top: '#F3E0B5', left: '#E2C48A', right: '#C9A66B' })}
            {box(`${id}w`, x, y, 0.5, 16 * u, { top: '#FFF1D0', left: '#F6D89E', right: '#E3BC77' }, 6 * u)}
            {roof(`${id}r`, x, y, 0.5, 22 * u, 22 * u, '#FF8A1F', '#E36A00')}
            <Line x1={cx} y1={cy - 44 * u} x2={cx} y2={cy - 54 * u} stroke={colors.ink} strokeWidth={1.2} />
            <Polygon points={pts([[cx, cy - 54 * u], [cx + 9 * u, cy - 51 * u], [cx, cy - 48 * u]])} fill="#FF5722" />
          </G>
        );
      case 'banyan':
        return (
          <G key={id}>
            {box(`${id}t`, x, y, 0.16, 14 * u, { top: '#6D4C41', left: '#795548', right: '#5D4037' })}
            <Ellipse cx={cx} cy={cy - 22 * u} rx={19 * u} ry={13 * u} fill="#2E7D32" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx - 6 * u} cy={cy - 27 * u} rx={11 * u} ry={8 * u} fill="#43A047" />
            <Ellipse cx={cx + 7 * u} cy={cy - 25 * u} rx={9 * u} ry={6 * u} fill="#66BB6A" />
            <Line x1={cx - 10 * u} y1={cy - 15 * u} x2={cx - 10 * u} y2={cy - 2 * u} stroke="#5D4037" strokeWidth={1} />
            <Line x1={cx + 12 * u} y1={cy - 15 * u} x2={cx + 12 * u} y2={cy - 3 * u} stroke="#5D4037" strokeWidth={1} />
          </G>
        );
      case 'haystack':
        return (
          <G key={id}>
            <Ellipse cx={cx} cy={cy - 6 * u} rx={15 * u} ry={11 * u} fill="#E0B341" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx} cy={cy - 14 * u} rx={9 * u} ry={7 * u} fill="#F2C94C" stroke={colors.ink} strokeWidth={1} />
            <Line x1={cx - 8 * u} y1={cy - 6 * u} x2={cx + 6 * u} y2={cy - 9 * u} stroke="#B8860B" strokeWidth={1} />
          </G>
        );
      case 'auto':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.5, 9 * u, { top: '#FDD835', left: '#2E7D32', right: '#1B5E20' })}
            {box(`${id}r`, x, y, 0.42, 3 * u, { top: '#212121', left: '#333', right: '#111' }, 13 * u)}
            <Line x1={cx - 9 * u} y1={cy - 9 * u} x2={cx - 9 * u} y2={cy - 13 * u} stroke={colors.ink} strokeWidth={1} />
            <Line x1={cx + 9 * u} y1={cy - 9 * u} x2={cx + 9 * u} y2={cy - 13 * u} stroke={colors.ink} strokeWidth={1} />
            <Circle cx={cx - 6 * u} cy={cy + 3 * u} r={2.6 * u} fill="#111" />
            <Circle cx={cx + 7 * u} cy={cy + 2 * u} r={2.6 * u} fill="#111" />
          </G>
        );
      case 'tank':
        return (
          <G key={id}>
            {[[-8, 0], [8, 0], [0, -4], [0, 4]].map(([dx, dy], i) => (
              <Line key={i} x1={cx + (dx as number) * u} y1={cy + (dy as number) * u} x2={cx + (dx as number) * 0.6 * u} y2={cy - 26 * u} stroke="#546E7A" strokeWidth={2 * u} />
            ))}
            <Rect x={cx - 12 * u} y={cy - 40 * u} width={24 * u} height={14 * u} fill="#4FC3F7" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx} cy={cy - 26 * u} rx={12 * u} ry={4 * u} fill="#29B6F6" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx} cy={cy - 40 * u} rx={12 * u} ry={4 * u} fill="#B3E5FC" stroke={colors.ink} strokeWidth={1} />
          </G>
        );
      case 'school':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.9, 15 * u, { top: '#FFF59D', left: '#FBC02D', right: '#F9A825' })}
            {roof(`${id}r`, x, y, 0.9, 15 * u, 9 * u, '#E53935', '#C62828')}
            <Rect x={cx - 2 * u} y={cy - 2 * u} width={5 * u} height={7 * u} fill="#6D4C41" />
          </G>
        );
      case 'shop':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.6, 13 * u, { top: '#F8BBD0', left: '#EC407A', right: '#D81B60' })}
            {[0, 1, 2, 3].map((i) => (
              <Polygon
                key={i}
                points={pts([[cx - 13 * u + i * 6.5 * u, cy - 9 * u], [cx - 6.5 * u + i * 6.5 * u, cy - 9 * u], [cx - 5 * u + i * 6.5 * u, cy - 4 * u], [cx - 11.5 * u + i * 6.5 * u, cy - 4 * u]])}
                fill={i % 2 ? '#fff' : '#1FA2A6'}
                stroke={colors.ink}
                strokeWidth={0.6}
              />
            ))}
          </G>
        );
      case 'cycle':
        return (
          <G key={id}>
            <Circle cx={cx - 7 * u} cy={cy - 3 * u} r={5 * u} fill="none" stroke={colors.ink} strokeWidth={1.5} />
            <Circle cx={cx + 7 * u} cy={cy - 3 * u} r={5 * u} fill="none" stroke={colors.ink} strokeWidth={1.5} />
            <Polygon points={pts([[cx - 7 * u, cy - 3 * u], [cx, cy - 3 * u], [cx + 3 * u, cy - 11 * u], [cx - 3 * u, cy - 11 * u]])} fill="none" stroke="#C62828" strokeWidth={1.6} />
            <Line x1={cx + 3 * u} y1={cy - 11 * u} x2={cx + 7 * u} y2={cy - 3 * u} stroke="#C62828" strokeWidth={1.6} />
            <Line x1={cx + 2 * u} y1={cy - 14 * u} x2={cx + 6 * u} y2={cy - 14 * u} stroke={colors.ink} strokeWidth={1.6} />
          </G>
        );
      case 'well':
        return (
          <G key={id}>
            <Ellipse cx={cx} cy={cy} rx={12 * u} ry={6 * u} fill="#9E9E9E" stroke={colors.ink} strokeWidth={1} />
            <Rect x={cx - 12 * u} y={cy - 8 * u} width={24 * u} height={8 * u} fill="#BDBDBD" />
            <Ellipse cx={cx} cy={cy - 8 * u} rx={12 * u} ry={6 * u} fill="#9E9E9E" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx} cy={cy - 8 * u} rx={8 * u} ry={4 * u} fill="#263238" />
            <Line x1={cx - 10 * u} y1={cy - 8 * u} x2={cx - 10 * u} y2={cy - 24 * u} stroke="#6D4C41" strokeWidth={1.6} />
            <Line x1={cx + 10 * u} y1={cy - 8 * u} x2={cx + 10 * u} y2={cy - 24 * u} stroke="#6D4C41" strokeWidth={1.6} />
            <Line x1={cx - 11 * u} y1={cy - 24 * u} x2={cx + 11 * u} y2={cy - 24 * u} stroke="#6D4C41" strokeWidth={2} />
          </G>
        );
      case 'stairs':
        return (
          <G key={id}>
            {box(`${id}1`, x, y, 0.8, 5 * u, { top: '#D7CCC8', left: '#A1887F', right: '#8D6E63' })}
            {box(`${id}2`, x, y, 0.55, 5 * u, { top: '#D7CCC8', left: '#A1887F', right: '#8D6E63' }, 5 * u)}
            {box(`${id}3`, x, y, 0.3, 5 * u, { top: '#EFEBE9', left: '#A1887F', right: '#8D6E63' }, 10 * u)}
          </G>
        );
      case 'cowshed':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.75, 11 * u, { top: '#BCAAA4', left: '#8D6E63', right: '#6D4C41' })}
            {roof(`${id}r`, x, y, 0.8, 11 * u, 7 * u, '#4E342E', '#3E2723')}
            <Ellipse cx={cx + 12 * u} cy={cy + 4 * u} rx={5 * u} ry={3 * u} fill="#fff" stroke={colors.ink} strokeWidth={0.8} />
            <Circle cx={cx + 16 * u} cy={cy + 2 * u} r={2 * u} fill="#fff" stroke={colors.ink} strokeWidth={0.8} />
          </G>
        );
      case 'postbox':
        return (
          <G key={id}>
            <Rect x={cx - 5 * u} y={cy - 18 * u} width={10 * u} height={18 * u} fill="#D32F2F" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx} cy={cy - 18 * u} rx={5.5 * u} ry={3 * u} fill="#E53935" stroke={colors.ink} strokeWidth={1} />
            <Rect x={cx - 3 * u} y={cy - 13 * u} width={6 * u} height={1.5 * u} fill={colors.ink} />
          </G>
        );
      case 'cart':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.55, 5 * u, { top: '#A1887F', left: '#795548', right: '#5D4037' }, 4 * u)}
            <Circle cx={cx - 8 * u} cy={cy + 1 * u} r={4 * u} fill="none" stroke={colors.ink} strokeWidth={1.5} />
            <Circle cx={cx + 8 * u} cy={cy + 1 * u} r={4 * u} fill="none" stroke={colors.ink} strokeWidth={1.5} />
            {['#FF7043', '#FFCA28', '#66BB6A', '#FF7043', '#AB47BC'].map((c, i) => (
              <Circle key={i} cx={cx - 8 * u + i * 4 * u} cy={cy - 11 * u + (i % 2) * 2 * u} r={2.4 * u} fill={c} stroke={colors.ink} strokeWidth={0.5} />
            ))}
          </G>
        );
      case 'tea':
        return (
          <G key={id}>
            {box(`${id}b`, x, y, 0.5, 10 * u, { top: '#FFE0B2', left: '#FF9800', right: '#F57C00' })}
            <Circle cx={cx + 2 * u} cy={cy - 15 * u} r={3.5 * u} fill="#B0BEC5" stroke={colors.ink} strokeWidth={0.8} />
            <SvgText x={cx - 6 * u} y={cy - 1 * u} fontSize={5 * u} fontWeight="bold" fill={colors.ink}>CHAI</SvgText>
          </G>
        );
      case 'pond':
        return (
          <G key={id}>
            <Polygon points={pts(diamond(x, y, 0.95))} fill="#4FC3F7" stroke={colors.ink} strokeWidth={1} />
            <Ellipse cx={cx - 5 * u} cy={cy} rx={3 * u} ry={1.5 * u} fill="#66BB6A" />
            <Ellipse cx={cx + 6 * u} cy={cy - 2 * u} rx={3 * u} ry={1.5 * u} fill="#66BB6A" />
            <Circle cx={cx + 6 * u} cy={cy - 3 * u} r={1.3 * u} fill="#F48FB1" />
            <Line x1={cx - 15 * u} y1={cy - 2 * u} x2={cx - 15 * u} y2={cy - 12 * u} stroke="#33691E" strokeWidth={1.2} />
            <Line x1={cx - 13 * u} y1={cy} x2={cx - 12 * u} y2={cy - 10 * u} stroke="#33691E" strokeWidth={1.2} />
          </G>
        );
      case 'bus':
        return (
          <G key={id}>
            <Line x1={cx - 10 * u} y1={cy} x2={cx - 10 * u} y2={cy - 16 * u} stroke="#455A64" strokeWidth={2 * u} />
            <Line x1={cx + 10 * u} y1={cy} x2={cx + 10 * u} y2={cy - 16 * u} stroke="#455A64" strokeWidth={2 * u} />
            {box(`${id}r`, x, y, 0.7, 2 * u, { top: '#42A5F5', left: '#1E88E5', right: '#1565C0' }, 16 * u)}
            <Rect x={cx - 8 * u} y={cy - 6 * u} width={16 * u} height={2.5 * u} fill="#8D6E63" />
          </G>
        );
      default:
        return null;
    }
  };

  const decor: { kind: 'house' | 'tree' | 'lamp'; x: number; y: number; c?: string }[] = [
    { kind: 'house', x: 0, y: 0, c: '#90CAF9' },
    { kind: 'house', x: 8, y: 0, c: '#CE93D8' },
    { kind: 'house', x: 0, y: 8, c: '#A5D6A7' },
    { kind: 'house', x: 8, y: 8, c: '#FFAB91' },
    { kind: 'house', x: 5, y: 1, c: '#FFE082' },
    { kind: 'tree', x: 2, y: 2 },
    { kind: 'tree', x: 6, y: 2 },
    { kind: 'tree', x: 2, y: 6 },
    { kind: 'tree', x: 6, y: 6 },
    { kind: 'lamp', x: 3, y: 4 },
    { kind: 'lamp', x: 5, y: 4 },
  ];
  const decorArt = (d: (typeof decor)[number]): ReactNode => {
    const [cx, cy] = center(d.x, d.y);
    const k = `d${d.x}-${d.y}`;
    if (d.kind === 'house') {
      return (
        <G key={k}>
          {box(`${k}b`, d.x, d.y, 0.7, 14 * u, { top: '#fff', left: d.c ?? '#ccc', right: shade(d.c ?? '#ccc') })}
          {roof(`${k}r`, d.x, d.y, 0.75, 14 * u, 8 * u, '#8D6E63', '#6D4C41')}
        </G>
      );
    }
    if (d.kind === 'tree') {
      return (
        <G key={k}>
          <Line x1={cx} y1={cy} x2={cx} y2={cy - 10 * u} stroke="#5D4037" strokeWidth={2 * u} />
          <Circle cx={cx} cy={cy - 14 * u} r={7 * u} fill="#388E3C" stroke={colors.ink} strokeWidth={0.8} />
        </G>
      );
    }
    return (
      <G key={k}>
        <Line x1={cx} y1={cy} x2={cx} y2={cy - 18 * u} stroke="#37474F" strokeWidth={1.5} />
        <Circle cx={cx} cy={cy - 19 * u} r={2.5 * u} fill="#FFF59D" stroke={colors.ink} strokeWidth={0.6} />
      </G>
    );
  };

  // Ground tiles.
  const ground: ReactNode[] = [];
  const rustleTiles = new Set(HNS_SPOTS.filter((s) => rustle.includes(s.zone)).map((s) => `${s.x},${s.y}`));
  for (let y = 0; y < HNS_GRID; y++) {
    for (let x = 0; x < HNS_GRID; x++) {
      const road = x === HNS_DEN.x || y === HNS_DEN.y;
      const fill = road ? '#C8B48A' : (x + y) % 2 ? '#9CCC65' : '#8BC34A';
      ground.push(<Polygon key={`g${x}-${y}`} points={pts(diamond(x, y))} fill={fill} stroke={road ? '#B09A6E' : '#7CB342'} strokeWidth={0.6} />);
      if (rustleTiles.has(`${x},${y}`)) ground.push(<Polygon key={`r${x}-${y}`} points={pts(diamond(x, y, 0.95))} fill="#E84A8A" opacity={0.45} />);
    }
  }
  // Edge thickness (the "slab" under the town).
  const [lx, ly] = center(0, HNS_GRID - 1);
  const [bx, by] = center(HNS_GRID - 1, HNS_GRID - 1);
  const [rx, ry] = center(HNS_GRID - 1, 0);
  const slab = TH * 0.6;
  const edgeL: P[] = [[lx - TW / 2, ly], [bx, by + TH / 2], [bx, by + TH / 2 + slab], [lx - TW / 2, ly + slab]];
  const edgeR: P[] = [[bx, by + TH / 2], [rx + TW / 2, ry], [rx + TW / 2, ry + slab], [bx, by + TH / 2 + slab]];

  // Painter's algorithm: draw back to front.
  const items: { d: number; node: ReactNode }[] = [];
  for (const s of HNS_SPOTS) items.push({ d: s.x + s.y + s.x * 0.001, node: art(s.id, s.x, s.y) });
  for (const d of decor) items.push({ d: d.x + d.y + d.x * 0.001, node: decorArt(d) });
  {
    const [cx, cy] = center(HNS_DEN.x, HNS_DEN.y);
    items.push({
      d: HNS_DEN.x + HNS_DEN.y,
      node: (
        <G key="den">
          <Polygon points={pts(diamond(HNS_DEN.x, HNS_DEN.y, 0.95))} fill={denGuarded ? '#FFCDD2' : '#FFE0B2'} stroke={colors.ink} strokeWidth={1.2} />
          <Rect x={cx - 1.6 * u} y={cy - 30 * u} width={3.2 * u} height={30 * u} fill="#fff" stroke={colors.ink} strokeWidth={0.8} />
          {[0, 1, 2, 3].map((i) => <Rect key={i} x={cx - 1.6 * u} y={cy - 28 * u + i * 7 * u} width={3.2 * u} height={3.5 * u} fill="#E53935" />)}
          <Polygon points={pts([[cx, cy - 30 * u], [cx + 12 * u, cy - 26 * u], [cx, cy - 22 * u]])} fill={colors.saffron} stroke={colors.ink} strokeWidth={0.8} />
          <SvgText x={cx} y={cy + 4 * u} fontSize={6 * u} fontWeight="bold" fill={colors.maroon} textAnchor="middle">DEN</SvgText>
        </G>
      ),
    });
  }
  items.sort((a, b) => a.d - b.d);

  // Overlays (always on top).
  const overlays: ReactNode[] = [];
  for (const s of HNS_SPOTS) {
    const [cx, cy] = center(s.x, s.y);
    const can = selectable.includes(s.id);
    if (s.id === searched) overlays.push(<SvgText key={`q${s.id}`} x={cx + 12 * u} y={cy - 18 * u} fontSize={14 * u}>🔍</SvgText>);
    if (s.id === mine) {
      overlays.push(<Ellipse key={`m${s.id}`} cx={cx} cy={cy} rx={TW * 0.48} ry={TH * 0.48} fill="none" stroke={colors.teal} strokeWidth={3} strokeDasharray="5,3" />);
    }
    if (can) overlays.push(<Ellipse key={`c${s.id}`} cx={cx} cy={cy} rx={TW * 0.45} ry={TH * 0.45} fill="#FFF59D" opacity={0.35} stroke={colors.mustard} strokeWidth={2.5} />);
    if (s.id === selected) overlays.push(<Ellipse key={`s${s.id}`} cx={cx} cy={cy} rx={TW * 0.5} ry={TH * 0.5} fill="none" stroke={colors.saffron} strokeWidth={4} />);
  }
  const bySpot = new Map<string, TownMarker[]>();
  for (const m of markers) bySpot.set(m.spot, [...(bySpot.get(m.spot) ?? []), m]);
  for (const [spot, ms] of bySpot) {
    const s = HNS_SPOTS.find((x) => x.id === spot);
    if (!s) continue;
    const [cx, cy] = center(s.x, s.y);
    ms.forEach((m, i) => {
      const mx = cx - ((ms.length - 1) * 8 * u) / 2 + i * 8 * u;
      const my = cy - 30 * u;
      overlays.push(
        <G key={`a${spot}-${i}`} opacity={m.faded ? 0.55 : 1}>
          <Circle cx={mx} cy={my} r={6 * u} fill={m.color} stroke={colors.ink} strokeWidth={1.2} />
          <SvgText x={mx} y={my + 2.6 * u} fontSize={7 * u} fontWeight="bold" fill={colors.white} textAnchor="middle">{m.label}</SvgText>
        </G>,
      );
    });
  }
  // Tap targets last so they sit above everything.
  const hits = HNS_SPOTS.filter((s) => selectable.includes(s.id)).map((s) => {
    const [cx, cy] = center(s.x, s.y);
    return <Ellipse key={`h${s.id}`} testID={`spot-${s.id}`} cx={cx} cy={cy - 10 * u} rx={TW * 0.55} ry={TH * 1.1} fill="transparent" onPress={() => onSelect?.(s.id)} />;
  });

  return (
    <Svg width={width} height={height} accessibilityLabel="Mohalla map">
      <Rect x={0} y={0} width={width} height={height} rx={16} fill={dark ? colors.nightSoft : '#BFE7F5'} />
      <Polygon points={pts(edgeL)} fill="#8D6E63" stroke={colors.ink} strokeWidth={1} />
      <Polygon points={pts(edgeR)} fill="#6D4C41" stroke={colors.ink} strokeWidth={1} />
      {ground}
      {items.map((i) => i.node)}
      {overlays}
      {hits}
    </Svg>
  );
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.8));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}
