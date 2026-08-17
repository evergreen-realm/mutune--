import { create } from 'zustand';

export interface AuthUser {
  _id?: string;
  id?: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: 'tenant' | 'landlord' | 'agent' | 'admin' | 'super_admin' | 'caretaker';
  verification_status?: string;
  profile_picture?: string;
  [key: string]: any;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const USER_KEY = 'mutune_user';
const TOKEN_KEY = 'clerk_token';

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:  loadUser(),
  token: localStorage.getItem(TOKEN_KEY) || null,

  setUser: (user: AuthUser | null) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    set({ user });
  },

  setToken: (token: string | null) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    set({ token });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!get().token,
}));
