/**
 * Mohalla maps for real-time Chhupan Chhupai. 18 x 14 tiles.
 *   .  open ground          H  house (tall, blocks movement and sight)
 *   T  neem tree (blocks)   C  auto rickshaw (blocks)   B  haystack (blocks)
 *   W  low wall (blocks)    P  pond (blocks movement, NOT sight)
 *   S  seeker's den (ground) where the round starts
 */
export const MAP_W = 18;
export const MAP_H = 14;

export interface HnsMap {
  id: string;
  rows: string[];
}

export const HNS_MAPS: HnsMap[] = [
  {
    id: 'mohalla',
    rows: [
      'HHH...T....HHH..TT',
      'HHH.......BHHH....',
      '.....CC...........',
      '..W.......TT..HH..',
      '..W..HHH......HH..',
      '..W..HHH..B.......',
      '.........S....W...',
      '.T.B..........W.T.',
      '......PP..HHH.....',
      '..HH..PP..HHH..C..',
      '..HH...........C..',
      '.......T..B..T....',
      '.B..WWW......HHH..',
      '....T......B.HHH..',
    ],
  },
  {
    id: 'bazaar',
    rows: [
      '..T.....HH.....T..',
      '.HHH....HH...HHH..',
      '.HHH..C......HHH..',
      '......C...B.......',
      '..B.......WWW..T..',
      'HH....HH.........C',
      'HH....HH..S......C',
      '..........PP..HH..',
      '.T..WW....PP..HH..',
      '....WW..B.........',
      '..C......T...B....',
      '..C...HHH.......T.',
      '.T....HHH...HH....',
      '............HH..B.',
    ],
  },
  {
    id: 'school',
    rows: [
      'T...........HHHHH.',
      '..HHHHH.....HHHHH.',
      '..HHHHH...B.......',
      '.........T....T...',
      '.B..PP...........B',
      '....PP..W..W..C...',
      '..T.....W.SW..C...',
      '........W..W......',
      '.HH...........T...',
      '.HH..B....HHH.....',
      '.....T....HHH..B..',
      '..C.......HHH.....',
      '..C...B.......T...',
      'T.........T......T',
    ],
  },
];

export type Cell = '.' | 'H' | 'T' | 'C' | 'B' | 'W' | 'P' | 'S';

export function cellAt(map: HnsMap, x: number, y: number): Cell {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'H';
  return (map.rows[y]?.[x] ?? 'H') as Cell;
}

export function blocksMove(c: Cell): boolean {
  return c !== '.' && c !== 'S';
}

export function blocksSight(c: Cell): boolean {
  return blocksMove(c) && c !== 'P';
}
