import type { BaseState, BaseView, GameAction, GameId, PlayerId } from '@gully/engine';
import type { ComponentType } from 'react';

export type PlayMode = 'bots' | 'pass' | 'online';

export interface BoardProps<V extends BaseView = BaseView> {
  view: V;
  mode: PlayMode;
  /** Pass & play: this screen is visible to everyone (no secrets shown). */
  shared: boolean;
  /** Act as the viewing player (or, on a shared screen, as the current actor). */
  act: (action: GameAction) => void;
  /** Act for every local human the game is waiting on (pass & play group buttons). Online/bots: acts as me. */
  actGroup: (make: (pid: PlayerId) => GameAction | null) => void;
  /** Local humans on this device. */
  humans: PlayerId[];
}

export interface GameUI {
  id: GameId;
  emoji: string;
  color: string;
  Board: ComponentType<BoardProps<any>>;
  /**
   * Pass & play: which humans need a private look in the current phase, in order.
   * Return null for games without secrets (one shared screen).
   */
  privateTurns: ((state: BaseState, humans: PlayerId[]) => PlayerId[]) | null;
  /** Key that changes whenever a new private round should start. */
  phaseKey: (state: BaseState) => string;
  /** Shared screen renders the public view ('public') or the current actor's view ('actor'). */
  sharedView: 'public' | 'actor';
  /** Is this player done with their private turn (can hide & pass)? */
  privateDone: (state: BaseState, pid: PlayerId) => boolean;
}
