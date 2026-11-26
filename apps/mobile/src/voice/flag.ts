import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Voice is optional: feature-flagged, native builds only (needs an EAS dev/production build, not Expo Go). */
export const VOICE_FLAG = Platform.OS !== 'web' && (Constants.expoConfig?.extra as { voiceEnabled?: boolean } | undefined)?.voiceEnabled === true;
