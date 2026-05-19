/**
 * api.ts — REST API client replacing the Supabase SDK.
 *
 * Every exported function mirrors the old supabase.ts signatures so the
 * stores need only change their import path.
 *
 * Tokens are stored in AsyncStorage and auto-attached to requests.
 * Expired access tokens trigger an automatic refresh via the refresh token.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Config ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = '@budget:auth_tokens';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// ── Token management ────────────────────────────────────────────────────────

async function getTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── Auth state change listeners ─────────────────────────────────────────────

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type AuthListener = (event: AuthEvent, session: any | null) => void;
const listeners: AuthListener[] = [];

function notifyListeners(event: AuthEvent, session: any | null): void {
  listeners.forEach((fn) => fn(event, session));
}

// ── Generic fetch wrapper ───────────────────────────────────────────────────

interface ApiResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refresh_token) return false;

      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });

      if (!resp.ok) {
        await clearTokens();
        notifyListeners('SIGNED_OUT', null);
        return false;
      }

      const body = await resp.json();
      const newTokens: AuthTokens = body.data.session;
      await saveTokens(newTokens);
      notifyListeners('TOKEN_REFRESHED', body.data.session);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResponse<T>> {
  const tokens = await getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (tokens?.access_token) {
    headers['Authorization'] = `Bearer ${tokens.access_token}`;
  }

  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    // Auto-refresh on 401
    if (resp.status === 401 && retry) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return apiFetch<T>(path, options, false);
      }
      return { data: null, error: { message: 'Session expired', code: 'TOKEN_EXPIRED' } };
    }

    const body = await resp.json();

    if (!resp.ok) {
      return { data: null, error: { message: body.error || 'Request failed', code: body.code } };
    }

    return { data: body.data ?? body, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || 'Network error' } };
  }
}

// ── Auth helpers (match old supabase.ts exports) ────────────────────────────

export const signUp = async (email: string, password: string, fullName: string) => {
  const result = await apiFetch<any>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });

  if (result.data?.session) {
    await saveTokens(result.data.session);
    notifyListeners('SIGNED_IN', result.data.session);
  }

  return result;
};

export const signIn = async (email: string, password: string) => {
  const result = await apiFetch<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (result.data?.session) {
    await saveTokens(result.data.session);
    notifyListeners('SIGNED_IN', result.data.session);
  }

  return result;
};

export const signOut = async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    await clearTokens();
    notifyListeners('SIGNED_OUT', null);
  }
};

export const getSession = async () => {
  const tokens = await getTokens();
  if (!tokens?.access_token) {
    return { data: { session: null } };
  }

  // Verify token is still valid by calling /auth/me
  const result = await apiFetch<any>('/auth/me');
  if (result.error) {
    return { data: { session: null } };
  }

  return {
    data: {
      session: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: result.data.user,
      },
    },
  };
};

// Auth state listener (replaces supabase.auth.onAuthStateChange)
export const onAuthStateChange = (callback: AuthListener) => {
  listeners.push(callback);
  // Return an unsubscribe function
  return {
    data: {
      subscription: {
        unsubscribe: () => {
          const idx = listeners.indexOf(callback);
          if (idx >= 0) listeners.splice(idx, 1);
        },
      },
    },
  };
};

// ── Profile ──────────────────────────────────────────────────────────────────

export const fetchProfile = (userId: string) =>
  apiFetch<any>(`/profiles/${userId}`);

export const updateProfile = (userId: string, updates: Record<string, unknown>) =>
  apiFetch<any>(`/profiles/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

// ── Categories ───────────────────────────────────────────────────────────────

export const fetchCategories = (_userId: string) =>
  apiFetch<any[]>('/categories');

export const createCategory = (data: Record<string, unknown>) =>
  apiFetch<any>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCategory = (id: string, data: Record<string, unknown>) =>
  apiFetch<any>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteCategory = (id: string) =>
  apiFetch<any>(`/categories/${id}`, { method: 'DELETE' });

// ── Transactions ─────────────────────────────────────────────────────────────

export const fetchTransactions = (userId: string, limit = 100) =>
  apiFetch<any[]>(`/transactions?limit=${limit}`);

export const fetchGroupTransactions = (groupId: string, limit = 100) =>
  apiFetch<any[]>(`/transactions?group_id=${groupId}&limit=${limit}`);

export const createTransaction = (data: Record<string, unknown>) =>
  apiFetch<any>('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateTransaction = (id: string, data: Record<string, unknown>) =>
  apiFetch<any>(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteTransaction = (id: string) =>
  apiFetch<any>(`/transactions/${id}`, { method: 'DELETE' });

// ── Budgets ──────────────────────────────────────────────────────────────────

export const fetchBudgets = (userId: string, month: number, year: number) =>
  apiFetch<any[]>(`/budgets?month=${month}&year=${year}`);

export const upsertBudget = (data: Record<string, unknown>) =>
  apiFetch<any>('/budgets', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteBudget = (id: string) =>
  apiFetch<any>(`/budgets/${id}`, { method: 'DELETE' });

// ── Savings Goals ────────────────────────────────────────────────────────────

export const fetchGoals = (userId: string) =>
  apiFetch<any[]>('/goals');

export const createGoal = (data: Record<string, unknown>) =>
  apiFetch<any>('/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateGoal = (id: string, data: Record<string, unknown>) =>
  apiFetch<any>(`/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteGoal = (id: string) =>
  apiFetch<any>(`/goals/${id}`, { method: 'DELETE' });

// ── Family Groups ────────────────────────────────────────────────────────────

export const fetchUserGroups = (userId: string) =>
  apiFetch<any[]>('/groups');

export const createGroup = (data: Record<string, unknown>) =>
  apiFetch<any>('/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const joinGroupByCode = (inviteCode: string, _userId: string) =>
  apiFetch<any>('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  });
