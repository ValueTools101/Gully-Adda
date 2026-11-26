/**
 * Runs a game entirely on the device (bots and pass & play). The same engine
 * code runs on the server for online games.
 */
import {
  Rng, applyTimeoutIfDue, botRng, getGame, randomSeed,
  type BaseState, type BaseView, type GameAction, type PlayerId,
} from '@gully/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_UI } from '../games';
import type { LocalSetup } from './session';

const BOT_DELAY_MS = 750;

export type LocalScreen =
  | { kind: 'gate'; player: PlayerId }
  | { kind: 'private'; player: PlayerId; view: BaseView; canHide: boolean }
  | { kind: 'board'; view: BaseView; actor: PlayerId | null };

export function useLocalGame(setup: LocalSetup) {
  const game = getGame(setup.game)!;
  const ui = GAME_UI[setup.game];
  const humans = useMemo(() => setup.players.filter((p) => !p.isBot).map((p) => p.id), [setup.players]);
  const [state, setState] = useState<BaseState>(() => game.createGame(setup.config, setup.players, new Rng(randomSeed()), { now: Date.now() }));
  const [seen, setSeen] = useState<{ key: string; ids: PlayerId[] }>({ key: '', ids: [] });
  const [revealed, setRevealed] = useState<PlayerId | null>(null);
  // Always updated together with setState (see apply / timeout handlers).
  const stateRef = useRef(state);

  const isBot = useCallback((id: PlayerId) => setup.players.find((p) => p.id === id)?.isBot ?? false, [setup.players]);

  const apply = useCallback(
    (pid: PlayerId, action: GameAction) => {
      const res = game.applyAction(stateRef.current, pid, action, { now: Date.now() });
      if (res.ok) {
        stateRef.current = res.state;
        setState(res.state);
      }
      return res.ok;
    },
    [game],
  );

  // Bots: one action at a time with a small delay so humans can follow along.
  useEffect(() => {
    if (state.over) return;
    const bots = game.pendingActors(state).filter(isBot);
    if (!bots.length) return;
    const id = setTimeout(() => {
      const s = stateRef.current;
      for (const b of game.pendingActors(s).filter(isBot)) {
        const a = game.getBotAction(s, b, setup.difficulty, botRng(s, b));
        if (a && apply(b, a)) return;
      }
    }, game.meta.simultaneous ? BOT_DELAY_MS / 2 : BOT_DELAY_MS);
    return () => clearTimeout(id);
  }, [state, game, isBot, apply, setup.difficulty]);

  // Timers (NPAT rounds and any timed phases).
  useEffect(() => {
    if (state.over || state.deadline === null) return;
    const id = setTimeout(() => {
      const next = applyTimeoutIfDue(game, stateRef.current, { now: Date.now() });
      if (next !== stateRef.current) {
        stateRef.current = next;
        setState(next);
      }
    }, Math.max(0, state.deadline - Date.now()) + 50);
    return () => clearTimeout(id);
  }, [state, game]);

  const phaseKey = ui.phaseKey(state);
  const seenIds = seen.key === phaseKey ? seen.ids : [];

  let screen: LocalScreen;
  if (setup.mode === 'bots') {
    screen = { kind: 'board', view: game.getPlayerView(state, humans[0] ?? ''), actor: humans[0] ?? null };
  } else {
    const queue = ui.privateTurns ? ui.privateTurns(state, humans).filter((h) => !seenIds.includes(h)) : [];
    const holder = queue[0];
    if (holder && !state.over) {
      if (revealed === holder) {
        screen = { kind: 'private', player: holder, view: game.getPlayerView(state, holder), canHide: ui.privateDone(state, holder) };
      } else screen = { kind: 'gate', player: holder };
    } else {
      const pendingHumans = game.pendingActors(state).filter((p) => humans.includes(p));
      const actor = pendingHumans[0] ?? null;
      const view = ui.sharedView === 'public' ? { ...game.getPublicState(state), legal: actor ? game.listLegalActions(state, actor) : [] } : game.getPlayerView(state, actor ?? humans[0] ?? '');
      screen = { kind: 'board', view, actor };
    }
  }

  const reveal = useCallback((pid: PlayerId) => setRevealed(pid), []);
  const hide = useCallback(
    (pid: PlayerId) => {
      setRevealed(null);
      setSeen((prev) => ({ key: phaseKey, ids: prev.key === phaseKey ? [...prev.ids, pid] : [pid] }));
    },
    [phaseKey],
  );

  /** Act as the player whose screen is showing. */
  const act = useCallback(
    (action: GameAction) => {
      const who = screen.kind === 'private' ? screen.player : screen.kind === 'board' ? screen.actor : null;
      if (who) apply(who, action);
    },
    [screen, apply],
  );

  /** Group button: act for every human the game is waiting on (or just me in bots mode). */
  const actGroup = useCallback(
    (make: (pid: PlayerId) => GameAction | null) => {
      const targets = setup.mode === 'bots' ? humans.slice(0, 1) : humans;
      for (const pid of targets) {
        const s = stateRef.current;
        const a = make(pid);
        if (!a) continue;
        if (!game.listLegalActions(s, pid).some((l: GameAction) => l.type === a.type)) continue;
        apply(pid, a);
      }
    },
    [setup.mode, humans, game, apply],
  );

  return { state, screen, humans, act, actGroup, reveal, hide, game, ui };
}
