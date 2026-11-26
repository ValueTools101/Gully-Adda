import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The engine must stay pure: no UI, no backend, no clock, no global randomness.
      'no-restricted-imports': ['error', { patterns: ['react', 'react-*', 'firebase', 'firebase-*', '@firebase/*', 'expo*'] }],
      'no-restricted-properties': ['error', { object: 'Date', property: 'now', message: 'Pass ctx.now instead.' }],
      'no-control-regex': 'off',
    },
  },
  { files: ['src/**/*.ts'], rules: { 'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the seeded Rng.' }, { object: 'Date', property: 'now', message: 'Pass ctx.now instead.' }] } },
  { files: ['src/core/rng.ts'], rules: { 'no-restricted-properties': 'off' } },
);
