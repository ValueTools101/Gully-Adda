import type { ExpoConfig } from 'expo/config';

/**
 * Package ID is permanent once uploaded to Play. Confirm before the first EAS build.
 * Override with APP_PACKAGE for experiments (never after release).
 */
const PACKAGE = process.env.APP_PACKAGE ?? 'com.valuetools101.gullyadda';
const VOICE_ENABLED = process.env.EXPO_PUBLIC_VOICE_ENABLED === 'true';

const config = (): ExpoConfig => ({
  name: 'Gully Adda',
  slug: 'gully-adda',
  owner: process.env.EXPO_OWNER || undefined,
  scheme: 'gullyadda',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#FFF4DC',
  android: {
    package: PACKAGE,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#FF9933',
    },
    // Voice (Mafia online) needs the microphone; the camera is never used.
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.VIBRATE'],
    blockedPermissions: ['android.permission.CAMERA', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
  },
  ios: {
    bundleIdentifier: PACKAGE,
    supportsTablet: false,
    infoPlist: {
      NSMicrophoneUsageDescription: 'Gully Adda uses the microphone only for optional voice chat in online Mafia rooms.',
    },
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    ['expo-audio', { microphonePermission: 'Gully Adda uses the microphone only for optional voice chat in online Mafia rooms.' }],
    [
      'expo-splash-screen',
      { image: './assets/images/splash.png', imageWidth: 220, resizeMode: 'contain', backgroundColor: '#FFF4DC' },
    ],
    [
      'expo-build-properties',
      {
        // Google Play requires new apps and updates to target a recent API level. See store/RELEASE_CHECKLIST.md.
        android: { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 24 },
      },
    ],
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
  ],
  extra: {
    voiceEnabled: VOICE_ENABLED,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});

export default config;
