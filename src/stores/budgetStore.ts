import { create } from 'zustand';
import { Budget } from '../types';
import { fetchBudgets, upsertBudget, deleteBudget } from '../services/supabase';
import { Storage, StorageKeys } from '../services/storage';

interface BudgetState {
  budgets:    Budget[];
  isLoading:  boolean;

  loadBudgets:   (userId: string, month: number, year: number) => Promise<void>;
  saveBudget:    (data: Omit<Budget, 'id' | 'created_at' | 'updated_at'> & { user_id: string }) => Promise<void>;
  removeBudget:  (id: string) => Promise<void>;
  getBudgetWithSpend: (budgetId: string, spent: number) => Budget | undefined;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets:   [],
  isLoading: false,

  loadBudgets: async (userId, month, year) => {
    set({ isLoading: true });
    // Load cache first
    const cached = await Storage.get<Budget[]>(StorageKeys.BUDGETS);
    if (cached) set({ budgets: cached });

    try {
      const { data, error } = await fetchBudgets(userId, month, year);
      if (!error && data) {
        set({ budgets: data });
        await Storage.set(StorageKeys.BUDGETS, data);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  saveBudget: async (data) => {
    const { data: saved, error } = await upsertBudget(data);
    if (error) throw error;

    set(state => {
      const exists = state.budgets.find(b => b.id === (saved as Budget).id);
      return {
        budgets: exists
          ? state.budgets.map(b => b.id === (saved as Budget).id ? (saved as Budget) : b)
          : [...state.budgets, saved as Budget],
      };
    });
    await Storage.set(StorageKeys.BUDGETS, get().budgets);
  },

  removeBudget: async (id) => {
    await deleteBudget(id);
    set(state => ({ budgets: state.budgets.filter(b => b.id !== id) }));
    await Storage.set(StorageKeys.BUDGETS, get().budgets);
  },

  getBudgetWithSpend: (budgetId, spent) => {
    const budget = get().budgets.find(b => b.id === budgetId);
    return budget ? { ...budget, spent } : undefined;
  },
}));
