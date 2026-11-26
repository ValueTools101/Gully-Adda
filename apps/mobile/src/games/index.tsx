import { rmcs, mafia, npat, hideseek, type GameId, type HnsState, type MafiaState, type NpatState, type PlayerId, type RmcsState } from '@gully/engine';
import { colors } from '../theme';
import { DotsBoard } from './DotsBoard';
import { HideSeekBoard } from './HideSeekBoard';
import { LudoBoard } from './LudoBoard';
import { MafiaBoard } from './MafiaBoard';
import { NpatBoard } from './NpatBoard';
import { RmcsBoard } from './RmcsBoard';
import type { GameUI } from './types';

const notPending = (pending: PlayerId[]) => (pid: PlayerId) => !pending.includes(pid);

export const GAME_UI: Record<GameId, GameUI> = {
  rmcs: {
    id: 'rmcs',
    emoji: '👑',
    color: colors.mustard,
    Board: RmcsBoard,
    sharedView: 'actor',
    phaseKey: (s) => `${(s as RmcsState).round}:${(s as RmcsState).phase}`,
    // Everyone peeks at their chit privately; guessing and results happen on the shared screen.
    privateTurns: (s, humans) => ((s as RmcsState).phase === 'peek' ? humans : []),
    privateDone: (s, pid) => notPending(rmcs.pendingActors(s as RmcsState))(pid),
  },
  mafia: {
    id: 'mafia',
    emoji: '🕶️',
    color: colors.maroon,
    Board: MafiaBoard,
    sharedView: 'public',
    phaseKey: (s) => `${(s as MafiaState).day}:${(s as MafiaState).phase}`,
    privateTurns: (s, humans) => {
      const st = s as MafiaState;
      if (st.over) return [];
      if (st.phase === 'roles') return humans;
      // Every living person takes the phone at night, so nobody can tell roles apart by who holds it.
      if (st.phase === 'night' || st.phase === 'vote') return humans.filter((h) => st.alive.includes(h));
      return [];
    },
    privateDone: (s, pid) => notPending(mafia.pendingActors(s as MafiaState))(pid),
  },
  npat: {
    id: 'npat',
    emoji: '✍️',
    color: colors.teal,
    Board: NpatBoard,
    sharedView: 'public',
    phaseKey: (s) => `${(s as NpatState).round}:${(s as NpatState).phase}`,
    privateTurns: (s, humans) => ((s as NpatState).phase === 'answer' && !s.over ? humans : []),
    privateDone: (s, pid) => notPending(npat.pendingActors(s as NpatState))(pid),
  },
  hideseek: {
    id: 'hideseek',
    emoji: '🙈',
    color: colors.sky,
    Board: HideSeekBoard,
    sharedView: 'public',
    phaseKey: (s) => `${(s as HnsState).match}:${(s as HnsState).phase}:${(s as HnsState).round}`,
    // Hiding spots and every round's secret choice are made privately, one person at a time.
    privateTurns: (s, humans) => {
      const st = s as HnsState;
      if (st.over || st.phase === 'reveal') return [];
      const seeker = st.players[st.seekerIndex % st.players.length]?.id;
      return humans.filter((h) => (st.phase === 'seek' && h === seeker) || st.status[h] === 'hiding');
    },
    privateDone: (s, pid) => notPending(hideseek.pendingActors(s as HnsState))(pid),
  },
  dots: {
    id: 'dots',
    emoji: '🔲',
    color: colors.pink,
    Board: DotsBoard,
    sharedView: 'actor',
    phaseKey: () => '',
    privateTurns: null,
    privateDone: () => true,
  },
  ludo: {
    id: 'ludo',
    emoji: '🎲',
    color: colors.leaf,
    Board: LudoBoard,
    sharedView: 'actor',
    phaseKey: () => '',
    privateTurns: null,
    privateDone: () => true,
  },
};
