import { simSuite } from './run';

simSuite('npat', [
  { sizes: [2, 4, 7, 10], runs: 0.5 },
  { sizes: [3, 6], config: () => ({ rounds: 3, roundSeconds: 30 }), timeoutRate: 0.2, runs: 0.5 },
]);
