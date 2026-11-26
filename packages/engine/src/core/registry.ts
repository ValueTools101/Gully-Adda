import type { AnyGame, GameId } from './types';
import { rmcs } from '../games/rmcs';
import { dots } from '../games/dots';
import { npat } from '../games/npat';
import { mafia } from '../games/mafia';
import { ludo } from '../games/ludo';

/**
 * Every playable game. Adding a game = add a folder under src/games that
 * exports a GameDefinition, then add it here (and a UI screen in the app).
 * Card games later (Teen Patti, Rummy, Bluff, Seep) slot in the same way;
 * see src/core/cards.ts for the shared deck helpers.
 */
export const GAMES: Record<GameId, AnyGame> = { rmcs, mafia, npat, dots, ludo };

export const GAME_ORDER: GameId[] = ['rmcs', 'mafia', 'npat', 'dots', 'ludo'];

export function getGame(id: string): AnyGame | null {
  return isGameId(id) ? GAMES[id] : null;
}

export function isGameId(id: unknown): id is GameId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(GAMES, id);
}
