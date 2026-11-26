import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  displayName: string;
  /** Online players this device has blocked (uid -> name). */
  blocked: Record<string, string>;
}

const KEY = 'gully-adda/settings/v1';
const DEFAULTS: Settings = { sound: true, haptics: true, displayName: '', blocked: {} };

interface Ctx {
  settings: Settings;
  ready: boolean;
  update(patch: Partial<Settings>): void;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULTS, ready: false, update: () => {} });

let snapshot: Settings = DEFAULTS;
/** Non-React access (sound/haptics helpers). */
export function currentSettings(): Settings {
  return snapshot;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
          snapshot = parsed;
          setSettings(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      snapshot = next;
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  return useContext(SettingsContext);
}
