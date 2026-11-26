import type { BotDifficulty, GameId, PlayerInfo } from '@gully/engine';

/** A local (offline) game setup handed from the setup screen to the play screen. */
export interface LocalSetup {
  game: GameId;
  mode: 'bots' | 'pass';
  players: PlayerInfo[];
  config: unknown;
  difficulty: BotDifficulty;
}

let pending: LocalSetup | null = null;

export function setLocalSetup(s: LocalSetup): void {
  pending = s;
}

export function getLocalSetup(): LocalSetup | null {
  return pending;
}
