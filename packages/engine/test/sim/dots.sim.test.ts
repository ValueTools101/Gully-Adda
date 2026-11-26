import { simSuite } from './run';

simSuite('dots', [
  { sizes: [2, 3, 4], config: () => ({ size: 4 }) },
  { sizes: [2, 4], config: () => ({ size: 5, turnSeconds: 10 }), timeoutRate: 0.05, runs: 0.5 },
]);
