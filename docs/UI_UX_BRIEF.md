# MutuneRent Pro — UI/UX Brief & User Flow Journey

**Version:** 1.0.0  
**Date:** June 2025  
**Status:** Production  
**Design System:** Tailwind CSS 3.4.4 + Framer Motion 12.40.0 + Lucide React  

---

## 1. Design Principles

MutuneRent Pro adheres to three foundational usability frameworks:

### 1.1 Don Norman — Design of Everyday Things

| Principle | Application |
|-----------|-------------|
| **Affordances** | Buttons use gradient backgrounds and shadows to indicate clickability; cards use borders and rounded corners to indicate containment; inputs use subtle borders that darken on focus. |
| **Signifiers** | Labels, icons (Lucide), and helper text are always present. A lock icon on the unit card signifies the lock/unlock action. A shield icon on the pending-approval screen signifies security review. |
| **Feedback** | Every action produces visible feedback: toast notifications (React-Toastify) for success/error, loading spinners inside buttons, skeleton loaders for async data, and animated page transitions. |
| **Mapping** | The sidebar navigation mirrors the user's mental model of the platform: Properties → Tenants → Payments → Maintenance. The GPS map widget maps physical location to digital property cards. |
| **Constraints** | Forms use validation constraints (max length, required fields). Admin actions require password re-verification. Agent lock operations require an active GPS check-in within 200 m. |

### 1.2 Jakob Nielsen — 10 Usability Heuristics

| Heuristic | Implementation |
|-----------|----------------|
| **Visibility of system status** | Loading skeletons, progress indicators on STK push, real-time agent location dots, task status badges (pending / in-progress / completed / overdue). |
| **Match between system and real world** | Property terminology uses Kenyan real-estate language ("bedsitter", "EARB license", "M-Pesa STK Push", "KRA report"). Dates use local EAT timezone. |
| **User control and freedom** | Tenants can cancel open maintenance tickets. Admins can void payments with reason entry. Users can clear AI chat history at any time. |
| **Consistency and standards** | All buttons use the same `Button` component with 5 variants. All cards use `Card` with 4 variants. All modals use `Modal` with identical header/body/footer structure. |
| **Error prevention** | Confirmation dialogs before destructive actions (delete property, void payment, delete unit). Form validation with inline error messages before submission. |
| **Recognition rather than recall** | Navigation sidebar persists across all pages. Breadcrumbs on detail pages. Recently viewed properties cached in React Query. |
| **Flexibility and efficiency of use** | Power users can use keyboard shortcuts (Tab navigation). Agents can bulk-update unit statuses. Admin dashboard shows aggregated KPIs at a glance. |
| **Aesthetic and minimalist design** | Information hierarchy via whitespace, typography scale, and color. No decorative elements without function. |
| **Help users recognize, diagnose, and recover from errors** | ErrorBoundary with friendly "Something went wrong" UI and reload button. API errors display structured `error.message` in toast notifications. |
| **Help and documentation** | Floating AI Chat Assistant (bottom-right) provides contextual help. Onboarding page guides new users through role selection. |

### 1.3 Ben Shneiderman — Eight Golden Rules

| Rule | Implementation |
|------|----------------|
| **Strive for consistency** | Single `Button`, `Card`, `Input`, `Modal`, `Badge` component library used across all 15+ pages. |
| **Enable frequent users to use shortcuts** | Keyboard-navigable forms. Sidebar collapses to icon-only on large screens (72 px width). |
| **Offer informative feedback** | Toast notifications for every mutation. Real-time payment status updates. Agent check-in distance feedback ("You are 23 m from the property"). |
| **Design dialogs to yield closure** | Multi-step flows (onboarding, property submission) have clear start and end states with confirmation messages. |
| **Offer simple error handling** | API returns `{ success, error: { code, message } }` — frontend maps `code` to user-friendly toast messages. |
| **Permit easy reversal of actions** | Soft-delete users (recoverable). Void payment (reverses tenant balance). Tenant can cancel open maintenance ticket. |
| **Support internal locus of control** | Users initiate payments, submit maintenance tickets, and acknowledge notices — the system never performs destructive actions without explicit user intent. |
| **Reduce short-term memory load** | Dashboards show 6-month revenue trends rather than raw tables. Kanban-style task boards group by status. |

---

## 2. Color System

### 2.1 Primary Palette

The brand color is **Blue** (`#2563EB`), chosen for trust, professionalism, and financial stability.

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-50` | `#eff6ff` | Lightest backgrounds, hover states |
| `--brand-100` | `#dbeafe` | Subtle highlights, badge backgrounds |
| `--brand-200` | `#bfdbfe` | Borders, dividers |
| `--brand-300` | `#93c5fd` | Focus rings, secondary accents |
| `--brand-400` | `#60a5fa` | Links, interactive hints |
| `--brand-500` | `#3b82f6` | Primary buttons (light mode), active nav items |
| `--brand-600` | `#2563eb` | **Primary brand color** — buttons, icons, headings |
| `--brand-700` | `#1d4ed8` | Hover states for primary buttons |
| `--brand-800` | `#1e40af` | Pressed states, emphasis text |
| `--brand-900` | `#1e3a8a` | Dark mode primary text |
| `--brand-950` | `#172554` | Deep backgrounds, dark mode emphasis |

### 2.2 Semantic Colors

| Color | Hex | Light BG | Dark BG | Usage |
|-------|-----|----------|---------|-------|
| **Success** | `#16A34A` | `#F0FDF4` | `#052E16` | Payment confirmed, check-in verified, approval granted |
| **Warning** | `#D97706` | `#FFFBEB` | `#451A03` | Pending approval, grace period active, manual review |
| **Danger** | `#DC2626` | `#FEF2F2` | `#450A0A` | Payment failed, rejection, overdue, error |
| **Info** | `#2563EB` | `#EFF6FF` | `#172554` | Notification, link, notice |
| **Neutral** | `#475569` | `#F8FAFC` | `#1E293B` | Body text, secondary text, borders |

### 2.3 Dark Mode

Dark mode is implemented via CSS class toggle (`<html class="dark">`) with CSS custom properties.

| Variable | Light Mode | Dark Mode |
|----------|------------|-----------|
| `--background` | `#F8FAFC` | `#0F172A` |
| `--foreground` | `#0F172A` | `#F8FAFC` |
| `--surface` | `#FFFFFF` | `#1E293B` |
| `--border` | `#E2E8F0` | `#334155` |
| `--muted` | `#475569` | `#94A3B8` |
| `--primary` | `#2563EB` | `#3B82F6` |

Dark mode is persisted in `localStorage` under key `mutunerent-theme` and applied before React hydration to prevent flash-of-light-mode.

### 2.4 Usage Rules

1. **Text on primary**: White (`#FFFFFF`) on `--brand-600` for buttons and badges.
2. **Text on surface**: `--foreground` for headings, `--muted` for body/secondary text.
3. **Borders**: `--border` for cards, inputs, dividers. Slightly darker on hover.
4. **Status badges**: Always use semantic color + 10 % opacity background + matching border.
5. **Disabled states**: `opacity: 0.5`, `cursor: not-allowed`, no hover elevation.

---

## 3. Typography

### 3.1 Font Family

| Purpose | Font Stack |
|---------|------------|
| **Sans-serif (UI)** | `Inter, system-ui, -apple-system, sans-serif` |
| **Monospace (data)** | `Fira Code, JetBrains Mono, Cascadia Code, monospace` |

Inter is loaded via Google Fonts CDN (`fonts.googleapis.com` / `fonts.gstatic.com`) and included in the Helmet CSP `styleSrc`/`fontSrc` directives.

### 3.2 Type Scale

| Token | Size | Weight | Line-Height | Letter-Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| **Display** | `1.875rem` (30 px) | 800 | 1.1 | `-0.025em` | Dashboard hero numbers, empty-state headings |
| **H1** | `1.5rem` (24 px) | 700 | 1.25 | `-0.02em` | Page titles (e.g., "Dashboard", "Properties") |
| **H2** | `1.25rem` (20 px) | 600 | 1.3 | `-0.015em` | Card titles, section headers |
| **H3** | `1.125rem` (18 px) | 600 | 1.35 | `-0.01em` | Sub-section headers, modal titles |
| **Body** | `0.875rem` (14 px) | 400 | 1.5 | `0` | Paragraphs, descriptions, table cells |
| **Small** | `0.75rem` (12 px) | 400 | 1.4 | `0.01em` | Captions, metadata, timestamps, badges |
| **Tiny** | `0.625rem` (10 px) | 500 | 1.3 | `0.02em` | Tags, footer labels, monospace data (codes, IDs) |
| **Mono** | `0.75rem` (12 px) | 400 | 1.4 | `0` | Property codes, tenant codes, receipt IDs, phone numbers |

### 3.3 Typography Rules

1. **Never use font sizes outside the scale** above without explicit design approval.
2. **Headings use `font-sans` with tight negative letter-spacing** for a modern, editorial feel.
3. **Data IDs always use `font-mono`** to improve scannability and copy-paste accuracy.
4. **Body text color**: `--foreground` in light mode, `--foreground` in dark mode (inverted via CSS variables).
5. **Line length**: Max 65 characters per line for readability; cards and modals enforce this via max-width.

---

## 4. Component Library

All components are located in `frontend/src/components/ui/` and follow a single-source-of-truth pattern.

### 4.1 Button

```jsx
<Button
  variant="primary"   // primary | secondary | danger | ghost | outline
  size="md"           // sm | md | lg
  isLoading={false}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  fullWidth={false}
  disabled={false}
>
  Label
</Button>
```

| Variant | Visual |
|---------|--------|
| **Primary** | Gradient from `emerald-500` to `emerald-600`, white text, shadow, border |
| **Secondary** | White background, gray-700 text, gray-200 border, shadow-sm |
| **Danger** | Gradient from `red-500` to `red-600`, white text, shadow |
| **Ghost** | Transparent, gray-600 text, hover gray-100 background |
| **Outline** | Transparent, emerald-600 text, emerald-200 border |

**Interaction**: `whileHover={{ scale: 1.015 }}`, `whileTap={{ scale: 0.97 }}`, spring transition (stiffness 400, damping 17).

### 4.2 Card

```jsx
<Card variant="default" hover={true} noPadding={false}>
  <Card.Header title="Revenue" subtitle="Last 6 months" badge={<Badge />} />
  <Card.Body>{children}</Card.Body>
  <Card.Footer>{actions}</Card.Footer>
</Card>
```

| Variant | Visual |
|---------|--------|
| **Default** | White background, gray-100 border, shadow-sm |
| **Glass** | White/60 background, backdrop-blur-xl, white/20 border, shadow-lg |
| **Gradient** | Gradient from white to gray-50/80, gray-100/80 border |
| **Elevated** | White background, gray-100 border, shadow-md |

**Animation**: `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, duration 0.25 s, ease `[0.25, 0.46, 0.45, 0.94]`.

**StatCard** (sub-component): Gradient border top-left, icon in colored rounded square, large bold number, optional trend arrow.

### 4.3 Input

```jsx
<Input
  label="Full Name"
  placeholder="Enter full name"
  error={errorMessage}
  helperText="As it appears on ID"
  icon={<User size={16} />}
  size="md"      // sm | md | lg
  disabled={false}
/>
```

- Height: `sm: 32px`, `md: 36px`, `lg: 40px`
- Border: 1 px solid `--border`, rounded-xl (`border-radius: 12px`)
- Focus: `ring-2 ring-brand-500/40`, border transitions to `brand-500`
- Error: Border `red-400`, background `red-50`, red icon + error message below
- Dark mode: Background `--surface`, border `--border`, focus ring `brand-400/40`

### 4.4 Modal

```jsx
<Modal
  isOpen={boolean}
  onClose={fn}
  title="Confirm Action"
  size="md"     // sm | md | lg | xl
  footer={<Button>Confirm</Button>}
>
  {children}
</Modal>
```

- Backdrop: `bg-black/40` with `backdrop-blur-sm`
- Panel: White/`--surface` background, rounded-2xl, shadow-2xl, max-width by size
- Animation: `AnimatePresence` with `scale: 0.95 → 1`, `opacity: 0 → 1`, duration 0.2 s
- Focus trap: First focusable element auto-focused; `Escape` key closes; click-outside closes
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title

### 4.5 Badge

```jsx
<Badge variant="success" size="sm">Paid</Badge>
```

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| `success` | `emerald-50` / `emerald-900/30` | `emerald-700` / `emerald-300` | `emerald-200` / `emerald-800` |
| `warning` | `amber-50` / `amber-900/30` | `amber-700` / `amber-300` | `amber-200` / `amber-800` |
| `danger` | `red-50` / `red-900/30` | `red-700` / `red-300` | `red-200` / `red-800` |
| `info` | `blue-50` / `blue-900/30` | `blue-700` / `blue-300` | `blue-200` / `blue-800` |
| `neutral` | `gray-100` / `gray-800` | `gray-700` / `gray-300` | `gray-200` / `gray-700` |

Sizes: `sm` (px-2, py-0.5, text-xs), `md` (px-2.5, py-1, text-xs), `lg` (px-3, py-1, text-sm).

### 4.6 DataTable

```jsx
<DataTable
  columns={columns}
  data={data}
  sortable={true}
  searchable={true}
  pagination={{ page, limit, total, onPageChange }}
  emptyState={<EmptyState />}
  loading={isLoading}
/>
```

- Header: `bg-gray-50` / `bg-slate-800`, sticky on scroll, sortable columns with arrow icons
- Row: Hover `bg-gray-50` / `bg-slate-800/50`, transition 150 ms
- Cell: `text-sm`, `text-gray-700` / `text-slate-300`, monospace for codes
- Actions: Right-aligned action buttons (edit, view, delete) in a dropdown menu on mobile
- Empty state: Centered illustration + message when `data.length === 0`
- Loading: Skeleton row placeholders (4 rows × column count) with pulsing animation

### 4.7 EmptyState

```jsx
<EmptyState
  icon={<Home size={48} />}
  title="No properties yet"
  description="Add your first property to get started."
  action={<Button>Add Property</Button>}
/>
```

- Centered layout, icon in `gray-300` / `slate-600`, title `text-lg font-bold`, description `text-sm text-gray-500`
- Used in: property lists, tenant lists, payment history, maintenance queues, task lists

### 4.8 Spinner

```jsx
<Spinner size="md" color="brand" />
```

- SVG-based animated spinner (rotating arc)
- Sizes: `sm` (16 px), `md` (20 px), `lg` (24 px), `xl` (32 px)
- Colors: `brand`, `white`, `gray`
- Used inside buttons (replacing label), overlay loaders, and async action indicators

### 4.9 Select (Dropdown)

```jsx
<Select
  label="Property Type"
  options={[{ value: 'apartment', label: 'Apartment' }]}
  value={selected}
  onChange={fn}
  error={error}
/>
```

- Styled native `<select>` with custom arrow icon
- Height matches Input (`md: 36px`)
- Same focus and error states as Input

### 4.10 SkeletonLoader

```jsx
<SkeletonLoader type="card" count={4} />
// or
<SkeletonLoader type="table" rows={5} columns={4} />
```

- Pulsing gradient from `gray-200` to `gray-300` (light) or `slate-700` to `slate-600` (dark)
- Card skeleton: rounded-2xl, height 120 px
- Table skeleton: rows of rounded rectangles matching column widths
- Text skeleton: rounded-full, height 16 px, width 60 %

---

## 5. Animation & Motion

### 5.1 Philosophy

Motion is used to **communicate state changes**, not to decorate. All animations are:
- **Subtle**: Movement ≤ 8 px, opacity transitions ≤ 0.3 s
- **Purposeful**: Page transitions reduce cognitive load; button feedback confirms interaction
- **Respectful**: Reduced-motion media query supported via Framer Motion's built-in `prefersReducedMotion`

### 5.2 Page Transitions

```jsx
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};
const pageTransition = { duration: 0.18, ease: 'easeOut' };
```

- Every route change inside `AppShellLayout` uses `AnimatePresence` + `motion.div`
- The content area shifts from `opacity: 0, y: 6` to `opacity: 1, y: 0`
- Exit animation runs before unmount to prevent jarring content swaps

### 5.3 Sidebar Collapse

```jsx
<motion.div
  animate={{ marginLeft: isLarge ? (sidebarOpen ? 240 : 72) : 0 }}
  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
/>
```

- **Expanded**: 240 px width, text labels visible
- **Collapsed**: 72 px width, icon-only with tooltip on hover
- **Mobile**: Drawer overlay (slides in from left, backdrop darkens), dismissible by swipe or backdrop click
- **Spring physics**: Stiffness 320, damping 30 — fast but not bouncy

### 5.4 Modal Animations

```jsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    />
  )}
</AnimatePresence>
```

- Backdrop fades in (`opacity: 0 → 0.4`)
- Modal panel scales from 0.95 to 1 with opacity
- Exit reverses the animation before unmounting

### 5.5 Card Hover Effects

```jsx
<motion.div
  whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
  transition={{ duration: 0.2 }}
/>
```

- All stat cards and data cards lift 2 px on hover with increased shadow
- Cursor changes to `pointer` if the card is clickable
- Active/pressed state: `scale: 0.98` for 100 ms

### 5.6 Skeleton Loaders

- Shimmer animation: `background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)` with `background-size: 200% 100%` and `animation: shimmer 1.5s infinite`
- Used during: page data fetch, table search, form submission, file upload

### 5.7 Toast Notifications

- Position: top-right
- Duration: 4 s
- Animation: slide-in from right (`x: 100 → 0`), fade-out on dismiss
- Types: `success` (green left border), `error` (red left border), `info` (blue left border), `warning` (amber left border)

### 5.8 AI Chat Assistant

- Trigger button: `whileHover={{ scale: 1.05 }}`, `whileTap={{ scale: 0.95 }}`, floating action button with `MessageCircle` icon
- Chat panel: `AnimatePresence` slide-up from bottom-right, scale from 0.9 to 1
- Message bubbles: Staggered entrance (0.05 s delay per message), slide-in from bottom (`y: 10 → 0`)
- Typing indicator: Three pulsing dots (`animate-pulse`)

---

## 6. User Flow Journey Maps

### 6.1 Admin Journey

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐     ┌──────────────┐     ┌──────────┐
│  Login   │────▶│ Dashboard│────▶│ User Management  │────▶│  Approvals   │────▶│ Reports  │
│ (Clerk)  │     │ (KPIs)   │     │ (CRUD users)     │     │ (Agent/LLD)  │     │ (KRA CSV)│
└──────────┘     └──────────┘     └──────────────────┘     └──────────────┘     └──────────┘
     │               │                     │                      │                 │
     ▼               ▼                     ▼                      ▼                 ▼
  OAuth/OTP      Revenue chart         Activate/Disable      Approve/Reject    Download CSV
  Admin PW       Occupancy %           Soft-delete           Tier verify       Overdue list
  verify         Top agents            Revoke sessions       Property approve  Agent perf
```

**Detailed Steps:**

1. **Login**: User clicks "Sign In" → Clerk OAuth (Google) → redirected to app → `syncClerk()` called → `AdminPasswordGuard` rendered → admin enters hardcoded password → `sessionStorage.setItem('mutunet_admin_verified', 'true')`.
2. **Dashboard**: Landing page shows `AdminDashboardPage` with 4 StatCards (Total Properties, Total Tenants, Total Agents, Occupancy Rate) + 6-month revenue line chart (Recharts) + top-agent bar chart + payment status pie chart.
3. **User Management**: Navigate to `/admin/users` → `AdminUserManagementPage` renders `DataTable` with users, filters by role, paginated. Admin can click "Deactivate" (opens confirmation modal) or "Edit" (opens modal with form).
4. **Approvals**: Admin clicks "Pending Agents" or "Pending Landlords" in sidebar → table of pending users with action buttons "Approve" / "Reject". Approve generates unique ID code, sends email, creates notification. Reject requires reason, sends rejection email.
5. **Reports**: Admin clicks "KRA Report" → selects month → backend generates CSV with `Content-Disposition: attachment` → browser downloads file.

### 6.2 Agent Journey

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐     ┌──────────┐     ┌──────────────┐
│  Login   │────▶│ Dashboard│────▶│   GPS Check-in   │────▶│  Tasks   │────▶│ Maintenance  │
│ (Clerk)  │     │(My Tasks)│     │ (Photo + 50m)    │     │(Followup)│     │ (Tickets)    │
└──────────┘     └──────────┘     └──────────────────┘     └──────────┘     └──────────────┘
     │               │                     │                      │                 │
     ▼               ▼                     ▼                      ▼                 ▼
  EARB doc        Task list            Map widget            Mark complete    Assign/Resolve
  Approval        Overdue count        Distance check        Payment followup  Add notes
  pending         Revenue collected      Unit lock toggle      Inspection       Photo upload
```

**Detailed Steps:**

1. **Login**: Agent signs in via Clerk → `syncClerk()` → if `agent_approval_status === 'pending'`, full-screen pending page shown with verification doc status. If `rejected`, rejection page with reason shown. If `approved`, dashboard loads.
2. **Role Verification**: Agent must verify Agent ID (e.g., `AGT-MOM-001`) via `RoleIdVerification` component before accessing platform.
3. **Dashboard**: `AgentPerformancePage` shows personal KPIs: task completion rate, rent collected this month, tickets resolved, overdue tasks. Task list sorted by due date.
4. **GPS Check-in**: Agent clicks "Check In" on property detail page → browser geolocation API requests position → photo captured via `react-webcam` → `POST /agents/checkin` with coordinates and photo URL → backend calculates haversine distance → if ≤ 50 m, success toast and lock operation enabled for 30 min.
5. **Unit Lock**: After check-in, agent clicks lock/unlock on unit card → `POST /properties/:id/units/:unitId/lock` → backend verifies `last_checkin` within 30 min and distance ≤ 200 m → unit `lock_status` toggled.
6. **Tasks**: Agent views `/dashboard` (tasks tab) → sees pending, in-progress, completed, overdue tasks. Clicks task to mark complete or add notes.
7. **Maintenance**: Agent navigates to `/maintenance` → filters by assigned properties → clicks ticket to assign self, update status, add `agent_notes`, or resolve.

### 6.3 Landlord Journey

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Login   │────▶│ Dashboard│────▶│ My Properties    │────▶│ Add Property     │────▶│ View Tenants │
│ (Clerk)  │     │ (Own)    │     │ (List + Status)  │     │ (Submit + GPS)   │     │ (Payments)   │
└──────────┘     └──────────┘     └──────────────────┘     └──────────────────┘     └──────────────┘
     │               │                     │                      │                      │
     ▼               ▼                     ▼                      ▼                      ▼
  Ownership       Occupancy %           Unit status           Digital signature      Rent history
  doc upload    Total rent collected    Review status         Unit details           Maintenance
  Approval      Notices               Maintenance count     Area + City            notices
```

**Detailed Steps:**

1. **Login**: Landlord signs in → `syncClerk()` → if `landlord_approval_status === 'pending'`, pending page shown. If `approved`, dashboard loads.
2. **Role Verification**: Landlord verifies 6-digit Landlord ID via `RoleIdVerification`.
3. **Dashboard**: `LandlordDashboardPage` shows only properties where `landlord_id === user._id`. StatCards: Total Properties, Occupied Units, Total Rent Collected (month), Pending Maintenance.
4. **My Properties**: List of properties with status badges (`active`, `pending_admin_approval`). Click property to view detail with unit cards, tenant names, rent amounts, and maintenance counts.
5. **Add Property**: Navigate to `/properties/add` → `LandlordAddPropertyPage` renders multi-step form: Property Name → Type → Address (area, city, county) → GPS coordinates (auto-detected or manual) → Units (unit number, floor, rent, bedrooms) → Digital signature (canvas or upload) → Submit. Status set to `pending_admin_approval`. Notification sent to all admins/agents.
6. **View Tenants**: Property detail page shows tenant cards with lease dates, payment history (last 3 months), KYC status, and notice status. Landlord can view but not edit.

### 6.4 Tenant Journey

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Login   │────▶│  Portal  │────▶│   Pay Rent       │────▶│ View History     │────▶│ Maintenance  │
│ (Clerk)  │     │ (Overview)│     │ (M-Pesa STK)     │     │ (Payments)       │     │ (Submit)     │
└──────────┘     └──────────┘     └──────────────────┘     └──────────────────┘     └──────────────┘
     │               │                     │                      │                      │
     ▼               ▼                     ▼                      ▼                      ▼
  Tenant code    Balance due            STK push sent         Month-by-month        Category
  linking        Arrears                Enter PIN             status (paid/overdue) Priority
  Onboarding     Next payment date      Receipt SMS           Download receipt      Photos (max 5)
  Vacant unit                                                     View notices     Track status
  selection
```

**Detailed Steps:**

1. **Onboarding**: New tenant signs in → `syncClerk()` with no role → redirected to `/onboarding`. Two options: (a) Enter existing Tenant Code (e.g., `TNT-MOM-0001`) to link profile, or (b) Select from vacant units list → unit marked as `occupied` → Tenant record auto-created with lease start = today, lease end = +1 year.
2. **Role Verification**: Tenant verifies identity via `RoleIdVerification`.
3. **Portal**: `TenantPortalPage` shows: Current property name, unit number, rent amount, balance due (rent + arrears), next payment date, quick-action buttons (Pay Rent, Submit Maintenance, View Notices).
4. **Pay Rent**: Clicks "Pay Rent" → `POST /payments/auto-initiate` → backend calculates `outstanding = rent_amount_kes + arrears_kes` → M-Pesa STK Push sent to tenant phone → tenant enters PIN → callback updates payment status → toast "Payment received!" → SMS receipt sent → unit `lock_status` updated to `payment_confirmed`.
5. **View History**: Payment table shows month, amount, status (paid/partial/overdue), receipt number. Downloadable receipt per payment.
6. **Submit Maintenance**: Clicks "Report Issue" → form with category dropdown (plumbing, electrical, etc.), priority (low/medium/high/emergency), description textarea, photo upload (max 5, drag-drop via `react-dropzone`) → `POST /maintenance` → ticket created → notification sent to assigned agent.
7. **View Notices**: Tenant sees notices issued to their unit. If `requires_acknowledgment: true`, a "Acknowledge" button is shown. Clicking it records `tenant_acknowledged: true` and `acknowledged_at` timestamp.

---

## 7. Responsive Design Strategy

### 7.1 Breakpoints

| Name | Width | Tailwind Prefix | Primary Target |
|------|-------|-----------------|----------------|
| **Mobile** | < 640 px | `default` | Smartphones, feature phones with browsers |
| **Tablet** | 640–1023 px | `sm:` / `md:` | iPads, Android tablets, small laptops |
| **Desktop** | 1024–1279 px | `lg:` | Standard laptops, small desktops |
| **Wide** | ≥ 1280 px | `xl:` / `2xl:` | Large monitors, ultrawide screens |

### 7.2 Mobile-First Approach

All CSS is written mobile-first. Base styles target mobile; larger screens override with `sm:`, `md:`, `lg:` prefixes.

```jsx
// Example: Card grid on properties page
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

### 7.3 Layout Behavior by Breakpoint

| Component | Mobile (< 640) | Tablet (640–1023) | Desktop (1024+) |
|-----------|----------------|-------------------|-----------------|
| **Sidebar** | Hidden drawer, hamburger toggle | Hidden drawer, hamburger toggle | Persistent sidebar (240 px / 72 px collapsed) |
| **Topbar** | Compact, search hidden behind icon | Search visible, icons condensed | Full search bar, all actions visible |
| **Dashboard KPIs** | 1-column stack | 2-column grid | 4-column grid |
| **DataTable** | Horizontal scroll, card rows | Horizontal scroll | Full table with sticky header |
| **Map Widget** | Full-width, 300 px height | 50 % width, 400 px height | 40 % width, 500 px height |
| **Modal** | Full-screen overlay | Centered, max-w-lg | Centered, max-w-xl |
| **Chat Assistant** | Full-width bottom sheet | Floating panel (400 px) | Floating panel (400 px) |
| **Property Cards** | 1-column | 2-column | 3-column |
| **Form Layout** | Single column | Single column | Two-column for related fields |

### 7.4 Touch Targets

| Element | Minimum Size | Padding |
|---------|-------------|---------|
| Buttons | 44 × 44 px | 8 px internal padding |
| Navigation items | 48 × 48 px | 12 px vertical |
| Form inputs | 44 px height | 12 px horizontal |
| Checkboxes / toggles | 24 × 24 px | 8 px margin |
| Table row actions | 40 × 40 px | Icon centered |

### 7.5 Typography Scaling

| Token | Mobile | Desktop |
|-------|--------|---------|
| Display | `1.5rem` (24 px) | `1.875rem` (30 px) |
| H1 | `1.25rem` (20 px) | `1.5rem` (24 px) |
| Body | `0.875rem` (14 px) | `0.875rem` (14 px) |
| Small | `0.75rem` (12 px) | `0.75rem` (12 px) |

### 7.6 Navigation Patterns

- **Mobile**: Bottom tab bar (optional) or hamburger menu → drawer slides from left with backdrop overlay. Sections grouped: "My Account", "Properties", "Finance", "Support".
- **Tablet**: Same as mobile but drawer can be persistent in landscape mode if width ≥ 768 px.
- **Desktop**: Sidebar with icon + text labels. Topbar with search, notification bell, user avatar dropdown, and theme toggle.

---

## 8. Accessibility Requirements

### 8.1 WCAG 2.1 AA Compliance Checklist

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| **1.1.1 Non-text Content** | All images have alt text | Icons from `lucide-react` are decorative and hidden with `aria-hidden="true"`. Functional images (property photos, tenant KYC docs) have descriptive `alt` attributes. |
| **1.3.1 Info and Relationships** | Semantic structure | `<nav>`, `<main>`, `<section>`, `<table>` used correctly. Headings follow hierarchy (H1 → H2 → H3). |
| **1.4.3 Contrast (Minimum)** | 4.5:1 for normal text, 3:1 for large text | All text colors tested against backgrounds: `--foreground` on `--surface` = 12.5:1. `brand-600` on white = 4.6:1. `muted` on white = 7.5:1. |
| **1.4.4 Resize Text** | Text resizable up to 200 % | All sizes use `rem` units. Layout remains functional at 200 % zoom. |
| **1.4.10 Reflow** | No horizontal scroll at 320 px | Content reflows to single column. Tables become horizontally scrollable with `overflow-x-auto` only when necessary. |
| **1.4.11 Non-text Contrast** | UI components have 3:1 contrast | Borders (`--border`) have ≥ 3:1 against background. Focus rings (`brand-500`) have ≥ 3:1. |
| **2.1.1 Keyboard** | All functionality available via keyboard | Tab order follows visual order. Enter/Space activates buttons. Escape closes modals and drawers. |
| **2.4.3 Focus Order** | Logical focus sequence | Focus moves from hamburger → sidebar → main content → modal (when open). Modal uses focus trap. |
| **2.4.7 Focus Visible** | Visible focus indicator | All interactive elements have `focus-visible:ring-2 focus-visible:ring-brand-500/40` with 2 px offset. |
| **2.5.3 Label in Name** | Accessible name matches visible label | All buttons have visible text or `aria-label`. All inputs have visible `<label>` or `aria-label`. |
| **3.3.1 Error Identification** | Errors identified in text | Inline validation messages below inputs. Toast notifications for API errors. Error color `red-600` + icon. |
| **3.3.2 Labels or Instructions** | Labels or instructions provided | Every form field has a label. Required fields marked with `*`. Helper text explains format expectations (e.g., "254XXXXXXXXX"). |
| **4.1.2 Name, Role, Value** | Custom components expose ARIA | `Modal` has `role="dialog"`, `aria-modal="true"`. `Button` exposes `aria-disabled` and `aria-busy`. `Badge` is a `<span>` with semantic color (not role-dependent). |
| **4.1.3 Status Messages** | Status messages announced | `react-toastify` uses `aria-live="polite"` region. AI chat messages use `aria-live="polite"`. |

### 8.2 Screen Reader Support

| Pattern | Implementation |
|---------|----------------|
| **Loading states** | Buttons announce "Loading" via `aria-busy="true"`. Skeletons use `aria-hidden="true"` with a visually hidden "Loading content" message. |
| **Dynamic updates** | Payment status changes trigger toast with `aria-live`. Notification bell shows `aria-label="5 unread notifications"`. |
| **Navigation** | Sidebar links use `aria-current="page"` for active route. Landmark regions (`<nav>`, `<main>`) allow quick jumps. |
| **Tables** | DataTables use `<th scope="col">` for column headers. Row actions have `aria-label="Edit property MUT-001"`. |
| **Modals** | On open, focus moves to first focusable element. On close, focus returns to trigger button. `aria-labelledby` points to modal title. |

### 8.3 Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- Framer Motion respects `prefers-reduced-motion` automatically.
- Skeleton loaders degrade to static gray boxes when motion is reduced.
- Page transitions become instant opacity swaps (no slide).
- Toast notifications appear instantly without slide animation.

### 8.4 Color Blindness

- Status is never communicated by color alone. Badges include text labels ("Paid", "Pending", "Overdue").
- Icons accompany all color-coded states: checkmark for success, clock for pending, warning triangle for overdue.
- Chart colors use patterns + distinct hues (blue, green, amber, red) that remain distinguishable in deuteranopia.

---

*Document End*
