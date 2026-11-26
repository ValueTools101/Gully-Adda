// Expo's default Metro config already supports npm workspaces (monorepo).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = config;
