import { simSuite } from './run';

simSuite('ludo', [
  { sizes: [2, 3, 4], runs: 0.7 },
  { sizes: [2, 4], config: () => ({ finishAll: true, turnSeconds: 15 }), timeoutRate: 0.03, runs: 0.3 },
]);
