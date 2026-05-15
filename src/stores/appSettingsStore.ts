/**
 * App-level settings that persist locally (AsyncStorage).
 * Not synced to Supabase — device-specific preferences.
 */

import { create } from 'zustand';
import { Storage, StorageKeys } from '../services/storage';
import { setAppLanguage, type LanguageCode } from '../i18n';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppSettingsState {
  /** ISO date string (YYYY-MM-DD) of the first month the user started tracking.
   *  null = not set, use all available data. */
  trackingStartDate:    string | null;
  /** Whether budget / spending alerts are enabled. Default true. */
  notificationsEnabled: boolean;
  /** Theme preference: 'light' | 'dark' | 'system'. Default 'system'. */
  themeMode:            ThemeMode;
  /** Active UI language. Default 'en'. */
  language:             LanguageCode;
  isLoaded: boolean;

  load:                    () => Promise<void>;
  setTrackingStartDate:    (date: string | null) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setThemeMode:            (mode: ThemeMode) => Promise<void>;
  setLanguage:             (lang: LanguageCode) => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  trackingStartDate:    null,
  notificationsEnabled: true,
  themeMode:            'system',
  language:             'en',
  isLoaded: false,

  load: async () => {
    const startDate  = await Storage.get<string>(StorageKeys.APP_START_DATE);
    const notifs     = await Storage.get<boolean>('notifications_enabled');
    const themeMode  = await Storage.get<ThemeMode>('theme_mode');
    const language   = await Storage.get<LanguageCode>('app_language');

    const resolvedLang = language ?? 'en';
    setAppLanguage(resolvedLang);

    set({
      trackingStartDate:    startDate ?? null,
      notificationsEnabled: notifs ?? true,
      themeMode:            themeMode ?? 'system',
      language:             resolvedLang,
      isLoaded: true,
    });
  },

  setTrackingStartDate: async (date) => {
    set({ trackingStartDate: date });
    if (date) {
      await Storage.set(StorageKeys.APP_START_DATE, date);
    } else {
      await Storage.remove(StorageKeys.APP_START_DATE);
    }
  },

  setNotificationsEnabled: async (enabled) => {
    set({ notificationsEnabled: enabled });
    await Storage.set('notifications_enabled', enabled);
  },

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    await Storage.set('theme_mode', mode);
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    await Storage.set('app_language', lang);
    setAppLanguage(lang);
  },
}));
