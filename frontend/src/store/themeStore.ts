import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const initialTheme = (localStorage.getItem('mutunerent-theme') as Theme) || 'light';
if (initialTheme === 'dark') {
  document.documentElement.classList.add('dark');
  document.documentElement.classList.remove('light');
} else {
  document.documentElement.classList.add('light');
  document.documentElement.classList.remove('dark');
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  toggleTheme: () => set((state) => {
    const nextTheme: Theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('mutunerent-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    return { theme: nextTheme };
  }),
  setTheme: (newTheme: Theme) => set(() => {
    localStorage.setItem('mutunerent-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),
}));
