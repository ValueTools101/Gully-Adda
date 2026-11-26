import { simSuite } from './run';

simSuite('rmcs', [{ sizes: [4], runs: 2 }, { sizes: [4], config: () => ({ rounds: 3, revealSeconds: 5, guessSeconds: 10 }), timeoutRate: 0.3 }]);
