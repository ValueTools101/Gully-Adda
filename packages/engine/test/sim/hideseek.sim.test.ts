import { simSuite } from './run';

// Each bot move plays a full real-time round, so fewer games here; the sim itself is covered in hideseek.test.ts.
simSuite('hideseek', [
  { sizes: [1, 3, 6], config: () => ({ rounds: 2, roundSeconds: 20 }), runs: 0.02 },
  { sizes: [4], config: () => ({ rounds: 2, roundSeconds: 20, submitGraceSeconds: 30 }), timeoutRate: 0.2, runs: 0.02 },
]);
