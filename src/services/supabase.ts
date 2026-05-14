import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl      = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});

// ─── Auth helpers ──────────────────────────────────────────────────────────────

export const signUp = (email: string, password: string, fullName: string) =>
  supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

// ─── Profile ──────────────────────────────────────────────────────────────────

export const fetchProfile = (userId: string) =>
  supabase.from('profiles').select('*').eq('id', userId).single();

export const updateProfile = (userId: string, updates: Record<string, unknown>) =>
  supabase.from('profiles').update(updates).eq('id', userId);

// ─── Categories ───────────────────────────────────────────────────────────────

export const fetchCategories = (userId: string) =>
  supabase
    .from('categories')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('sort_order', { ascending: true });

export const createCategory = (data: Record<string, unknown>) =>
  supabase.from('categories').insert(data).select().single();

export const updateCategory = (id: string, data: Record<string, unknown>) =>
  supabase.from('categories').update(data).eq('id', id).select().single();

export const deleteCategory = (id: string) =>
  supabase.from('categories').delete().eq('id', id);

// ─── Transactions ─────────────────────────────────────────────────────────────

export const fetchTransactions = (userId: string, limit = 100) =>
  supabase
    .from('transactions')
    .select('*, category:categories(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

export const fetchGroupTransactions = (groupId: string, limit = 100) =>
  supabase
    .from('transactions')
    .select('*, category:categories(*)')
    .eq('group_id', groupId)
    .order('date', { ascending: false })
    .limit(limit);

export const createTransaction = (data: Record<string, unknown>) =>
  supabase.from('transactions').insert(data).select('*, category:categories(*)').single();

export const updateTransaction = (id: string, data: Record<string, unknown>) =>
  supabase.from('transactions').update(data).eq('id', id).select().single();

export const deleteTransaction = (id: string) =>
  supabase.from('transactions').delete().eq('id', id);

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const fetchBudgets = (userId: string, month: number, year: number) =>
  supabase
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year);

export const upsertBudget = (data: Record<string, unknown>) =>
  supabase.from('budgets').upsert(data).select().single();

export const deleteBudget = (id: string) =>
  supabase.from('budgets').delete().eq('id', id);

// ─── Savings Goals ────────────────────────────────────────────────────────────

export const fetchGoals = (userId: string) =>
  supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

export const createGoal = (data: Record<string, unknown>) =>
  supabase.from('savings_goals').insert(data).select().single();

export const updateGoal = (id: string, data: Record<string, unknown>) =>
  supabase.from('savings_goals').update(data).eq('id', id).select().single();

export const deleteGoal = (id: string) =>
  supabase.from('savings_goals').delete().eq('id', id);

// ─── Family Groups ────────────────────────────────────────────────────────────

export const fetchUserGroups = (userId: string) =>
  supabase
    .from('family_groups')
    .select('*, members:group_members(*, profile:profiles(*))')
    .or(
      `created_by.eq.${userId},id.in.(${
        supabase.from('group_members').select('group_id').eq('user_id', userId)
      })`
    );

export const createGroup = (data: Record<string, unknown>) =>
  supabase.from('family_groups').insert(data).select().single();

export const joinGroupByCode = (inviteCode: string, userId: string) =>
  supabase.rpc('join_group_by_invite_code', { p_invite_code: inviteCode, p_user_id: userId });
