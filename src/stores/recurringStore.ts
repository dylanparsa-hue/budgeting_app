import { create } from 'zustand';
import { RecurringExpense } from '../types';
import { Storage, StorageKeys } from '../services/storage';
import * as api from '../services/api';

// ── Snake ↔ camel mappers ────────────────────────────────────────────────────

function fromServer(row: any): RecurringExpense {
  return {
    id:               row.id,
    name:             row.name,
    amount:           Number(row.amount),
    category:         row.category,
    frequency:        row.frequency,
    deductFromIncome: row.deduct_from_income ?? false,
    nextDueDate:      row.next_due_date ?? null,
  };
}

function toServer(data: Omit<RecurringExpense, 'id'>): Record<string, unknown> {
  return {
    name:               data.name,
    amount:             data.amount,
    category:           data.category,
    frequency:          data.frequency,
    deduct_from_income: data.deductFromIncome,
    next_due_date:      data.nextDueDate || null,
  };
}

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

    // Try server first
    const { data, error } = await api.fetchRecurring();
    if (data && !error) {
      const items = (data as any[]).map(fromServer);
      set({ items, loaded: true });
      await Storage.set(StorageKeys.RECURRING, items);
    } else {
      // Fall back to local cache
      const saved = await Storage.get<RecurringExpense[]>(StorageKeys.RECURRING);
      const items = (saved ?? []).map(i =>
        i.deductFromIncome !== undefined ? i : { ...i, deductFromIncome: false }
      );
      set({ items, loaded: true });
    }
  },

  add: async (data) => {
    // Optimistic: add with temp id
    const tempItem: RecurringExpense = { ...data, id: `temp_${Date.now()}` };
    set({ items: [...get().items, tempItem] });

    const { data: serverData, error } = await api.createRecurring(toServer(data));
    if (serverData && !error) {
      const created = fromServer(serverData);
      const items = get().items.map(i => i.id === tempItem.id ? created : i);
      set({ items });
      await Storage.set(StorageKeys.RECURRING, items);
    } else {
      await Storage.set(StorageKeys.RECURRING, get().items);
    }
  },

  edit: async (id, data) => {
    const items = get().items.map(i => i.id === id ? { ...i, ...data, id } : i);
    set({ items });

    const { error } = await api.updateRecurring(id, toServer(data));
    if (!error) {
      await Storage.set(StorageKeys.RECURRING, get().items);
    }
  },

  remove: async (id) => {
    const prev = get().items;
    const items = prev.filter(i => i.id !== id);
    set({ items });

    const { error } = await api.deleteRecurring(id);
    if (error) {
      set({ items: prev });
    } else {
      await Storage.set(StorageKeys.RECURRING, items);
    }
  },

  toggleDeduct: async (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;
    const newValue = !item.deductFromIncome;

    const items = get().items.map(i =>
      i.id === id ? { ...i, deductFromIncome: newValue } : i
    );
    set({ items });

    const { error } = await api.updateRecurring(id, { deduct_from_income: newValue });
    if (!error) {
      await Storage.set(StorageKeys.RECURRING, items);
    }
  },

  setDeduct: async (id, value) => {
    const items = get().items.map(i =>
      i.id === id ? { ...i, deductFromIncome: value } : i
    );
    set({ items });

    const { error } = await api.updateRecurring(id, { deduct_from_income: value });
    if (!error) {
      await Storage.set(StorageKeys.RECURRING, items);
    }
  },
}));
