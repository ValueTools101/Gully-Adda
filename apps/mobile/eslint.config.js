const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist-web/*', 'scripts/*', '.expo/*'] },
  { rules: { 'react/no-unescaped-entities': 'off' } },
]);
