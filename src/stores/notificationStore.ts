import { create } from 'zustand';
import { NotificationPrefs, SmartInsight } from '../types';
import { Storage, StorageKeys } from '../services/storage';

// ── Default preferences ──────────────────────────────────────────────────────
export const DEFAULT_PREFS: NotificationPrefs = {
  financialAwareness: {
    enabled:                true,
    spendingHabits:         true,
    unusualSpending:        true,
    largePurchase:          true,
    largePurchaseThreshold: 200,
  },
  budgetControl: {
    enabled:        true,
    warningAt:      80,
    categoryAlerts: true,
  },
  accountProtection: {
    enabled:             true,
    lowBalance:          true,
    lowBalanceThreshold: 100,
    overdraftRisk:       true,
    billReminders:       true,
  },
  motivation: {
    enabled:               true,
    goalProgress:          true,
    monthlyComparison:     true,
    positiveReinforcement: true,
  },
  pushEnabled: false, // requires expo-notifications install
};

interface NotificationState {
  prefs:        NotificationPrefs;
  insights:     SmartInsight[];
  dismissedIds: Set<string>;
  loaded:       boolean;

  load:            () => Promise<void>;
  updatePrefs:     (patch: Partial<NotificationPrefs>) => Promise<void>;
  updateCategory:  <K extends keyof NotificationPrefs>(
    category: K,
    patch: Partial<NotificationPrefs[K]>
  ) => Promise<void>;
  setInsights:     (insights: SmartInsight[]) => void;
  dismiss:         (id: string) => Promise<void>;
  clearDismissed:  () => Promise<void>;
  resetPrefs:      () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  prefs:        DEFAULT_PREFS,
  insights:     [],
  dismissedIds: new Set<string>(),
  loaded:       false,

  load: async () => {
    if (get().loaded) return;
    const [savedPrefs, savedDismissed] = await Promise.all([
      Storage.get<NotificationPrefs>(StorageKeys.NOTIF_PREFS),
      Storage.get<string[]>(StorageKeys.DISMISSED_IDS),
    ]);
    set({
      prefs:        savedPrefs ? { ...DEFAULT_PREFS, ...savedPrefs } : DEFAULT_PREFS,
      dismissedIds: new Set(savedDismissed ?? []),
      loaded:       true,
    });
  },

  updatePrefs: async (patch) => {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    await Storage.set(StorageKeys.NOTIF_PREFS, prefs);
  },

  updateCategory: async (category, patch) => {
    const prefs = {
      ...get().prefs,
      [category]: { ...get().prefs[category], ...patch },
    };
    set({ prefs });
    await Storage.set(StorageKeys.NOTIF_PREFS, prefs);
  },

  setInsights: (insights) => {
    const { dismissedIds } = get();
    set({ insights: insights.filter(i => !dismissedIds.has(i.id)) });
  },

  dismiss: async (id) => {
    const dismissedIds = new Set(get().dismissedIds);
    dismissedIds.add(id);
    set({
      dismissedIds,
      insights: get().insights.filter(i => i.id !== id),
    });
    await Storage.set(StorageKeys.DISMISSED_IDS, Array.from(dismissedIds));
  },

  clearDismissed: async () => {
    set({ dismissedIds: new Set() });
    await Storage.remove(StorageKeys.DISMISSED_IDS);
  },

  resetPrefs: async () => {
    set({ prefs: DEFAULT_PREFS });
    await Storage.set(StorageKeys.NOTIF_PREFS, DEFAULT_PREFS);
  },
}));
