import { describe, expect, it } from 'vitest';
import { Rng, SKIP, defaultMafiaCount, mafia, type MafiaState } from '../src';
import { T0, players } from './helpers';

const ctx = { now: T0 };
function start(n = 6, seed = 1, cfg: Record<string, unknown> = {}): MafiaState {
  return mafia.createGame({ ...mafia.defaultConfig(n), ...cfg }, players(n, false), new Rng(seed), ctx);
}
function act(s: MafiaState, pid: string, a: Parameters<typeof mafia.applyAction>[2]): MafiaState {
  const r = mafia.applyAction(s, pid, a, ctx);
  if (!r.ok) throw new Error(`${pid} ${JSON.stringify(a)}: ${r.reason}`);
  return r.state;
}
const who = (s: MafiaState, role: string) => Object.keys(s.roles).filter((id) => s.roles[id] === role);
function toNight(s: MafiaState): MafiaState {
  for (const p of s.players) s = act(s, p.id, { type: 'ack' });
  return s;
}

describe('Mafia', () => {
  it('scales mafia by player count', () => {
    expect([5, 6, 7, 9, 10, 12].map(defaultMafiaCount)).toEqual([1, 1, 2, 2, 3, 3]);
    const s = start(10);
    expect(who(s, 'mafia')).toHaveLength(3);
    expect(who(s, 'doctor')).toHaveLength(1);
    expect(who(s, 'detective')).toHaveLength(1);
  });

  it('villagers cannot see any other role; mafia see each other', () => {
    const s = start(9, 3);
    const vill = who(s, 'villager')[0]!;
    const v = mafia.getPlayerView(s, vill);
    expect(Object.keys(v.knownRoles)).toEqual([vill]);
    expect(JSON.stringify(v)).not.toContain('"mafia":[');
    const m = who(s, 'mafia');
    const mv = mafia.getPlayerView(s, m[0]!);
    expect(Object.keys(mv.knownRoles).sort()).toEqual([...m].sort());
    expect(JSON.stringify(mafia.getPublicState(s).knownRoles)).toBe('{}');
  });

  it('a full night: mafia kill, doctor save fails, detective learns', () => {
    let s = toNight(start(6, 2));
    expect(s.phase).toBe('night');
    const [m] = who(s, 'mafia');
    const [doc] = who(s, 'doctor');
    const [det] = who(s, 'detective');
    const victim = who(s, 'villager')[0]!;
    s = act(s, m!, { type: 'kill', target: victim });
    s = act(s, doc!, { type: 'save', target: doc! });
    s = act(s, det!, { type: 'check', target: m! });
    expect(s.phase).toBe('day');
    expect(s.alive).not.toContain(victim);
    expect(mafia.getPlayerView(s, det!).myChecks).toEqual([{ night: 1, target: m, isMafia: true }]);
    expect(mafia.getPlayerView(s, victim).myChecks).toEqual([]);
  });

  it('the doctor saves the victim', () => {
    let s = toNight(start(6, 2));
    const victim = who(s, 'villager')[0]!;
    s = act(s, who(s, 'mafia')[0]!, { type: 'kill', target: victim });
    s = act(s, who(s, 'doctor')[0]!, { type: 'save', target: victim });
    s = act(s, who(s, 'detective')[0]!, { type: 'check', target: victim });
    expect(s.alive).toContain(victim);
    expect(s.lastNight).toEqual({ killed: null, saved: true });
  });

  it('no consecutive saves of the same player', () => {
    let s = toNight(start(6, 2));
    const doc = who(s, 'doctor')[0]!;
    s = act(s, doc, { type: 'save', target: doc });
    expect(mafia.listLegalActions(s, doc)).toEqual([]);
    s = act(s, who(s, 'mafia')[0]!, { type: 'kill', target: who(s, 'villager')[0]! });
    s = act(s, who(s, 'detective')[0]!, { type: 'check', target: doc });
    for (const id of [...s.alive]) s = act(s, id, { type: 'ready' });
    for (const id of [...s.alive]) s = act(s, id, { type: 'vote', target: SKIP });
    expect(s.phase).toBe('night');
    expect(mafia.applyAction(s, doc, { type: 'save', target: doc }, ctx).ok).toBe(false);
  });

  it('night actions are hidden: waitingFor is empty at night', () => {
    const s = toNight(start(6, 4));
    for (const p of s.players) expect(mafia.getPlayerView(s, p.id).waitingFor).toEqual([]);
  });

  it('day vote eliminates the plurality and village can win', () => {
    let s = toNight(start(5, 9, { doctor: false, detective: false }));
    const m = who(s, 'mafia')[0]!;
    s = act(s, m, { type: 'kill', target: who(s, 'villager')[0]! });
    for (const id of [...s.alive]) s = act(s, id, { type: 'ready' });
    expect(s.phase).toBe('vote');
    for (const id of [...s.alive]) s = act(s, id, { type: 'vote', target: id === m ? s.alive.find((x) => x !== m)! : m });
    expect(s.over).toBe(true);
    expect(s.winner).toBe('village');
  });

  it('votes are secret until the vote resolves', () => {
    let s = toNight(start(6, 5));
    s = act(s, who(s, 'mafia')[0]!, { type: 'kill', target: who(s, 'villager')[0]! });
    s = act(s, who(s, 'doctor')[0]!, { type: 'save', target: who(s, 'doctor')[0]! });
    s = act(s, who(s, 'detective')[0]!, { type: 'check', target: who(s, 'doctor')[0]! });
    for (const id of [...s.alive]) s = act(s, id, { type: 'ready' });
    const [a, b] = s.alive;
    s = act(s, a!, { type: 'vote', target: b! });
    const v = mafia.getPlayerView(s, b!);
    expect(v.voted).toEqual([a]);
    expect(JSON.stringify(v)).not.toContain(`"${a}":"${b}"`);
  });

  it('dead players get a limited view and graveyard-only chat', () => {
    let s = toNight(start(8, 6));
    const victim = who(s, 'villager')[0]!;
    for (const m of who(s, 'mafia')) s = act(s, m, { type: 'kill', target: victim });
    s = act(s, who(s, 'doctor')[0]!, { type: 'save', target: who(s, 'doctor')[0]! });
    s = act(s, who(s, 'detective')[0]!, { type: 'check', target: who(s, 'doctor')[0]! });
    const v = mafia.getPlayerView(s, victim);
    expect(v.amAlive).toBe(false);
    expect(Object.keys(v.knownRoles).every((id) => id === victim || !s.alive.includes(id))).toBe(true);
    const pol = mafia.chatPolicy!(s, victim);
    expect(pol.canWrite).toEqual(['dead']);
    expect(pol.canSpeak).toBe(false);
    const living = mafia.chatPolicy!(s, s.alive[0]!);
    expect(living.canRead).not.toContain('dead');
    expect(living.canSpeak).toBe(true);
  });

  it('everyone is muted at night; mafia may whisper in mafia chat', () => {
    const s = toNight(start(6, 7));
    for (const id of s.alive) expect(mafia.chatPolicy!(s, id).canSpeak).toBe(false);
    const m = who(s, 'mafia')[0]!;
    expect(mafia.chatPolicy!(s, m).canWrite).toEqual(['mafia']);
    expect(mafia.chatPolicy!(s, who(s, 'villager')[0]!).canWrite).toEqual([]);
  });

  it('rejects wrong-role night actions', () => {
    const s = toNight(start(6, 8));
    const vill = who(s, 'villager')[0]!;
    expect(mafia.applyAction(s, vill, { type: 'kill', target: who(s, 'doctor')[0]! }, ctx).ok).toBe(false);
    const m = who(s, 'mafia')[0]!;
    expect(mafia.applyAction(s, m, { type: 'kill', target: m }, ctx).ok).toBe(false);
  });
});

describe('ghost guesses for players who are out', () => {
  it('out players guess once per day; correct guesses score at the end; living players cannot', () => {
    let s = toNight(start(8, 6));
    const victim = who(s, 'villager')[0]!;
    for (const m of who(s, 'mafia')) s = act(s, m, { type: 'kill', target: victim });
    s = act(s, who(s, 'doctor')[0]!, { type: 'save', target: who(s, 'doctor')[0]! });
    s = act(s, who(s, 'detective')[0]!, { type: 'check', target: who(s, 'doctor')[0]! });
    expect(s.phase).toBe('day');
    const m = who(s, 'mafia')[0]!;
    expect(mafia.applyAction(s, s.alive[0]!, { type: 'ghost', target: m }, ctx).ok).toBe(false);
    s = act(s, victim, { type: 'ghost', target: m });
    expect(mafia.applyAction(s, victim, { type: 'ghost', target: m }, ctx).ok).toBe(false); // once per day
    expect(mafia.getPlayerView(s, victim).ghostGuesses[victim]).toEqual([{ day: 1, target: m }]);
    expect(mafia.getPlayerView(s, m).ghostGuesses).toEqual({}); // private
    expect(mafia.pendingActors(s)).not.toContain(victim); // never blocks the game
    const before = mafia.scores({ ...s, winner: null } as MafiaState)[victim]!;
    expect(before).toBe(25);
  });
});
