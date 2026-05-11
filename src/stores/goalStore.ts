import { create } from 'zustand';
import { SavingsGoal } from '../types';
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '../services/supabase';
import { Storage, StorageKeys } from '../services/storage';

interface GoalState {
  goals:          SavingsGoal[];
  isLoading:      boolean;

  loadGoals:       (userId: string) => Promise<void>;
  addGoal:         (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateGoal:      (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  depositToGoal:   (id: string, amount: number) => Promise<void>;
  withdrawFromGoal:(id: string, amount: number) => Promise<{ actual: number }>;
  removeGoal:      (id: string) => Promise<{ refundAmount: number }>;
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals:     [],
  isLoading: false,

  loadGoals: async (userId) => {
    set({ isLoading: true });
    const cached = await Storage.get<SavingsGoal[]>(StorageKeys.GOALS);
    if (cached) set({ goals: cached });

    try {
      const { data, error } = await fetchGoals(userId);
      if (!error && data) {
        set({ goals: data });
        await Storage.set(StorageKeys.GOALS, data);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  addGoal: async (data) => {
    const { data: created, error } = await createGoal(data);
    if (error) throw error;
    set(state => ({ goals: [created as SavingsGoal, ...state.goals] }));
    await Storage.set(StorageKeys.GOALS, get().goals);
  },

  updateGoal: async (id, data) => {
    const { data: updated, error } = await updateGoal(id, data);
    if (error) throw error;
    set(state => ({
      goals: state.goals.map(g => g.id === id ? { ...g, ...updated } : g),
    }));
    await Storage.set(StorageKeys.GOALS, get().goals);
  },

  depositToGoal: async (id, amount) => {
    const goal = get().goals.find(g => g.id === id);
    if (!goal) return;
    const newAmount   = Math.min(goal.current_amount + amount, goal.target_amount);
    const isCompleted = newAmount >= goal.target_amount;
    await get().updateGoal(id, { current_amount: newAmount, is_completed: isCompleted });
  },

  withdrawFromGoal: async (id, amount) => {
    const goal = get().goals.find(g => g.id === id);
    if (!goal) return { actual: 0 };
    // Can't withdraw more than what's saved
    const actual    = Math.min(amount, goal.current_amount);
    const newAmount = goal.current_amount - actual;
    await get().updateGoal(id, { current_amount: newAmount, is_completed: false });
    return { actual };
  },

  removeGoal: async (id) => {
    const goal = get().goals.find(g => g.id === id);
    const refundAmount = goal?.current_amount ?? 0;
    await deleteGoal(id);
    set(state => ({ goals: state.goals.filter(g => g.id !== id) }));
    await Storage.set(StorageKeys.GOALS, get().goals);
    return { refundAmount };
  },
}));
