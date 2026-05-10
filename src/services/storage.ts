import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@budget:';

export const Storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // silently fail — offline cache is best-effort
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const budgetKeys = keys.filter(k => k.startsWith(PREFIX));
      await AsyncStorage.multiRemove(budgetKeys);
    } catch {}
  },
};

// Well-known storage keys
export const StorageKeys = {
  TRANSACTIONS:  'transactions',
  BUDGETS:       'budgets',
  GOALS:         'goals',
  CATEGORIES:    'categories',
  GROUPS:        'groups',
  WALLET:        'active_wallet',
  ONBOARDED:     'onboarded',
  LAST_SYNC:     'last_sync',
} as const;
