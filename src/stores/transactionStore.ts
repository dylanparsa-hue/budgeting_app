import { create } from 'zustand';
import { Transaction, Category, MonthlyStats } from '../types';
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/api';
import { Storage, StorageKeys } from '../services/storage';
import { getBudgetMonthKey, getExpenseBudgetContributions } from '../utils/budgetMonth';

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
  editCategory:     (id: string, data: Partial<Omit<Category, 'id' | 'created_at'>>) => Promise<void>;
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
    if (cached) {
      // Coerce amounts from strings (stale cache from before the NUMERIC fix)
      const fixed = cached.map(t => ({ ...t, amount: Number(t.amount) || 0 }));
      set({ transactions: fixed });
    }
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
      let   categories   = catResult.data ?? [];

      // ── Seed default categories the first time a user logs in ────────────────
      // If the user has zero personal categories (only system ones or none at all),
      // create a standard set so the form is immediately useful.
      // Only seed if there are zero categories of any kind (global or personal).
      // fetchCategories already returns both, so categories.length === 0 means
      // the database is truly empty — not just missing personal ones.
      const hasPersonal = categories.some(c => c.user_id === userId);
      if (!hasPersonal && categories.length === 0) {
        const defaults: Omit<Category, 'id' | 'created_at'>[] = [
          { user_id: userId, name: 'Housing & Rent', icon: 'housing',       color: '#6366F1', type: 'expense', is_default: true, sort_order: 10 },
          { user_id: userId, name: 'Food & Dining',  icon: 'food',          color: '#F59E0B', type: 'expense', is_default: true, sort_order: 20 },
          { user_id: userId, name: 'Transport',      icon: 'transport',     color: '#3B82F6', type: 'expense', is_default: true, sort_order: 30 },
          { user_id: userId, name: 'Utilities',      icon: 'utilities',     color: '#EAB308', type: 'expense', is_default: true, sort_order: 40 },
          { user_id: userId, name: 'Entertainment',  icon: 'entertainment', color: '#EC4899', type: 'expense', is_default: true, sort_order: 50 },
          { user_id: userId, name: 'Healthcare',     icon: 'healthcare',    color: '#10B981', type: 'expense', is_default: true, sort_order: 60 },
          { user_id: userId, name: 'Shopping',       icon: 'shopping',      color: '#F97316', type: 'expense', is_default: true, sort_order: 70 },
          { user_id: userId, name: 'Education',      icon: 'education',     color: '#8B5CF6', type: 'expense', is_default: true, sort_order: 80 },
          { user_id: userId, name: 'Salary',         icon: 'salary',        color: '#10B981', type: 'income',  is_default: true, sort_order: 90 },
          { user_id: userId, name: 'Freelance',      icon: 'freelance',     color: '#3B82F6', type: 'income',  is_default: true, sort_order: 100 },
          { user_id: userId, name: 'Investment',     icon: 'investment',    color: '#6366F1', type: 'income',  is_default: true, sort_order: 110 },
          { user_id: userId, name: 'Other',          icon: 'other',         color: '#6B7280', type: 'both',    is_default: true, sort_order: 120 },
        ];
        await Promise.all(defaults.map(d => createCategory(d)));
        // Re-fetch so we have the real IDs
        const fresh = await fetchCategories(userId);
        categories = fresh.data ?? categories;
      }

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

  editCategory: async (id, data) => {
    const { data: updated, error } = await updateCategory(id, data as Record<string, unknown>);
    if (error) throw error;
    set(state => ({ categories: state.categories.map(c => c.id === id ? { ...c, ...(updated as Category) } : c) }));
    await Storage.set(StorageKeys.CATEGORIES, get().categories);
  },

  removeCategory: async (id) => {
    await deleteCategory(id);
    set(state => ({ categories: state.categories.filter(c => c.id !== id) }));
    await Storage.set(StorageKeys.CATEGORIES, get().categories);
  },

  getMonthlyStats: (month, year) => {
    const { transactions, categories } = get();
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    // Income: use budget_month tag (or date) so early-received salary counts for
    // the month the user assigned it to.
    const incomeFiltered = transactions.filter(
      t => t.type === 'income' && getBudgetMonthKey(t) === monthKey
    );

    // Expenses: use getExpenseBudgetContributions so that:
    //   - obligation_month tags route pre-paid obligations to the right month
    //   - budget_split tags split over-budget expenses across months without
    //     ever making a single month's balance go negative
    const expensePortions: { category_id: string | null; amount: number }[] = [];
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const portion = getExpenseBudgetContributions(t)[monthKey] ?? 0;
      if (portion > 0) expensePortions.push({ category_id: t.category_id ?? null, amount: portion });
    }

    const totalIncome   = incomeFiltered.reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = expensePortions.reduce((s, e) => s + Number(e.amount), 0);
    const balance       = totalIncome - totalExpenses;
    const savingsRate   = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    const expensesByCat = new Map<string, number>();
    expensePortions.forEach(({ category_id, amount }) => {
      if (category_id) {
        expensesByCat.set(category_id, (expensesByCat.get(category_id) ?? 0) + amount);
      }
    });

    const byCategory = Array.from(expensesByCat.entries())
      .map(([catId, amount]) => ({
        category:   categories.find(c => c.id === catId) ?? { id: catId, name: 'Other', icon: 'other', color: '#6B7280' } as Category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { totalIncome, totalExpenses, balance, savingsRate, byCategory };
  },

  getRecentTransactions: (count) =>
    get().transactions.slice(0, count),
}));
