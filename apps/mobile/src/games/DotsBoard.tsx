import { dotsLineCount, type DotsView } from '@gully/engine';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { GameOverPanel, LogFeed, PlayerStrip, TurnBanner, seatColor } from '../components/game';
import { Countdown } from '../components/ui';
import { feedback } from '../lib/feedback';
import { colors } from '../theme';
import type { BoardProps } from './types';
import { useGameNav } from './nav';

export function DotsBoard({ view, act }: BoardProps<DotsView>) {
  const { width } = useWindowDimensions();
  const nav = useGameNav();
  const n = view.config.size;
  const size = Math.min(width - 40, 440);
  const pad = 18;
  const cell = (size - pad * 2) / n;
  const myTurn = view.legal.length > 0;
  const hCount = n * (n + 1);
  const turnId = view.players[view.turn]?.id ?? '';

  const lineCoords = (i: number) => {
    if (i < hCount) {
      const r = Math.floor(i / n);
      const c = i % n;
      return { x1: pad + c * cell, y1: pad + r * cell, x2: pad + (c + 1) * cell, y2: pad + r * cell };
    }
    const k = i - hCount;
    const r = Math.floor(k / (n + 1));
    const c = k % (n + 1);
    return { x1: pad + c * cell, y1: pad + r * cell, x2: pad + c * cell, y2: pad + (r + 1) * cell };
  };

  const lines = Array.from({ length: dotsLineCount(n) }, (_, i) => i);
  const hit = Math.max(22, cell * 0.42);

  return (
    <View style={{ gap: 12 }}>
      <PlayerStrip view={view} scores={view.scores} active={view.over ? [] : [turnId]} />
      <Countdown deadline={view.deadline} />
      <View style={{ alignItems: 'center' }}>
        <Svg width={size} height={size} accessibilityLabel="Dots and boxes board">
          <Rect x={0} y={0} width={size} height={size} rx={18} fill={colors.paper} stroke={colors.ink} strokeWidth={3} />
          {view.boxes.map((owner, b) => {
            if (owner < 0) return null;
            const r = Math.floor(b / n);
            const c = b % n;
            const p = view.players[owner];
            return (
              <G key={`b${b}`}>
                <Rect x={pad + c * cell + 3} y={pad + r * cell + 3} width={cell - 6} height={cell - 6} rx={6} fill={p ? seatColor(view, p.id) : colors.mustard} opacity={0.55} />
                <SvgText x={pad + (c + 0.5) * cell} y={pad + (r + 0.5) * cell + 8} fontSize={Math.min(26, cell * 0.4)} fontWeight="bold" fill={colors.ink} textAnchor="middle">
                  {(p?.name ?? '?').slice(0, 1).toUpperCase()}
                </SvgText>
              </G>
            );
          })}
          {lines.map((i) => {
            const { x1, y1, x2, y2 } = lineCoords(i);
            const drawn = view.lines[i] === 1;
            const ownerSeat = view.lineOwner[i] ?? -1;
            const owner = ownerSeat >= 0 ? view.players[ownerSeat] : undefined;
            const horizontal = y1 === y2;
            return (
              <G key={`l${i}`}>
                <Line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={drawn ? (owner ? seatColor(view, owner.id) : colors.ink) : colors.inkSoft}
                  strokeWidth={drawn ? (i === view.lastLine ? 9 : 7) : 2}
                  strokeDasharray={drawn ? undefined : '4,6'}
                  strokeLinecap="round"
                  opacity={drawn ? 1 : 0.35}
                />
                {!drawn && myTurn ? (
                  <Rect
                    testID={`line-${i}`}
                    x={horizontal ? x1 + 8 : x1 - hit / 2}
                    y={horizontal ? y1 - hit / 2 : y1 + 8}
                    width={horizontal ? cell - 16 : hit}
                    height={horizontal ? hit : cell - 16}
                    fill="transparent"
                    onPress={() => {
                      feedback('move');
                      act({ type: 'line', line: i } as never);
                    }}
                  />
                ) : null}
              </G>
            );
          })}
          {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => (
            <Circle key={`d${k}`} cx={pad + (k % (n + 1)) * cell} cy={pad + Math.floor(k / (n + 1)) * cell} r={6} fill={colors.ink} />
          ))}
        </Svg>
      </View>
      {view.over ? <GameOverPanel view={view} scores={view.scores} onAgain={nav.again} onHome={nav.home} /> : <TurnBanner view={view} />}
      <LogFeed log={view.log} max={3} />
    </View>
  );
}
