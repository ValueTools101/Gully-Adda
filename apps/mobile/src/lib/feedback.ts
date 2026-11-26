/** Sound effects + haptics, both respecting the user's settings. */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { currentSettings } from './settings';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  dice: require('../../assets/sounds/dice.wav'),
  move: require('../../assets/sounds/move.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  box: require('../../assets/sounds/box.wav'),
  phase: require('../../assets/sounds/phase.wav'),
  reveal: require('../../assets/sounds/reveal.wav'),
  stop: require('../../assets/sounds/stop.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  tick: require('../../assets/sounds/tick.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

export function playSound(name: SoundName): void {
  if (!currentSettings().sound) return;
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
    }
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players.set(name, p);
    }
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Sound is decoration only; never crash a game over it.
  }
}

export type HapticKind = 'tap' | 'success' | 'warning' | 'heavy';

export function haptic(kind: HapticKind = 'tap'): void {
  if (!currentSettings().haptics || Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    else if (kind === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // ignore
  }
}

export function feedback(sound: SoundName, kind: HapticKind = 'tap'): void {
  playSound(sound);
  haptic(kind);
}
