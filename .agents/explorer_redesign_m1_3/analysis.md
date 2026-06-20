# Technical Analysis — Theme System & Global Foundation (Milestone 1)

This report details the architectural and style changes required to implement a robust, unified dark/light theme system and global design foundation in MutuneRent Pro, alongside auditing the font size baseline constraint.

---

## 1. Theme Configuration Design

### A. Tailwind CSS Configuration Changes (`frontend/tailwind.config.js`)
To enable the dark theme toggle using class selectors and integrate custom design variables, the following changes are proposed:
1. Enable class-based dark mode by adding `darkMode: 'class'`.
2. Map color categories to CSS custom variables using Tailwind's `<alpha-value>` syntax to preserve opacity utility helpers (e.g., `bg-primary/20`).

**Proposed Config Structure:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based theme toggle
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          bg: 'rgb(var(--color-success-bg) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        // Backward-compatible mapping for existing green brand classes
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          950: 'var(--brand-950)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'Cascadia Code', 'monospace']
      }
    }
  },
  plugins: []
};
```

---

### B. Global CSS Variables Design (`frontend/src/index.css`)
Define the default light mode values and dark mode overrides under `:root` and `.dark` selectors using raw RGB values (except for the static legacy brand scales).

```css
:root {
  /* Theme variables (Light Mode) */
  --color-primary: 37 99 235;         /* #2563EB - Primary Blue */
  --color-primary-hover: 29 78 216;   /* #1D4ED8 */
  --color-background: 248 250 252;    /* #F8FAFC - Light Background */
  --color-foreground: 15 23 42;       /* #0F172A - Dark Text */
  --color-success: 22 163 74;         /* #16A34A - Success Green */
  --color-success-bg: 240 253 244;    /* #F0FDF4 */
  --color-surface: 255 255 255;       /* #FFFFFF - White Card Surfaces */
  --color-surface-hover: 241 245 249; /* #F1F5F9 */
  --color-border: 226 232 240;        /* #E2E8F0 */
  --color-muted: 100 116 139;         /* #64748B */

  /* Primary Brand Overrides (Light Blue instead of Green) */
  --brand-50: #eff6ff;
  --brand-100: #dbeafe;
  --brand-200: #bfdbfe;
  --brand-300: #93c5fd;
  --brand-400: #60a5fa;
  --brand-500: #3b82f6;
  --brand-600: #2563eb;
  --brand-700: #1d4ed8;
  --brand-800: #1e40af;
  --brand-900: #1e3a8a;
  --brand-950: #172554;
}

.dark {
  /* Theme variables (Dark Mode) */
  --color-primary: 59 130 246;        /* #3B82F6 - Lighter blue for dark mode contrast */
  --color-primary-hover: 96 165 250;  /* #60A5FA */
  --color-background: 15 23 42;       /* #0F172A - Dark Background */
  --color-foreground: 248 250 252;    /* #F8FAFC - Light Text */
  --color-success: 34 197 94;         /* #22C55E */
  --color-success-bg: 5 46 22;        /* #052E16 */
  --color-surface: 30 41 59;          /* #1E293B - Card Surfaces in Dark Mode */
  --color-surface-hover: 51 65 85;    /* #334155 */
  --color-border: 51 65 85;           /* #334155 */
  --color-muted: 148 163 184;         /* #94A3B8 */

  /* Primary Brand Overrides (Dark Blue Scale) */
  --brand-50: #172554;
  --brand-100: #1e3a8a;
  --brand-200: #1e40af;
  --brand-300: #1d4ed8;
  --brand-400: #2563eb;
  --brand-500: #3b82f6;
  --brand-600: #60a5fa;
  --brand-700: #93c5fd;
  --brand-800: #bfdbfe;
  --brand-900: #dbeafe;
  --brand-950: #eff6ff;
}

body {
  @apply bg-background text-foreground antialiased transition-colors duration-200;
  min-height: 100dvh;
}
```

---

## 2. Global State Store (`frontend/src/store/themeStore.js`)

To enable simple sync with `localStorage` and trigger instant component updates, a Zustand theme store is designed.

```javascript
import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  theme: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mutunerent-theme');
      if (saved) return saved;
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return systemDark ? 'dark' : 'light';
    }
    return 'light';
  })(),
  
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    const root = window.document.documentElement;
    if (nextTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('mutunerent-theme', nextTheme);
    return { theme: nextTheme };
  }),
  
  setTheme: (theme) => set(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('mutunerent-theme', theme);
    return { theme };
  })
}));
```

---

## 3. Flash Prevention (FOUC) in `frontend/index.html`

Insert the theme initialization script right at the top of the `<head>` element to apply the theme class before page content renders.

```html
<head>
  <!-- Prevents flash of white/dark theme -->
  <script>
    (function() {
      const saved = localStorage.getItem('mutunerent-theme');
      if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    })();
  </script>
  ...
</head>
```

---

## 4. Integration Blueprint for Layouts & Dashboards

### A. AppShell Layout (`frontend/src/App.jsx`)
- Replace the outer wrapper's static background classes:
  - From: `<div className="flex h-screen overflow-hidden bg-gray-50/50">`
  - To: `<div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">`
- Update header topbar styling:
  - From: `<header className="h-16 bg-white border-b border-gray-100 px-6 ...">`
  - To: `<header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 ...">`
- Add the `ThemeToggle` button next to the settings button in the header.

### B. Admin Dashboard (`frontend/src/pages/AdminDashboardPage.jsx`)
- Update cards to use dynamic background/border colors (e.g., `bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800`).
- Ensure tooltips adapt: `bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100`.
- Pass the dynamic theme state to Recharts' `CartesianGrid` stroke attribute:
  ```javascript
  const { theme } = useThemeStore();
  ...
  <CartesianGrid stroke={theme === 'dark' ? '#334155' : '#f8fafc'} />
  ```

### C. Tenant Portal (`frontend/src/pages/TenantPortalPage.jsx`)
- Currently, `TenantPortalPage` hardcodes a dark background (`bg-slate-950`) and white text (`text-slate-100`) regardless of global settings. 
- Remove `bg-slate-950` and `min-h-screen` classes from the page layout so that it inherits the layout background and behaves as a clean tab component within `AppShell`.
- Adjust backgrounds and borders of portal cards:
  - From: `bg-slate-900/40 border border-slate-800/80`
  - To: `bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80`
- Adjust inputs:
  - From: `bg-slate-950/80 border border-slate-800 text-white`
  - To: `bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white`
- Soften glowing decorative background blobs in light mode by applying opacity wrappers: `opacity-30 dark:opacity-100`.

---

## 5. Audit: Font Size Baseline Verification (Sub-12px Baseline violations)

The project imposes a constraint that no text size should fall below the **12px baseline (`text-xs`)**. The audit discovered **numerous** instances of sub-12px font sizes (`text-[11px]`, `text-[10px]`, `text-[9px]`, and `text-[8px]`) in key files.

### A. Index CSS Violations (`frontend/src/index.css`)
- **Line 83**: `.badge` helper uses `text-[11px]`.
  ```css
  /* BEFORE */
  .badge {
    @apply inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border;
  }
  /* PROPOSED FIX */
  .badge {
    @apply inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border;
  }
  ```

### B. AppShell Layout Violations (`frontend/src/App.jsx`)
- **Line 310, 353, 408, 451**: `text-[10px] text-slate-500 mb-8 font-medium` in pending/rejected agent and landlord approval layout pages.
- **Line 347, 445**: `text-[10px] uppercase font-bold text-red-400` for application rejection status.
- **Line 542**: `text-[8px] font-bold` for navigation badges.
- **Line 582**: `text-[10px] text-slate-400 truncate capitalize` for user roles inside the sidebar footer.
- **Line 590**: `text-[10px] font-bold` for the sidebar logout button.
- **Line 638**: `text-[10px] font-bold` for the topbar M-Pesa environment badge.
- **Line 691**: `text-[10px] text-green-600` for the notification header "Mark all read" action.
- **Line 735**: `text-[10px] text-gray-500` for notification messages inside dropdowns.
- **Line 736**: `text-[8px] text-gray-400` for notification timestamp subtext.
- **Line 767**: `text-[10px] font-bold` for system settings header.
- **Line 769**: `text-[10px] text-slate-505` for user role inside settings profiles.
- **Line 770**: `text-[9px] text-slate-400` for phone numbers in profile cards.
- **Line 773**: `text-[10px] font-medium` for settings labels.
- **Line 794**: `text-[10px] font-bold` for the settings logout action.

### C. Admin Dashboard Violations (`frontend/src/pages/AdminDashboardPage.jsx`)
- **Line 57**: `text-[10px] font-bold uppercase tracking-wider` for stat card labels.
- **Line 61**: `text-[10px] mt-1.5 opacity-70` for stat card sub-values.
- **Line 77**: `text-[10px] font-bold uppercase` for transaction counts in charts.
- **Line 233**: `text-[10px] font-extrabold uppercase` for revenue banner headers.
- **Line 252, 291**: `text-[11px] text-slate-400` for monthly trend descriptions.
- **Line 312**: `text-[10px] text-slate-600` for pie chart legends.
- **Line 340**: `text-[10px] font-black` for field agent rank index badges.
- **Line 345**: `text-[9px] text-slate-400` for field agent emails.
- **Line 350**: `text-[10px] text-slate-400` for collections count.
- **Line 372**: `text-[10px] font-bold` for file download section headers.
- **Line 397**: `text-[9px] text-slate-400` for role authorization notes.
- **Line 410**: `text-[9px] font-black` for approvals queue count pill.
- **Line 415**: `text-[11px] text-slate-455` for queue instructions.
- **Line 425, 435, 445**: `text-[10px] font-black` for queue item stats.

### D. Tenant Portal Violations (`frontend/src/pages/TenantPortalPage.jsx`)
- **Line 488**: `text-[10px]` for the PRO badge next to the MutuneRent title.
- **Line 489**: `text-[10px]` for portal subtitles.
- **Line 500**: `text-[10px]` for the notification badge counter.
- **Line 517**: `text-[11px]` for breadcrumbs.
- **Line 589**: `text-[10px]` for the arrears header in the hero lease view.
- **Line 608**: `text-[10px]` for tenancy status label.
- **Line 623, 631, 639**: `text-[9px]` for layout labels.
- **Line 625, 633, 641**: `text-[10px]` for actual values under those labels.
- **Line 694, 698, 702, 706**: `text-[10px]` for rent summary table column titles.
- **Line 739**: `text-[11px]` for detail labels.
- **Line 784**: `text-[10px]` for dates.
- **Line 787, 861**: `text-[10px]` for status badges.
- **Line 805, 912, 982**: `text-[11px]` for system helper subtexts.
- **Line 852, 942**: `text-[10px]` for receipt details.
- **Line 856, 937, 996, 1074**: `text-[9px]` for small metadata pills and logs.
- **Line 892, 958, 964, 1041**: `text-[10px]` for small utility buttons.
- **Line 1167, 1176, 1186**: `text-[10px]` for ticket form labels.

### Proposed Resolution Strategy
All of these instances should be systematically bumped to **`text-xs` (12px)**. To compensate for structural layouts, adjustments to margins/padding can be made where necessary (e.g. converting `px-2 py-0.5` to `px-2.5 py-1`). Additionally, any badge component (like `components/ui/Badge.jsx` or `.badge` class in `index.css`) can standardise on `text-xs`.
