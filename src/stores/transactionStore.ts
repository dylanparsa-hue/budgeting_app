import { create } from 'zustand';
import { Transaction, Category, MonthlyStats } from '../types';
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  fetchCategories,
  createCategory,
  deleteCategory,
} from '../services/supabase';
import { Storage, StorageKeys } from '../services/storage';

interface TransactionState {
  transactions:  Transaction[];
  categories:    Category[];
  isLoading:     boolean;
  isSyncing:     boolean;
  lastSyncAt:    number | null;

  // Actions
  loadFromCache:    (userId: string) => Promise<void>;
  syncFromServer:   (userId: string) => Promise<void>;
  addTransaction:   (userId: string, data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editTransaction:  (id: string, data: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  removeTransaction:(id: string) => Promise<void>;
  loadCategories:   (userId: string) => Promise<void>;
  addCategory:      (data: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
  removeCategory:   (id: string) => Promise<void>;

  // Computed helpers
  getMonthlyStats:  (month: number, year: number) => MonthlyStats;
  getRecentTransactions: (count: number) => Transaction[];
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  categories:   [],
  isLoading:    false,
  isSyncing:    false,
  lastSyncAt:   null,

  loadFromCache: async (userId) => {
    const cached = await Storage.get<Transaction[]>(StorageKeys.TRANSACTIONS);
    if (cached) set({ transactions: cached });
    const cachedCats = await Storage.get<Category[]>(StorageKeys.CATEGORIES);
    if (cachedCats) set({ categories: cachedCats });
  },

  syncFromServer: async (userId) => {
    set({ isSyncing: true });
    try {
      const [txResult, catResult] = await Promise.all([
        fetchTransactions(userId),
        fetchCategories(userId),
      ]);
      const transactions = txResult.data ?? [];
      const categories   = catResult.data ?? [];
      set({ transactions, categories, lastSyncAt: Date.now() });
      await Storage.set(StorageKeys.TRANSACTIONS, transactions);
      await Storage.set(StorageKeys.CATEGORIES,   categories);
    } catch {
      // Server fetch failed — keep cached data
    } finally {
      set({ isSyncing: false });
    }
  },

  addTransaction: async (userId, data) => {
    const optimistic: Transaction = {
      ...data,
      id:         `local_${Date.now()}`,
      user_id:    userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    set(state => ({ transactions: [optimistic, ...state.transactions] }));

    try {
      const { data: created, error } = await createTransaction({ ...data, user_id: userId });
      if (error) throw error;

      // Replace optimistic with real
      set(state => ({
        transactions: state.transactions.map(t =>
          t.id === optimistic.id ? (created as Transaction) : t
        ),
      }));

      // Update cache
      const { transactions } = get();
      await Storage.set(StorageKeys.TRANSACTIONS, transactions);
    } catch (err: any) {
      // Rollback optimistic on failure
      set(state => ({
        transactions: state.transactions.filter(t => t.id !== optimistic.id),
      }));
      throw new Error(err?.message ?? 'Failed to save transaction.');
    }
  },

  editTransaction: async (id, data) => {
    const previous = get().transactions;
    set(state => ({
      transactions: state.transactions.map(t =>
        t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t
      ),
    }));
    try {
      await updateTransaction(id, data);
      await Storage.set(StorageKeys.TRANSACTIONS, get().transactions);
    } catch (err: any) {
      set({ transactions: previous });
      throw new Error(err?.message ?? 'Failed to update transaction.');
    }
  },

  removeTransaction: async (id) => {
    const previous = get().transactions;
    set(state => ({ transactions: state.transactions.filter(t => t.id !== id) }));
    try {
      await deleteTransaction(id);
      await Storage.set(StorageKeys.TRANSACTIONS, get().transactions);
    } catch {
      set({ transactions: previous });
    }
  },

  loadCategories: async (userId) => {
    const { data } = await fetchCategories(userId);
    if (data) {
      set({ categories: data });
      await Storage.set(StorageKeys.CATEGORIES, data);
    }
  },

  addCategory: async (data) => {
    const { data: created, error } = await createCategory(data);
    if (error) throw error;
    set(state => ({ categories: [...state.categories, created as Category] }));
    await Storage.set(StorageKeys.CATEGORIES, get().categories);
  },

  removeCategory: async (id) => {
    await deleteCategory(id);
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }));
    await Storage.set(StorageKeys.CATEGORIES, get().categories);
  },

  getMonthlyStats: (month, year) => {
    const { transactions, categories } = get();
    const filtered = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const totalIncome   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance       = totalIncome - totalExpenses;
    const savingsRate   = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    const expensesByCat = new Map<string, number>();
    filtered.filter(t => t.type === 'expense').forEach(t => {
      if (t.category_id) {
        expensesByCat.set(t.category_id, (expensesByCat.get(t.category_id) ?? 0) + t.amount);
      }
    });

    const byCategory = Array.from(expensesByCat.entries())
      .map(([catId, amount]) => ({
        category:   categories.find(c => c.id === catId) ?? { id: catId, name: 'Other', icon: '📦', color: '#6B7280' } as Category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { totalIncome, totalExpenses, balance, savingsRate, byCategory };
  },

  getRecentTransactions: (count) =>
    get().transactions.slice(0, count),
}));
