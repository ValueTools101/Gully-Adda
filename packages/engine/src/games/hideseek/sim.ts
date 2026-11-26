/**
 * Deterministic real-time simulation for Chhupan Chhupai (hide & seek).
 *
 * Runs at a fixed 20 ticks per second. The human controls agent 0 with one
 * input code per tick; every other character is AI driven by a seeded Rng.
 * Only +, -, *, / and Math.sqrt are used on positions (IEEE-exact on every JS
 * engine), so a recorded input string replays to the identical result on the
 * phone and on the server (which is how online scores are verified).
 */
import { Rng, hashString } from '../../core/rng';
import { HNS_MAPS, MAP_H, MAP_W, blocksMove, blocksSight, cellAt, type HnsMap } from './maps';

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
export const HIDE_SECONDS = 5;
export const HIDE_TICKS = HIDE_SECONDS * TICK_HZ;
export const AGENT_R = 0.3;
export const VISION_RANGE = 5.5;
/** cos(40 degrees): half-angle of the seeker's torch beam. */
export const VISION_COS = 0.766044;
export const SENSE_RANGE = 1.1;
export const CATCH_DIST = 0.75;
export const RESCUE_DIST = 0.7;
export const HIDER_SPEED = 3.1;
export const SEEKER_SPEED: Record<HnsAiLevel, number> = { easy: 2.8, medium: 3.25, hard: 3.6 };
export const PLAYER_SEEKER_SPEED = 3.5;
export const MARBLES = 12;

export type HnsRole = 'seeker' | 'hider';
export type HnsAiLevel = 'easy' | 'medium' | 'hard';

/** 16 compass directions (literal constants, so every engine agrees bit-for-bit). */
export const DIRS: readonly [number, number][] = [
  [1, 0], [0.92388, 0.382683], [0.707107, 0.707107], [0.382683, 0.92388],
  [0, 1], [-0.382683, 0.92388], [-0.707107, 0.707107], [-0.92388, 0.382683],
  [-1, 0], [-0.92388, -0.382683], [-0.707107, -0.707107], [-0.382683, -0.92388],
  [0, -1], [0.382683, -0.92388], [0.707107, -0.707107], [0.92388, -0.382683],
];

/** Input code per tick: 0 = stand still, 1..16 = run in DIRS[k-1], 17..32 = walk (half speed). */
export const MAX_CODE = 32;
export const encodeInput = (code: number) => String.fromCharCode(48 + code);
export const decodeInput = (ch: string) => ch.charCodeAt(0) - 48;

export function quantize(dx: number, dy: number, walk = false): number {
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return 0;
  let best = 0;
  let bestDot = -Infinity;
  for (let k = 0; k < 16; k++) {
    const d = DIRS[k]!;
    const dot = d[0] * dx + d[1] * dy;
    if (dot > bestDot) {
      bestDot = dot;
      best = k;
    }
  }
  return best + 1 + (walk ? 16 : 0);
}

export interface Agent {
  name: string;
  role: HnsRole;
  x: number;
  y: number;
  fx: number;
  fy: number;
  caught: boolean;
  caughtTick: number;
  /** AI memory */
  path: number[];
  goal: number;
  think: number;
  lastSeenX: number;
  lastSeenY: number;
  hasLastSeen: boolean;
  rescues: number;
  marbles: number;
}

export interface SimState {
  mapIndex: number;
  role: HnsRole;
  ticks: number;
  totalTicks: number;
  aiLevel: HnsAiLevel;
  agents: Agent[];
  marbles: { x: number; y: number; taken: boolean }[];
  rngState: number;
  playerRngState: number;
  over: boolean;
  /** Events this tick (for sounds / effects): 'caught:i', 'rescued:i', 'marble', 'start'. */
  events: string[];
}

export interface RoundResult {
  role: HnsRole;
  score: number;
  caught: number;
  survivedSeconds: number;
  wasCaught: boolean;
  rescues: number;
  marbles: number;
  allCaught: boolean;
  ticks: number;
}

const idx = (x: number, y: number) => y * MAP_W + x;
const tileOf = (v: number) => Math.floor(v);

function mapOf(s: SimState): HnsMap {
  return HNS_MAPS[s.mapIndex % HNS_MAPS.length]!;
}

function walkable(map: HnsMap, x: number, y: number): boolean {
  return !blocksMove(cellAt(map, x, y));
}

/** Line of sight using fixed-step sampling (deterministic). */
export function lineOfSight(map: HnsMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / 0.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(cellAt(map, tileOf(ax + dx * t), tileOf(ay + dy * t)))) return false;
  }
  return true;
}

/** Can the seeker see this point (torch beam, or very close)? */
export function seekerSees(s: SimState, seeker: Agent, x: number, y: number): boolean {
  const dx = x - seeker.x;
  const dy = y - seeker.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > VISION_RANGE * VISION_RANGE) return false;
  const d = Math.sqrt(d2);
  if (d > SENSE_RANGE && (seeker.fx * dx + seeker.fy * dy) / d < VISION_COS) return false;
  return lineOfSight(mapOf(s), seeker.x, seeker.y, x, y);
}

/** Torch beam outline for drawing: distance the beam reaches along 13 rays. */
export function beamRays(s: SimState, seeker: Agent): { x: number; y: number }[] {
  const map = mapOf(s);
  const out: { x: number; y: number }[] = [];
  // Rotate facing by -40..+40 degrees in 12 steps using precomputed cos/sin.
  const ROT: [number, number][] = [
    [0.766044, -0.642788], [0.843391, -0.537300], [0.906308, -0.422618], [0.951057, -0.309017], [0.984808, -0.173648], [0.998630, -0.052336],
    [1, 0],
    [0.998630, 0.052336], [0.984808, 0.173648], [0.951057, 0.309017], [0.906308, 0.422618], [0.843391, 0.537300], [0.766044, 0.642788],
  ];
  for (const [c, sn] of ROT) {
    const rx = seeker.fx * c - seeker.fy * sn;
    const ry = seeker.fx * sn + seeker.fy * c;
    let d = 0;
    while (d < VISION_RANGE) {
      const nd = d + 0.2;
      if (blocksSight(cellAt(map, tileOf(seeker.x + rx * nd), tileOf(seeker.y + ry * nd)))) break;
      d = nd;
    }
    out.push({ x: seeker.x + rx * d, y: seeker.y + ry * d });
  }
  return out;
}

function moveAgent(map: HnsMap, a: Agent, dx: number, dy: number): void {
  const r = AGENT_R;
  const nx = a.x + dx;
  if (
    walkable(map, tileOf(nx - r), tileOf(a.y - r)) && walkable(map, tileOf(nx + r), tileOf(a.y - r)) &&
    walkable(map, tileOf(nx - r), tileOf(a.y + r)) && walkable(map, tileOf(nx + r), tileOf(a.y + r))
  ) a.x = nx;
  const ny = a.y + dy;
  if (
    walkable(map, tileOf(a.x - r), tileOf(ny - r)) && walkable(map, tileOf(a.x + r), tileOf(ny - r)) &&
    walkable(map, tileOf(a.x - r), tileOf(ny + r)) && walkable(map, tileOf(a.x + r), tileOf(ny + r))
  ) a.y = ny;
}

/** BFS distances over walkable tiles from (x, y). -1 = unreachable. */
function bfs(map: HnsMap, sx: number, sy: number): Int16Array {
  const dist = new Int16Array(MAP_W * MAP_H).fill(-1);
  if (!walkable(map, sx, sy)) return dist;
  const q: number[] = [idx(sx, sy)];
  dist[idx(sx, sy)] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!;
    const x = c % MAP_W;
    const y = (c - x) / MAP_W;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb as [number, number][]) {
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || !walkable(map, nx, ny)) continue;
      const k = idx(nx, ny);
      if (dist[k]! >= 0) continue;
      dist[k] = dist[c]! + 1;
      q.push(k);
    }
  }
  return dist;
}

/** Path (list of tile indices, excluding start) from start to goal using BFS from the goal. */
function pathTo(map: HnsMap, sx: number, sy: number, goal: number): number[] {
  const gx = goal % MAP_W;
  const gy = (goal - gx) / MAP_W;
  const d = bfs(map, gx, gy);
  const path: number[] = [];
  let cx = sx;
  let cy = sy;
  if (d[idx(cx, cy)]! < 0) return path;
  for (let guard = 0; guard < 300 && !(cx === gx && cy === gy); guard++) {
    const here = d[idx(cx, cy)]!;
    let moved = false;
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (d[idx(nx, ny)] === here - 1) {
        cx = nx;
        cy = ny;
        path.push(idx(cx, cy));
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return path;
}

function steerAlong(a: Agent): [number, number] {
  while (a.path.length) {
    const t = a.path[0]!;
    const tx = (t % MAP_W) + 0.5;
    const ty = Math.floor(t / MAP_W) + 0.5;
    const dx = tx - a.x;
    const dy = ty - a.y;
    if (dx * dx + dy * dy < 0.04) {
      a.path.shift();
      continue;
    }
    return [dx, dy];
  }
  return [0, 0];
}

function groundTiles(map: HnsMap): number[] {
  const out: number[] = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (walkable(map, x, y)) out.push(idx(x, y));
  return out;
}

function denOf(map: HnsMap): [number, number] {
  for (let y = 0; y < MAP_H; y++) {
    const x = map.rows[y]!.indexOf('S');
    if (x >= 0) return [x, y];
  }
  return [Math.floor(MAP_W / 2), Math.floor(MAP_H / 2)];
}

/** Tiles next to a sight-blocking object: good hiding places. */
function coverTiles(map: HnsMap): number[] {
  return groundTiles(map).filter((t) => {
    const x = t % MAP_W;
    const y = (t - x) / MAP_W;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => blocksSight(cellAt(map, x + dx!, y + dy!)) && x + dx! >= 0 && y + dy! >= 0 && x + dx! < MAP_W && y + dy! < MAP_H);
  });
}

export function createSim(seed: number, role: HnsRole, seconds: number, aiLevel: HnsAiLevel, names: string[] = []): SimState {
  const rng = new Rng(seed);
  const mapIndex = rng.int(HNS_MAPS.length);
  const map = HNS_MAPS[mapIndex]!;
  const [dx, dy] = denOf(map);
  const ground = groundTiles(map);
  const hiders = 5;
  const total = 1 + hiders;
  const agents: Agent[] = [];
  const near = ground.filter((t) => {
    const x = t % MAP_W;
    const y = (t - x) / MAP_W;
    return Math.abs(x - dx) <= 2 && Math.abs(y - dy) <= 2 && !(x === dx && y === dy);
  });
  const pickNear = rng.shuffle(near);
  for (let i = 0; i < total; i++) {
    // Agent 0 is the human. In a seeker round they are the seeker; otherwise agent 1 is the AI seeker.
    const isSeeker = role === 'seeker' ? i === 0 : i === 1;
    let x = dx + 0.5;
    let y = dy + 0.5;
    if (!isSeeker) {
      const t = pickNear[i % pickNear.length]!;
      x = (t % MAP_W) + 0.5;
      y = Math.floor(t / MAP_W) + 0.5;
    }
    agents.push({
      name: names[i] ?? (isSeeker ? 'Seeker' : `Hider ${i}`),
      role: isSeeker ? 'seeker' : 'hider',
      x, y, fx: 0, fy: 1,
      caught: false, caughtTick: -1,
      path: [], goal: -1, think: i * 3,
      lastSeenX: 0, lastSeenY: 0, hasLastSeen: false,
      rescues: 0, marbles: 0,
    });
  }
  const far = rng.shuffle(ground.filter((t) => {
    const x = t % MAP_W;
    const y = (t - x) / MAP_W;
    return Math.abs(x - dx) + Math.abs(y - dy) >= 4;
  })).slice(0, MARBLES);
  return {
    mapIndex,
    role,
    ticks: 0,
    totalTicks: Math.round(seconds * TICK_HZ),
    aiLevel,
    agents,
    marbles: far.map((t) => ({ x: (t % MAP_W) + 0.5, y: Math.floor(t / MAP_W) + 0.5, taken: false })),
    rngState: rng.state,
    playerRngState: (seed ^ hashString('player')) >>> 0,
    over: false,
    events: [],
  };
}

export function simMap(s: SimState): HnsMap {
  return mapOf(s);
}

export function seekerOf(s: SimState): Agent {
  return s.agents.find((a) => a.role === 'seeker')!;
}

// ---------------------------------------------------------------- AI

function aiSeeker(s: SimState, a: Agent, rng: Rng, level: HnsAiLevel): [number, number, boolean] {
  const map = mapOf(s);
  if (s.ticks < HIDE_TICKS) return [0, 0, false];
  let target: Agent | null = null;
  let best = Infinity;
  for (const h of s.agents) {
    if (h.role !== 'hider' || h.caught) continue;
    if (!seekerSees(s, a, h.x, h.y)) continue;
    const d = (h.x - a.x) * (h.x - a.x) + (h.y - a.y) * (h.y - a.y);
    if (d < best) {
      best = d;
      target = h;
    }
  }
  if (target) {
    a.lastSeenX = target.x;
    a.lastSeenY = target.y;
    a.hasLastSeen = true;
    a.path = [];
    if (lineOfSight(map, a.x, a.y, target.x, target.y)) return [target.x - a.x, target.y - a.y, false];
  }
  if (a.hasLastSeen) {
    const dx = a.lastSeenX - a.x;
    const dy = a.lastSeenY - a.y;
    if (dx * dx + dy * dy < 0.25) a.hasLastSeen = false;
    else {
      if (!a.path.length || a.think-- <= 0) {
        a.path = pathTo(map, tileOf(a.x), tileOf(a.y), idx(tileOf(a.lastSeenX), tileOf(a.lastSeenY)));
        a.think = 10;
        if (!a.path.length) a.hasLastSeen = false;
      }
      return [...steerAlong(a), false];
    }
  }
  // Patrol: head for likely hiding places; smarter seekers prefer cover far from where they've been.
  if (!a.path.length) {
    const cover = coverTiles(map);
    let pick = rng.pick(cover);
    if (level !== 'easy') {
      // Bias toward hiders' general area (a "hunch"), harder seekers more often.
      const free = s.agents.filter((h) => h.role === 'hider' && !h.caught);
      if (free.length && rng.chance(level === 'hard' ? 0.45 : 0.25)) {
        const h = rng.pick(free);
        const nearby = cover.filter((t) => {
          const x = t % MAP_W;
          const y = (t - x) / MAP_W;
          return Math.abs(x + 0.5 - h.x) + Math.abs(y + 0.5 - h.y) <= 4;
        });
        if (nearby.length) pick = rng.pick(nearby);
      }
    }
    a.path = pathTo(map, tileOf(a.x), tileOf(a.y), pick);
  }
  return [...steerAlong(a), level === 'easy'];
}

function aiHider(s: SimState, a: Agent, rng: Rng, level: HnsAiLevel): [number, number, boolean] {
  const map = mapOf(s);
  const seeker = seekerOf(s);
  const sdx = seeker.x - a.x;
  const sdy = seeker.y - a.y;
  const sd2 = sdx * sdx + sdy * sdy;
  const threat = s.ticks >= HIDE_TICKS && sd2 < 16 && lineOfSight(map, a.x, a.y, seeker.x, seeker.y);
  if (a.think > 0) a.think--;
  if (threat && a.think <= 0) {
    // Flee: reachable tile that is far from the seeker and not too far for us.
    const mine = bfs(map, tileOf(a.x), tileOf(a.y));
    const theirs = bfs(map, tileOf(seeker.x), tileOf(seeker.y));
    let best = -1;
    let bestScore = -Infinity;
    for (let k = 0; k < mine.length; k++) {
      const dm = mine[k]!;
      if (dm < 0 || dm > 7) continue;
      const ds = theirs[k]!;
      const sc = (ds < 0 ? 30 : ds) - dm * 0.6 + rng.next() * 0.5;
      if (sc > bestScore) {
        bestScore = sc;
        best = k;
      }
    }
    if (best >= 0) a.path = pathTo(map, tileOf(a.x), tileOf(a.y), best);
    a.think = level === 'easy' ? 18 : level === 'medium' ? 10 : 6;
  } else if (!a.path.length && a.think <= 0) {
    const caughtFriend = s.agents.find((h) => h.role === 'hider' && h.caught);
    const rescueChance = level === 'easy' ? 0.05 : level === 'medium' ? 0.12 : 0.2;
    if (caughtFriend && sd2 > 49 && s.ticks >= HIDE_TICKS && rng.chance(rescueChance)) {
      a.path = pathTo(map, tileOf(a.x), tileOf(a.y), idx(tileOf(caughtFriend.x), tileOf(caughtFriend.y)));
    } else if (s.ticks < HIDE_TICKS || rng.chance(0.02)) {
      // Pick a hiding place: next to cover, far from the den.
      const cover = coverTiles(map).filter((t) => {
        const x = t % MAP_W;
        const y = (t - x) / MAP_W;
        return Math.abs(x + 0.5 - seeker.x) + Math.abs(y + 0.5 - seeker.y) >= 5;
      });
      if (cover.length) a.path = pathTo(map, tileOf(a.x), tileOf(a.y), rng.pick(cover));
    }
    a.think = 20;
  }
  return [...steerAlong(a), false];
}

/** AI input code for agent 0 (used for bots' rounds and for timed-out players). */
export function aiPlayerCode(s: SimState, level: HnsAiLevel): number {
  const rng = new Rng(s.playerRngState);
  const a = s.agents[0]!;
  const [dx, dy, walk] = a.role === 'seeker' ? aiSeeker(s, a, rng, level) : aiHider(s, a, rng, level);
  s.playerRngState = rng.state;
  return quantize(dx, dy, walk);
}

// ---------------------------------------------------------------- step

/** Advance one tick. `code` drives agent 0. Mutates `s`. */
export function step(s: SimState, code: number): void {
  if (s.over) return;
  s.events = [];
  const map = mapOf(s);
  const rng = new Rng(s.rngState);
  const level = s.aiLevel;
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i]!;
    if (a.caught) continue;
    let dx = 0;
    let dy = 0;
    let speed = a.role === 'seeker' ? (i === 0 ? PLAYER_SEEKER_SPEED : SEEKER_SPEED[level]) : HIDER_SPEED;
    if (i === 0) {
      const c = Number.isInteger(code) && code >= 0 && code <= MAX_CODE ? code : 0;
      if (c > 0) {
        const d = DIRS[(c - 1) % 16]!;
        dx = d[0];
        dy = d[1];
        if (c > 16) speed *= 0.5;
      }
      if (a.role === 'seeker' && s.ticks < HIDE_TICKS) dx = dy = 0; // blindfolded while counting
    } else {
      const [ax, ay, walk] = a.role === 'seeker' ? aiSeeker(s, a, rng, level) : aiHider(s, a, rng, level);
      const len = Math.sqrt(ax * ax + ay * ay);
      if (len > 1e-6) {
        dx = ax / len;
        dy = ay / len;
      }
      if (walk) speed *= 0.6;
    }
    if (dx !== 0 || dy !== 0) {
      a.fx = dx;
      a.fy = dy;
      moveAgent(map, a, dx * speed * DT, dy * speed * DT);
    }
  }
  s.rngState = rng.state;

  const seeker = seekerOf(s);
  if (s.ticks >= HIDE_TICKS) {
    for (let i = 0; i < s.agents.length; i++) {
      const h = s.agents[i]!;
      if (h.role !== 'hider' || h.caught) continue;
      const dx = h.x - seeker.x;
      const dy = h.y - seeker.y;
      if (dx * dx + dy * dy < CATCH_DIST * CATCH_DIST) {
        h.caught = true;
        h.caughtTick = s.ticks;
        s.events.push(`caught:${i}`);
      }
    }
    // Free hiders rescue caught friends by touching them (if the seeker isn't right there).
    for (let i = 0; i < s.agents.length; i++) {
      const r = s.agents[i]!;
      if (r.role !== 'hider' || r.caught) continue;
      for (let j = 0; j < s.agents.length; j++) {
        const c = s.agents[j]!;
        if (!c.caught) continue;
        const dx = c.x - r.x;
        const dy = c.y - r.y;
        const sx = c.x - seeker.x;
        const sy = c.y - seeker.y;
        if (dx * dx + dy * dy < RESCUE_DIST * RESCUE_DIST && sx * sx + sy * sy > 2.25) {
          c.caught = false;
          r.rescues += 1;
          s.events.push(`rescued:${j}`);
        }
      }
    }
  }
  for (const m of s.marbles) {
    if (m.taken) continue;
    for (const a of s.agents) {
      if (a.role !== 'hider' || a.caught) continue;
      const dx = m.x - a.x;
      const dy = m.y - a.y;
      if (dx * dx + dy * dy < 0.36) {
        m.taken = true;
        a.marbles += 1;
        if (a === s.agents[0]) s.events.push('marble');
        break;
      }
    }
  }
  s.ticks += 1;
  const allCaught = s.agents.every((a) => a.role === 'seeker' || a.caught);
  const meCaught = s.role === 'hider' && s.agents[0]!.caught;
  if (s.ticks >= s.totalTicks || allCaught || meCaught) s.over = true;
}

export function resultOf(s: SimState): RoundResult {
  const me = s.agents[0]!;
  const hiders = s.agents.filter((a) => a.role === 'hider');
  const caught = hiders.filter((a) => a.caught).length;
  const allCaught = caught === hiders.length;
  if (s.role === 'seeker') {
    const remaining = Math.max(0, s.totalTicks - s.ticks) / TICK_HZ;
    return {
      role: 'seeker', caught, allCaught, rescues: 0, marbles: 0, wasCaught: false, ticks: s.ticks,
      survivedSeconds: 0,
      score: caught * 100 + (allCaught ? Math.round(remaining * 3) : 0),
    };
  }
  const survivedTicks = me.caught ? me.caughtTick : s.ticks;
  const survivedSeconds = Math.round((survivedTicks / TICK_HZ) * 10) / 10;
  return {
    role: 'hider', caught, allCaught, rescues: me.rescues, marbles: me.marbles, wasCaught: me.caught, ticks: s.ticks,
    survivedSeconds,
    score: Math.round(survivedSeconds * 2) + me.marbles * 10 + me.rescues * 40 + (me.caught ? 0 : 100),
  };
}

/** Replay a recorded input string (server verification). Returns null if the input is malformed. */
export function replay(seed: number, role: HnsRole, seconds: number, level: HnsAiLevel, inputs: string): RoundResult | null {
  const s = createSim(seed, role, seconds, level);
  if (inputs.length > s.totalTicks) return null;
  for (let i = 0; i < inputs.length; i++) {
    const c = decodeInput(inputs[i]!);
    if (!(c >= 0 && c <= MAX_CODE)) return null;
    step(s, c);
    if (s.over) {
      // Extra input after the round ended is not allowed.
      if (i !== inputs.length - 1) return null;
      return resultOf(s);
    }
  }
  // Input ended early (player quit / app closed): the character stands still for the rest.
  while (!s.over) step(s, 0);
  return resultOf(s);
}

/** Let the AI play agent 0 and return the inputs it produced (bots / timed-out players). */
export function autoplay(seed: number, role: HnsRole, seconds: number, level: HnsAiLevel, playerLevel: HnsAiLevel = level, salt = ''): { inputs: string; result: RoundResult } {
  const s = createSim(seed, role, seconds, level);
  // Each bot plays the same level in its own style.
  if (salt) s.playerRngState = (s.playerRngState ^ hashString(salt)) >>> 0;
  let inputs = '';
  while (!s.over) {
    const c = aiPlayerCode(s, playerLevel);
    inputs += encodeInput(c);
    step(s, c);
  }
  return { inputs, result: resultOf(s) };
}
