import { simSuite } from './run';

simSuite('hideseek', [
  { sizes: [3, 5, 8], runs: 0.7 },
  { sizes: [4, 6], config: () => ({ maxRounds: 6, matches: 2, hideSeconds: 20, roundSeconds: 20, revealSeconds: 5 }), timeoutRate: 0.15, runs: 0.4 },
]);
