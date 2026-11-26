/**
 * Shared playing-card helpers, ready for future card games (Teen Patti,
 * Rummy, Bluff, Seep). Not used by v1 games yet. Hidden hands work exactly
 * like Mafia roles: keep them in state, strip them in getPlayerView.
 */
import type { Rng } from './rng';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function newDeck(decks = 1): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) out.push({ suit, rank });
  return out;
}

export function shuffledDeck(rng: Rng, decks = 1): Card[] {
  return rng.shuffle(newDeck(decks));
}

export function deal(deck: Card[], players: number, perPlayer: number): { hands: Card[][]; rest: Card[] } {
  const hands: Card[][] = Array.from({ length: players }, () => []);
  let i = 0;
  for (let k = 0; k < perPlayer; k++) for (let p = 0; p < players; p++) (hands[p] as Card[]).push(deck[i++] as Card);
  return { hands, rest: deck.slice(i) };
}

export function cardLabel(c: Card): string {
  return `${c.rank}${c.suit}`;
}
