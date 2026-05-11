import { create } from 'zustand';
import { RecurringExpense } from '../types';
import { Storage, StorageKeys } from '../services/storage';

interface RecurringStore {
  items:        RecurringExpense[];
  loaded:       boolean;
  load:         () => Promise<void>;
  add:          (item: Omit<RecurringExpense, 'id'>) => Promise<void>;
  edit:         (id: string, data: Omit<RecurringExpense, 'id'>) => Promise<void>;
  remove:       (id: string) => Promise<void>;
  toggleDeduct: (id: string) => Promise<void>;
  setDeduct:    (id: string, value: boolean) => Promise<void>;
}

export const useRecurringStore = create<RecurringStore>((set, get) => ({
  items:  [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    const saved = await Storage.get<RecurringExpense[]>(StorageKeys.RECURRING);
    // backfill deductFromIncome for items saved before this field existed
    const items = (saved ?? []).map(i => (i.deductFromIncome !== undefined ? i : { ...i, deductFromIncome: false }));
    set({ items, loaded: true });
  },

  add: async (data) => {
    const item: RecurringExpense = { ...data, id: Date.now().toString() };
    const items = [...get().items, item];
    set({ items });
    await Storage.set(StorageKeys.RECURRING, items);
  },

  edit: async (id, data) => {
    const items = get().items.map(i => i.id === id ? { ...i, ...data, id } : i);
    set({ items });
    await Storage.set(StorageKeys.RECURRING, items);
  },

  remove: async (id) => {
    const items = get().items.filter(i => i.id !== id);
    set({ items });
    await Storage.set(StorageKeys.RECURRING, items);
  },

  toggleDeduct: async (id) => {
    const items = get().items.map(i => i.id === id ? { ...i, deductFromIncome: !i.deductFromIncome } : i);
    set({ items });
    await Storage.set(StorageKeys.RECURRING, items);
  },

  setDeduct: async (id, value) => {
    const items = get().items.map(i => i.id === id ? { ...i, deductFromIncome: value } : i);
    set({ items });
    await Storage.set(StorageKeys.RECURRING, items);
  },
}));
