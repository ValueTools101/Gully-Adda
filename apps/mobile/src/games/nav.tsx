import { createContext, useContext } from 'react';

/** Navigation actions boards can call at game over (provided by the host screen). */
export interface GameNav {
  again?: () => void;
  home: () => void;
}

export const GameNavContext = createContext<GameNav>({ home: () => {} });

export function useGameNav(): GameNav {
  return useContext(GameNavContext);
}
