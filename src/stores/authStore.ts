import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types';
import { supabase, fetchProfile, signIn, signOut, signUp } from '../services/supabase';
import { Storage, StorageKeys } from '../services/storage';

interface AuthState {
  session:     Session | null;
  user:        User | null;
  profile:     Profile | null;
  isLoading:   boolean;
  isHydrated:  boolean;

  initialize:  () => Promise<void>;
  login:       (email: string, password: string) => Promise<void>;
  register:    (email: string, password: string, fullName: string) => Promise<void>;
  logout:      () => Promise<void>;
  setProfile:  (profile: Profile) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session:    null,
  user:       null,
  profile:    null,
  isLoading:  false,
  isHydrated: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await fetchProfile(session.user.id);
        set({ session, user: session.user, profile: profile ?? null });
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          const { data: profile } = await fetchProfile(session.user.id);
          set({ profile: profile ?? null });
        } else {
          set({ profile: null });
          // Clear local cache on logout
          if (event === 'SIGNED_OUT') await Storage.clear();
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
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, fullName) => {
    set({ isLoading: true });
    try {
      const { error } = await signUp(email, password, fullName);
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await signOut();
    set({ session: null, user: null, profile: null });
  },

  setProfile: (profile) => set({ profile }),
}));
