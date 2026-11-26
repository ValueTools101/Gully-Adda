import { simSuite } from './run';

simSuite('mafia', [
  { sizes: [5, 6, 8, 10, 12], runs: 0.6 },
  { sizes: [5, 9, 12], timeoutRate: 0.15, runs: 0.4 },
  { sizes: [7], config: () => ({ mafiaCount: 3, doctor: false, detective: true }), runs: 0.3 },
]);
