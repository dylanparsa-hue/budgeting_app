import { create } from 'zustand';
import { Debt } from '../types';
import { Storage, StorageKeys } from '../services/storage';
import * as api from '../services/api';

// ── Snake ↔ camel mappers (DB uses snake_case, client uses camelCase) ────────

function fromServer(row: any): Debt {
  return {
    id:           row.id,
    name:         row.name,
    lender:       row.lender,
    totalAmount:  Number(row.total_amount),
    amountPaid:   Number(row.amount_paid),
    dueDate:      row.due_date ?? null,
    interestRate: row.interest_rate != null ? Number(row.interest_rate) : null,
    notes:        row.notes ?? null,
    createdAt:    row.created_at,
  };
}

function toServer(data: Omit<Debt, 'id' | 'createdAt'>): Record<string, unknown> {
  return {
    name:          data.name,
    lender:        data.lender,
    total_amount:  data.totalAmount,
    amount_paid:   data.amountPaid,
    due_date:      data.dueDate || null,
    interest_rate: data.interestRate ?? null,
    notes:         data.notes || null,
  };
}

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

    // Try server first
    const { data, error } = await api.fetchDebts();
    if (data && !error) {
      const debts = (data as any[]).map(fromServer);
      set({ debts, loaded: true });
      await Storage.set(StorageKeys.DEBTS, debts);
    } else {
      // Fall back to local cache
      const saved = await Storage.get<Debt[]>(StorageKeys.DEBTS);
      set({ debts: saved ?? [], loaded: true });
    }
  },

  add: async (data) => {
    // Optimistic: add with temp id
    const tempDebt: Debt = {
      ...data,
      id: `temp_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set({ debts: [...get().debts, tempDebt] });

    const { data: serverData, error } = await api.createDebt(toServer(data));
    if (serverData && !error) {
      const created = fromServer(serverData);
      const debts = get().debts.map(d => d.id === tempDebt.id ? created : d);
      set({ debts });
      await Storage.set(StorageKeys.DEBTS, debts);
    } else {
      // Keep local version
      await Storage.set(StorageKeys.DEBTS, get().debts);
    }
  },

  edit: async (id, data) => {
    // Optimistic update
    const debts = get().debts.map(d =>
      d.id === id ? { ...d, ...data, id, createdAt: d.createdAt } : d
    );
    set({ debts });

    const { error } = await api.updateDebt(id, toServer(data));
    if (!error) {
      await Storage.set(StorageKeys.DEBTS, get().debts);
    }
  },

  remove: async (id) => {
    const prev = get().debts;
    const debts = prev.filter(d => d.id !== id);
    set({ debts });

    const { error } = await api.deleteDebt(id);
    if (error) {
      // Rollback on failure
      set({ debts: prev });
    } else {
      await Storage.set(StorageKeys.DEBTS, debts);
    }
  },

  pay: async (id, paymentAmount) => {
    const debt = get().debts.find(d => d.id === id);
    if (!debt) return;

    const newPaid = Math.min(debt.amountPaid + paymentAmount, debt.totalAmount);
    const debts = get().debts.map(d =>
      d.id === id ? { ...d, amountPaid: newPaid } : d
    );
    set({ debts });

    const { error } = await api.updateDebt(id, { amount_paid: newPaid });
    if (!error) {
      await Storage.set(StorageKeys.DEBTS, debts);
    }
  },
}));
