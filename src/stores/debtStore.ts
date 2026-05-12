import { create } from 'zustand';
import { Debt } from '../types';
import { Storage, StorageKeys } from '../services/storage';

interface DebtStore {
  debts:   Debt[];
  loaded:  boolean;
  load:    () => Promise<void>;
  add:     (data: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>;
  edit:    (id: string, data: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>;
  remove:  (id: string) => Promise<void>;
  pay:     (id: string, paymentAmount: number) => Promise<void>;
}

export const useDebtStore = create<DebtStore>((set, get) => ({
  debts:  [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    const saved = await Storage.get<Debt[]>(StorageKeys.DEBTS);
    set({ debts: saved ?? [], loaded: true });
  },

  add: async (data) => {
    const debt: Debt = {
      ...data,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const debts = [...get().debts, debt];
    set({ debts });
    await Storage.set(StorageKeys.DEBTS, debts);
  },

  edit: async (id, data) => {
    const debts = get().debts.map(d =>
      d.id === id ? { ...d, ...data, id, createdAt: d.createdAt } : d
    );
    set({ debts });
    await Storage.set(StorageKeys.DEBTS, debts);
  },

  remove: async (id) => {
    const debts = get().debts.filter(d => d.id !== id);
    set({ debts });
    await Storage.set(StorageKeys.DEBTS, debts);
  },

  pay: async (id, paymentAmount) => {
    const debts = get().debts.map(d => {
      if (d.id !== id) return d;
      const newPaid = Math.min(d.amountPaid + paymentAmount, d.totalAmount);
      return { ...d, amountPaid: newPaid };
    });
    set({ debts });
    await Storage.set(StorageKeys.DEBTS, debts);
  },
}));
