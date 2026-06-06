import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('clerk_token') || null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    localStorage.setItem('clerk_token', token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('clerk_token');
    set({ user: null, token: null });
  },
  isAuthenticated: () => !!get().token
}));
