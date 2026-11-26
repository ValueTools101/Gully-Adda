import { LUDO_HOME, LUDO_LAST_MAIN, LUDO_SAFE, absSquare, type LudoView } from '@gully/engine';
import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { GameOverPanel, LogFeed, PlayerStrip, TurnBanner, playerName } from '../components/game';
import { Btn, Countdown, P, Row } from '../components/ui';
import { feedback } from '../lib/feedback';
import { t } from '../strings';
import { colors } from '../theme';
import { Dice } from './Dice';
import { useGameNav } from './nav';
import type { BoardProps } from './types';

export const LUDO_COLORS = ['#E53935', '#43A047', '#FBC02D', '#1E88E5'];
const LIGHT = ['#FFCDD2', '#C8E6C9', '#FFF59D', '#BBDEFB'];
const LUDO_DARK = ['#B71C1C', '#1B5E20', '#F57F17', '#0D47A1'];

/** Absolute track square -> [row, col] on the 15x15 grid (clockwise from red's start). */
const TRACK: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];
/** Home column cells per colour (progress 51..55). */
const HOME_COL: [number, number][][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const YARD_ORIGIN: [number, number][] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const YARD_SPOTS: [number, number][] = [[2, 2], [2, 4], [4, 2], [4, 4]];
const HOME_SPOT: [number, number][] = [[7.5, 6.4], [6.4, 7.5], [7.5, 8.6], [8.6, 7.5]];

/** Centre of a token in cell units [row, col] (cell centres are at x.5). */
function tokenCenter(colour: number, progress: number, index: number): [number, number] {
  if (progress < 0) {
    const [r0, c0] = YARD_ORIGIN[colour]!;
    const [r, c] = YARD_SPOTS[index]!;
    return [r0 + r, c0 + c];
  }
  if (progress >= LUDO_HOME) return HOME_SPOT[colour]!;
  if (progress > LUDO_LAST_MAIN) {
    const [r, c] = HOME_COL[colour]![progress - LUDO_LAST_MAIN - 1]!;
    return [r + 0.5, c + 0.5];
  }
  const [r, c] = TRACK[absSquare(colour, progress)]!;
  return [r + 0.5, c + 0.5];
}

export function LudoBoard({ view, act }: BoardProps<LudoView>) {
  const { width } = useWindowDimensions();
  const nav = useGameNav();
  const size = Math.min(width - 32, 460);
  const u = size / 15;
  const legal = view.legal as { type: string; token?: number }[];
  const canRoll = legal.some((a) => a.type === 'roll');
  const movable = new Set(legal.filter((a) => a.type === 'move').map((a) => a.token));
  const turnId = view.players[view.turn]?.id ?? '';
  const turnColour = view.colours[turnId] ?? 0;

  // Group tokens per cell to offset stacked tokens.
  const placed: { pid: string; colour: number; idx: number; r: number; c: number }[] = [];
  for (const p of view.players) {
    const colour = view.colours[p.id] ?? 0;
    (view.tokens[p.id] ?? []).forEach((prog, idx) => {
      const [r, c] = tokenCenter(colour, prog, idx);
      placed.push({ pid: p.id, colour, idx, r, c });
    });
  }
  const stackCount = new Map<string, number>();
  const stackIndex = placed.map((tk) => {
    const k = `${tk.r.toFixed(2)},${tk.c.toFixed(2)}`;
    const i = stackCount.get(k) ?? 0;
    stackCount.set(k, i + 1);
    return i;
  });

  const cells: ReactNode[] = [];
  TRACK.forEach(([r, c], abs) => {
    const startOf = [0, 13, 26, 39].indexOf(abs);
    const fill = startOf >= 0 ? LUDO_COLORS[startOf]! : colors.white;
    cells.push(<Rect key={`t${abs}`} x={c * u} y={r * u} width={u} height={u} fill={fill} stroke={colors.ink} strokeWidth={1} />);
    if (LUDO_SAFE.includes(abs) && startOf < 0) {
      cells.push(
        <SvgText key={`s${abs}`} x={(c + 0.5) * u} y={(r + 0.5) * u + u * 0.22} fontSize={u * 0.65} fill={colors.inkSoft} textAnchor="middle">
          ★
        </SvgText>,
      );
    }
  });
  HOME_COL.forEach((col, colour) =>
    col.forEach(([r, c], i) => cells.push(<Rect key={`h${colour}-${i}`} x={c * u} y={r * u} width={u} height={u} fill={LUDO_COLORS[colour]} stroke={colors.ink} strokeWidth={1} />)),
  );

  return (
    <View style={{ gap: 10 }}>
      <PlayerStrip view={view} active={view.over ? [] : [turnId]} colorOf={(id) => LUDO_COLORS[view.colours[id] ?? 0]!} />
      <View style={{ alignItems: 'center' }}>
        <Svg width={size} height={size} accessibilityLabel="Ludo board">
          <Rect x={0} y={0} width={size} height={size} fill={colors.paper} stroke={colors.ink} strokeWidth={3} rx={8} />
          {YARD_ORIGIN.map(([r, c], colour) => (
            <G key={`y${colour}`}>
              <Rect x={c * u} y={r * u} width={6 * u} height={6 * u} fill={LUDO_COLORS[colour]} stroke={colors.ink} strokeWidth={2} />
              <Rect x={(c + 1) * u} y={(r + 1) * u} width={4 * u} height={4 * u} rx={u * 0.6} fill={LIGHT[colour]} stroke={colors.ink} strokeWidth={2} />
              {YARD_SPOTS.map(([sr, sc], i) => (
                <Circle key={i} cx={(c + sc) * u} cy={(r + sr) * u} r={u * 0.55} fill={colors.white} stroke={colors.ink} strokeWidth={1.5} />
              ))}
            </G>
          ))}
          {cells}
          <Polygon points={`${6 * u},${6 * u} ${7.5 * u},${7.5 * u} ${6 * u},${9 * u}`} fill={LUDO_COLORS[0]} stroke={colors.ink} strokeWidth={1.5} />
          <Polygon points={`${6 * u},${6 * u} ${7.5 * u},${7.5 * u} ${9 * u},${6 * u}`} fill={LUDO_COLORS[1]} stroke={colors.ink} strokeWidth={1.5} />
          <Polygon points={`${9 * u},${6 * u} ${7.5 * u},${7.5 * u} ${9 * u},${9 * u}`} fill={LUDO_COLORS[2]} stroke={colors.ink} strokeWidth={1.5} />
          <Polygon points={`${6 * u},${9 * u} ${7.5 * u},${7.5 * u} ${9 * u},${9 * u}`} fill={LUDO_COLORS[3]} stroke={colors.ink} strokeWidth={1.5} />
          {placed.map((tk, i) => {
            const k = stackIndex[i] ?? 0;
            const off = k * u * 0.18;
            const cx = tk.c * u + off;
            const cy = tk.r * u - off;
            const canMove = tk.pid === turnId && movable.has(tk.idx);
            return (
              <G key={`k${tk.pid}-${tk.idx}`}>
                {canMove ? <Circle cx={cx} cy={cy} r={u * 0.62} fill={colors.white} stroke={colors.mustard} strokeWidth={4} /> : null}
                {/* 3D pawn: shadow, base, body, head, highlight */}
                <Ellipse cx={cx + 1.5} cy={cy + u * 0.3} rx={u * 0.38} ry={u * 0.15} fill={colors.ink} opacity={0.35} />
                <Ellipse cx={cx} cy={cy + u * 0.22} rx={u * 0.36} ry={u * 0.15} fill={LUDO_DARK[tk.colour]} stroke={colors.ink} strokeWidth={1.2} />
                <Path d={`M${cx - u * 0.3} ${cy + u * 0.2} Q${cx - u * 0.12} ${cy - u * 0.05} ${cx - u * 0.12} ${cy - u * 0.3} L${cx + u * 0.12} ${cy - u * 0.3} Q${cx + u * 0.12} ${cy - u * 0.05} ${cx + u * 0.3} ${cy + u * 0.2} Z`} fill={LUDO_COLORS[tk.colour]} stroke={colors.ink} strokeWidth={1.2} />
                <Circle cx={cx} cy={cy - u * 0.38} r={u * 0.2} fill={LUDO_COLORS[tk.colour]} stroke={colors.ink} strokeWidth={1.2} />
                <Circle cx={cx - u * 0.07} cy={cy - u * 0.45} r={u * 0.06} fill={colors.white} opacity={0.85} />
                {canMove ? (
                  <Circle
                    testID={`token-${tk.idx}`}
                    cx={cx} cy={cy} r={u * 0.75} fill="transparent"
                    onPress={() => {
                      feedback('move');
                      act({ type: 'move', token: tk.idx } as never);
                    }}
                  />
                ) : null}
              </G>
            );
          })}
        </Svg>
      </View>
      {!view.over ? (
        <Row style={{ justifyContent: 'center', gap: 18 }}>
          <Dice value={view.dice} rollKey={view.version} color={LIGHT[turnColour]} />
          {canRoll ? (
            <Btn label={t('ludo.roll')} icon="🎲" onPress={() => act({ type: 'roll' } as never)} testID="ludo-roll" style={{ minWidth: 150 }} />
          ) : (
            <View style={{ maxWidth: 180 }}>
              <P>{movable.size ? t('ludo.tapToken') : t('common.turnOf', { name: playerName(view, turnId) })}</P>
            </View>
          )}
        </Row>
      ) : null}
      <Countdown deadline={view.deadline} />
      {view.over ? (
        <GameOverPanel
          view={view}
          scores={Object.fromEntries(view.ranking.map((id, i) => [id, view.players.length - i]))}
          title={t('over.winner', { name: playerName(view, view.ranking[0]) })}
          onAgain={nav.again}
          onHome={nav.home}
        />
      ) : (
        <TurnBanner view={view} />
      )}
      <LogFeed log={view.log} max={3} />
    </View>
  );
}
