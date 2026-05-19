import { create } from 'zustand';
import { Profile } from '../types';
import {
  getSession,
  onAuthStateChange,
  fetchProfile,
  signIn,
  signOut,
  signUp,
  updateProfile,
} from '../services/api';
import { Storage, StorageKeys } from '../services/storage';

// ── Local types replacing Supabase SDK types ────────────────────────────────

interface Session {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface User {
  id: string;
  email: string;
  user_metadata: { full_name?: string };
}

interface AuthState {
  session:     Session | null;
  user:        User | null;
  profile:     Profile | null;
  isLoading:   boolean;
  isHydrated:  boolean;

  initialize:     () => Promise<void>;
  login:          (email: string, password: string) => Promise<void>;
  register:       (email: string, password: string, fullName: string) => Promise<void>;
  logout:         () => Promise<void>;
  setProfile:     (profile: Profile) => void;
  saveProfile:    (updates: Partial<Pick<Profile, 'full_name' | 'currency'>>) => Promise<void>;
}

async function loadUserData(userId: string) {
  // Dynamically import stores to avoid circular deps
  const { useTransactionStore } = await import('./transactionStore');
  const { useBudgetStore }      = await import('./budgetStore');
  const { useGoalStore }        = await import('./goalStore');
  const now = new Date();
  await Promise.all([
    useTransactionStore.getState().syncFromServer(userId),
    useBudgetStore.getState().loadBudgets(userId, now.getMonth() + 1, now.getFullYear()),
    useGoalStore.getState().loadGoals(userId),
  ]);
}

export const useAuthStore = create<AuthState>((set) => ({
  session:    null,
  user:       null,
  profile:    null,
  isLoading:  false,
  isHydrated: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { data } = await getSession();
      const session = data?.session as Session | null;
      if (session?.user) {
        const { data: profile } = await fetchProfile(session.user.id);
        set({ session, user: session.user, profile: profile ?? null });
        loadUserData(session.user.id); // non-blocking
      }

      onAuthStateChange(async (event, sessionData) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Re-fetch user info
          const { data: sessionResult } = await getSession();
          const newSession = sessionResult?.session as Session | null;
          set({ session: newSession, user: newSession?.user ?? null });
          if (newSession?.user) {
            const { data: profile } = await fetchProfile(newSession.user.id);
            set({ profile: profile ?? null });
            if (event === 'SIGNED_IN') {
              loadUserData(newSession.user.id); // non-blocking
            }
          }
        } else if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, profile: null });
          await Storage.clear();
        }
      });
    } finally {
      set({ isLoading: false, isHydrated: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error } = await signIn(email, password);
      if (error) throw new Error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, fullName) => {
    set({ isLoading: true });
    try {
      const { error } = await signUp(email, password, fullName);
      if (error) throw new Error(error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await signOut();
    set({ session: null, user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),

  saveProfile: async (updates) => {
    const { user } = useAuthStore.getState();
    if (!user) throw new Error('Not logged in');
    const { error } = await updateProfile(user.id, updates);
    if (error) throw new Error(error.message);
    set(state => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    }));
  },
}));
