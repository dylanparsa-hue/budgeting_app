/**
 * App-level settings that persist locally (AsyncStorage).
 * Not synced to Supabase — device-specific preferences.
 */

import { create } from 'zustand';
import { Storage, StorageKeys } from '../services/storage';

interface AppSettingsState {
  /** ISO date string (YYYY-MM-DD) of the first month the user started tracking.
   *  null = not set, use all available data. */
  trackingStartDate:    string | null;
  /** Whether budget / spending alerts are enabled. Default true. */
  notificationsEnabled: boolean;
  isLoaded: boolean;

  load:                  () => Promise<void>;
  setTrackingStartDate:  (date: string | null) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  trackingStartDate:    null,
  notificationsEnabled: true,
  isLoaded: false,

  load: async () => {
    const startDate = await Storage.get<string>(StorageKeys.APP_START_DATE);
    const notifs    = await Storage.get<boolean>('notifications_enabled');
    set({
      trackingStartDate:    startDate ?? null,
      notificationsEnabled: notifs ?? true,
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
}));
