// Bundles src (and @gully/engine) into lib/index.js. Firebase SDKs stay external
// and are installed by Cloud Build from package.json "dependencies".
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'lib/index.js',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions', 'livekit-server-sdk'],
  logLevel: 'info',
});
