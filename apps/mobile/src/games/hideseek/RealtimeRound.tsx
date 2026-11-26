/**
 * One real-time round of Chhupan Chhupai, rendered as an isometric 3D mohalla
 * with a camera that follows you. Runs the shared engine simulation at 20 Hz,
 * records one input per tick and hands the input string back when the round ends.
 */
import {
  DT, HIDE_TICKS, MAP_H, MAP_W, TICK_HZ, beamRays, createSim, encodeInput, quantize, resultOf, seekerOf, seekerSees, simMap, step,
  type HnsAiLevel, type HnsRole, type RoundResult, type SimState,
} from '@gully/engine';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { feedback, playSound } from '../../lib/feedback';
import { t } from '../../strings';
import { colors, fonts, seatColors } from '../../theme';
import { Joystick, type Stick } from './Joystick';

const TW = 58;
const TH = 29;
type P = [number, number];
const iso = (x: number, y: number): P => [(x - y) * (TW / 2), (x + y) * (TH / 2)];
const pts = (a: P[]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function tileDiamond(x: number, y: number, f = 1, lift = 0): P[] {
  const [cx, cy] = iso(x + 0.5, y + 0.5);
  const hw = (TW / 2) * f;
  const hh = (TH / 2) * f;
  return [[cx, cy - hh - lift], [cx + hw, cy - lift], [cx, cy + hh - lift], [cx - hw, cy - lift]];
}

function box(key: string, x: number, y: number, f: number, h: number, c: [string, string, string], lift = 0): ReactNode {
  const [tp, r, b, l] = tileDiamond(x, y, f, lift) as [P, P, P, P];
  const up = (p: P): P => [p[0], p[1] - h];
  return (
    <G key={key}>
      <Polygon points={pts([l, b, up(b), up(l)])} fill={c[1]} stroke={colors.ink} strokeWidth={1} />
      <Polygon points={pts([b, r, up(r), up(b)])} fill={c[2]} stroke={colors.ink} strokeWidth={1} />
      <Polygon points={pts([up(tp), up(r), up(b), up(l)])} fill={c[0]} stroke={colors.ink} strokeWidth={1} />
    </G>
  );
}

const HOUSE_COLORS: [string, string, string][] = [
  ['#FFE0B2', '#FF8A65', '#E64A19'], ['#E1F5FE', '#4FC3F7', '#0288D1'], ['#F3E5F5', '#BA68C8', '#7B1FA2'],
  ['#FFF9C4', '#FFD54F', '#F9A825'], ['#E8F5E9', '#81C784', '#388E3C'],
];

/** Static scenery for one tile (drawn in depth bands). */
function scenery(cell: string, x: number, y: number): ReactNode {
  const k = `${x}-${y}`;
  const [cx, cy] = iso(x + 0.5, y + 0.5);
  switch (cell) {
    case 'H': {
      const c = HOUSE_COLORS[(x * 7 + y * 3) % HOUSE_COLORS.length]!;
      return (
        <G key={k}>
          {box(`${k}h`, x, y, 1, 34, c)}
          {(x + y) % 3 === 0 ? <Rect x={cx - 4} y={cy - 22} width={8} height={9} fill="#5D4037" /> : null}
          {(x + 2 * y) % 4 === 0 ? <Rect x={cx + 6} y={cy - 28} width={7} height={6} fill="#FFF59D" stroke={colors.ink} strokeWidth={0.6} /> : null}
        </G>
      );
    }
    case 'T':
      return (
        <G key={k}>
          <Ellipse cx={cx} cy={cy + 2} rx={14} ry={6} fill="rgba(0,0,0,0.18)" />
          <Rect x={cx - 3} y={cy - 18} width={6} height={20} fill="#6D4C41" stroke={colors.ink} strokeWidth={0.8} />
          <Circle cx={cx} cy={cy - 28} r={16} fill="#2E7D32" stroke={colors.ink} strokeWidth={1} />
          <Circle cx={cx - 6} cy={cy - 33} r={8} fill="#43A047" />
          <Circle cx={cx + 7} cy={cy - 26} r={6} fill="#66BB6A" />
        </G>
      );
    case 'C':
      return (
        <G key={k}>
          {box(`${k}b`, x, y, 0.8, 12, ['#FDD835', '#43A047', '#2E7D32'], 3)}
          {box(`${k}r`, x, y, 0.7, 4, ['#212121', '#333', '#111'], 19)}
          <Circle cx={cx - 8} cy={cy + 4} r={3.5} fill="#111" />
          <Circle cx={cx + 9} cy={cy + 3} r={3.5} fill="#111" />
        </G>
      );
    case 'B':
      return (
        <G key={k}>
          <Ellipse cx={cx} cy={cy - 6} rx={17} ry={12} fill="#E0B341" stroke={colors.ink} strokeWidth={1} />
          <Ellipse cx={cx} cy={cy - 15} rx={10} ry={8} fill="#F2C94C" stroke={colors.ink} strokeWidth={1} />
          <Path d={`M${cx - 10} ${cy - 6} l18 -4 M${cx - 6} ${cy} l14 -3`} stroke="#B8860B" strokeWidth={1} />
        </G>
      );
    case 'W':
      return <G key={k}>{box(`${k}w`, x, y, 0.95, 14, ['#ECEFF1', '#B0BEC5', '#90A4AE'])}</G>;
    default:
      return null;
  }
}

const Scenery = memo(function Scenery({ rows, band }: { rows: string[]; band: number }) {
  const out: ReactNode[] = [];
  for (let x = 0; x < MAP_W; x++) {
    const y = band - x;
    if (y < 0 || y >= MAP_H) continue;
    const n = scenery(rows[y]![x]!, x, y);
    if (n) out.push(n);
  }
  return <G>{out}</G>;
});

const Ground = memo(function Ground({ rows }: { rows: string[] }) {
  const out: ReactNode[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const c = rows[y]![x]!;
      const fill = c === 'P' ? '#4FC3F7' : c === 'S' ? '#FFE0B2' : (x + y) % 2 ? '#9CCC65' : '#8BC34A';
      out.push(<Polygon key={`${x}-${y}`} points={pts(tileDiamond(x, y))} fill={fill} stroke={c === 'P' ? '#29B6F6' : '#7CB342'} strokeWidth={0.6} />);
      if (c === 'P') out.push(<Ellipse key={`l${x}-${y}`} cx={iso(x + 0.4, y + 0.5)[0]} cy={iso(x + 0.4, y + 0.5)[1]} rx={4} ry={2} fill="#66BB6A" />);
    }
  }
  // Slab edges
  const [lx, ly] = iso(0, MAP_H);
  const [bx, by] = iso(MAP_W, MAP_H);
  const [rx, ry] = iso(MAP_W, 0);
  out.push(<Polygon key="el" points={pts([[lx, ly], [bx, by], [bx, by + 14], [lx, ly + 14]])} fill="#8D6E63" stroke={colors.ink} strokeWidth={1} />);
  out.push(<Polygon key="er" points={pts([[bx, by], [rx, ry], [rx, ry + 14], [bx, by + 14]])} fill="#6D4C41" stroke={colors.ink} strokeWidth={1} />);
  return <G>{out}</G>;
});

/** A chibi kid character. */
function Kid({ x, y, color, seeker, caught, name, me, fx, fy, moving, phase }: {
  x: number; y: number; color: string; seeker: boolean; caught: boolean; name: string; me: boolean; fx: number; fy: number; moving: boolean; phase: number;
}) {
  const [cx, cy] = iso(x, y);
  const bob = moving ? Math.abs(Math.sin(phase * 10)) * 2.5 : 0;
  const [ex] = iso(fx * 0.12, fy * 0.12);
  const body = caught ? '#9E9E9E' : color;
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={9} ry={4} fill="rgba(0,0,0,0.25)" />
      {me ? <Ellipse cx={cx} cy={cy} rx={13} ry={6.5} fill="none" stroke="#FFFFFF" strokeWidth={2} /> : null}
      <Rect x={cx - 7} y={cy - 20 - bob} width={14} height={17} rx={6} fill={body} stroke={colors.ink} strokeWidth={1.3} />
      <Circle cx={cx} cy={cy - 26 - bob} r={8.5} fill={caught ? '#BDBDBD' : '#F2C9A0'} stroke={colors.ink} strokeWidth={1.3} />
      <Path d={`M${cx - 8.5} ${cy - 28 - bob} q8.5 -9 17 0`} fill="#3E2723" />
      {seeker ? <Rect x={cx - 9} y={cy - 31 - bob} width={18} height={4} fill="#E53935" stroke={colors.ink} strokeWidth={0.8} /> : null}
      <Circle cx={cx - 3 + ex} cy={cy - 25 - bob} r={1.4} fill={colors.ink} />
      <Circle cx={cx + 3 + ex} cy={cy - 25 - bob} r={1.4} fill={colors.ink} />
      {seeker ? <Circle cx={cx + 9} cy={cy - 13 - bob} r={3} fill="#FFEB3B" stroke={colors.ink} strokeWidth={0.8} /> : null}
      {caught ? (
        <G>
          {[-9, -3, 3, 9].map((d) => <Line key={d} x1={cx + d} y1={cy - 38} x2={cx + d} y2={cy + 2} stroke="#5D4037" strokeWidth={1.6} />)}
          <Line x1={cx - 11} y1={cy - 38} x2={cx + 11} y2={cy - 38} stroke="#5D4037" strokeWidth={2} />
        </G>
      ) : null}
      <SvgText x={cx} y={cy - 40 - bob} fontSize={10} fontFamily={fonts.bodyBold} fontWeight="bold" fill={colors.white} stroke={colors.ink} strokeWidth={2.5} textAnchor="middle">{name}</SvgText>
      <SvgText x={cx} y={cy - 40 - bob} fontSize={10} fontFamily={fonts.bodyBold} fontWeight="bold" fill={colors.white} textAnchor="middle">{name}</SvgText>
    </G>
  );
}

export interface RealtimeRoundProps {
  seed: number;
  role: HnsRole;
  seconds: number;
  aiLevel: HnsAiLevel;
  names: string[];
  onDone: (inputs: string, result: RoundResult) => void;
}

interface Snap {
  pos: P[];
  agents: { role: HnsRole; caught: boolean; fx: number; fy: number; name: string; marbles: number; rescues: number; moving: boolean; visible: boolean }[];
  beam: P[];
  marbles: { x: number; y: number; taken: boolean }[];
  ticks: number;
  totalTicks: number;
  time: number;
}

function snapshot(sim: SimState, prev: P[], alpha: number, role: HnsRole, time: number): Snap {
  const me = sim.agents[0]!;
  const seeker = seekerOf(sim);
  const counting = sim.ticks < HIDE_TICKS;
  return {
    pos: sim.agents.map((a, i) => {
      const p = prev[i] ?? [a.x, a.y];
      return [p[0] + (a.x - p[0]) * alpha, p[1] + (a.y - p[1]) * alpha] as P;
    }),
    agents: sim.agents.map((a, i) => ({
      role: a.role, caught: a.caught, fx: a.fx, fy: a.fy, name: a.name, marbles: a.marbles, rescues: a.rescues,
      moving: Math.abs((prev[i]?.[0] ?? a.x) - a.x) + Math.abs((prev[i]?.[1] ?? a.y) - a.y) > 0.001,
      // As the seeker you only see hiders in your torch beam (or right next to you).
      visible: i === 0 || a.role === 'seeker' || a.caught || role === 'hider' || seekerSees(sim, me, a.x, a.y),
    })),
    beam: counting ? [] : [iso(seeker.x, seeker.y), ...beamRays(sim, seeker).map((b) => iso(b.x, b.y))],
    marbles: sim.marbles.map((m) => ({ ...m })),
    ticks: sim.ticks,
    totalTicks: sim.totalTicks,
    time,
  };
}

export function RealtimeRound({ seed, role, seconds, aiLevel, names, onDone }: RealtimeRoundProps) {
  const { width, height } = useWindowDimensions();
  const vw = Math.min(width - 24, 620);
  const vh = Math.round(Math.min(height * 0.58, vw * 1.15));
  const [sim] = useState<SimState>(() => createSim(seed, role, seconds, aiLevel, names));
  const [rows] = useState(() => simMap(sim).rows);
  const [snap, setSnap] = useState<Snap>(() => snapshot(sim, [], 1, role, 0));
  const stick = useRef<Stick>({ x: 0, y: 0, mag: 0 });
  const onStick = useCallback((s: Stick) => {
    stick.current = s;
  }, []);
  const bands = useMemo(() => Array.from({ length: MAP_W + MAP_H - 1 }, (_, b) => b), []);

  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = 0;
    let frames = 0;
    let lastTick = 0;
    let done = false;
    let inputs = '';
    let prev = sim.agents.map((a) => [a.x, a.y] as P);
    const loop = (ts: number) => {
      if (!last) last = ts;
      acc += Math.min(250, ts - last);
      last = ts;
      while (acc >= DT * 1000 && !sim.over) {
        acc -= DT * 1000;
        prev = sim.agents.map((a) => [a.x, a.y] as P);
        const s = stick.current;
        // Screen-space joystick -> world direction (undo the isometric rotation).
        const wx = s.x / (TW / 2) + s.y / (TH / 2);
        const wy = s.y / (TH / 2) - s.x / (TW / 2);
        const code = s.mag ? quantize(wx, wy, s.mag < 1) : 0;
        inputs += encodeInput(code);
        step(sim, code);
        lastTick = ts;
        for (const e of sim.events) {
          if (e.startsWith('caught')) feedback(e === 'caught:0' ? 'lose' : 'capture', 'heavy');
          else if (e.startsWith('rescued')) feedback('win', 'success');
          else if (e === 'marble') playSound('tap');
        }
        if (sim.ticks === HIDE_TICKS) feedback('phase', 'warning');
        const left = sim.totalTicks - sim.ticks;
        if (left > 0 && left <= 5 * TICK_HZ && left % TICK_HZ === 0) playSound('tick');
      }
      frames++;
      if (frames % 2 === 0 || sim.over) setSnap(snapshot(sim, prev, Math.min(1, (ts - lastTick) / (DT * 1000)), role, ts / 1000));
      if (sim.over && !done) {
        done = true;
        onDone(inputs, resultOf(sim));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, onDone, role]);

  const pos = snap.pos;
  const me = snap.agents[0]!;
  const [mx, my] = iso(pos[0]![0], pos[0]![1]);
  const camX = vw / 2 - mx;
  const camY = vh / 2 - my + 20;
  const counting = snap.ticks < HIDE_TICKS;

  const byBand: ReactNode[][] = bands.map(() => []);
  snap.agents.forEach((a, i) => {
    if (!a.visible) return;
    const [px, py] = pos[i]!;
    const b = Math.min(bands.length - 1, Math.max(0, Math.floor(px) + Math.floor(py)));
    byBand[b]!.push(
      <Kid
        key={`k${i}`}
        x={px} y={py}
        color={a.role === 'seeker' ? '#C62828' : seatColors[(i + 2) % seatColors.length]!}
        seeker={a.role === 'seeker'}
        caught={a.caught}
        name={i === 0 ? t('common.you') : a.name}
        me={i === 0}
        fx={a.fx} fy={a.fy}
        moving={a.moving}
        phase={snap.time}
      />,
    );
  });

  const secsLeft = Math.ceil((snap.totalTicks - snap.ticks) / TICK_HZ);
  const hiders = snap.agents.filter((a) => a.role === 'hider');
  const caughtN = hiders.filter((a) => a.caught).length;
  const beamPts = snap.beam;

  return (
    <View style={{ alignItems: 'center', gap: 10 }} testID="hns-live">
      <View style={[st.view, { width: vw, height: vh }]}>
        <Svg width={vw} height={vh}>
          <Rect x={0} y={0} width={vw} height={vh} fill="#BFE7F5" />
          <G transform={`translate(${camX.toFixed(1)} ${camY.toFixed(1)})`}>
            <Ground rows={rows} />
            {beamPts.length ? <Polygon points={pts(beamPts)} fill="#FFF59D" opacity={0.55} stroke="#FBC02D" strokeWidth={1} /> : null}
            {snap.marbles.map((m, i) =>
              m.taken ? null : (
                <G key={`m${i}`}>
                  <Circle cx={iso(m.x, m.y)[0]} cy={iso(m.x, m.y)[1] - 3} r={3.6} fill={['#29B6F6', '#EC407A', '#66BB6A', '#FFCA28'][i % 4]} stroke={colors.ink} strokeWidth={0.8} />
                  <Circle cx={iso(m.x, m.y)[0] - 1} cy={iso(m.x, m.y)[1] - 4.2} r={1} fill="#fff" />
                </G>
              ),
            )}
            {bands.map((b) => (
              <G key={`b${b}`}>
                <Scenery rows={rows} band={b} />
                {byBand[b]}
              </G>
            ))}
          </G>
        </Svg>
        {/* HUD */}
        <View style={st.hudTop} pointerEvents="none">
          <Text style={[st.hudPill, secsLeft <= 5 && { backgroundColor: colors.danger }]}>⏱ {secsLeft}s</Text>
          {role === 'seeker' ? (
            <Text style={st.hudPill}>🫣 {caughtN}/{hiders.length}</Text>
          ) : (
            <Text style={st.hudPill}>🔮 {me.marbles}  🤝 {me.rescues}</Text>
          )}
        </View>
        {counting ? (
          <View style={[st.overlay, role === 'seeker' && st.blind]} pointerEvents="none">
            <Text style={st.countBig}>{Math.ceil((HIDE_TICKS - snap.ticks) / TICK_HZ)}</Text>
            <Text style={st.countText}>{role === 'seeker' ? t('hns.live.counting') : t('hns.live.runHide')}</Text>
          </View>
        ) : null}
      </View>
      <View style={st.controls}>
        <View style={{ flex: 1 }}>
          <Text style={st.tip}>{role === 'seeker' ? t('hns.live.tipSeek') : t('hns.live.tipHide')}</Text>
        </View>
        <Joystick onChange={onStick} disabled={role === 'seeker' && counting} />
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  view: { borderRadius: 18, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', backgroundColor: '#BFE7F5' },
  hudTop: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
  hudPill: { fontFamily: fonts.heading, fontSize: 16, color: colors.white, backgroundColor: 'rgba(43,27,23,0.75)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,244,220,0.35)' },
  blind: { backgroundColor: 'rgba(20,16,46,0.92)' },
  countBig: { fontFamily: fonts.display, fontSize: 96, lineHeight: 110, color: colors.mustard },
  countText: { fontFamily: fonts.heading, fontSize: 20, color: colors.white, textAlign: 'center', paddingHorizontal: 20, textShadowColor: colors.ink, textShadowRadius: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 620 },
  tip: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
});
