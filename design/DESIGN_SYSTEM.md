# MutuneRent Pro — Frontend Upgrade Design System

## Design Direction (Extracted from Reference Images)

### Color Palette
- **Primary**: `#8b5cf6` (violet-500) → `#6366f1` (indigo-500) gradient
- **Primary Dark**: `#7c3aed` (violet-600)
- **Background**: `#0f172a` (slate-900) — deep navy
- **Surface**: `#1e293b` (slate-800) with slight transparency
- **Surface Bright**: `#334155` (slate-700)
- **Border**: `rgba(255,255,255,0.08)` — barely visible borders for glass effect
- **Text Primary**: `#f8fafc` (slate-50)
- **Text Muted**: `#94a3b8` (slate-400)
- **Success**: `#10b981` (emerald-500)
- **Warning**: `#f59e0b` (amber-500)
- **Error**: `#ef4444` (red-500)
- **Info**: `#3b82f6` (blue-500)

### Typography
- **Headings**: Inter font, font-black (900), tracking-tight
- **Labels**: text-[10px], uppercase, tracking-widest, font-extrabold
- **Body**: text-xs, font-medium
- **Numbers/Monospace**: font-mono for KES amounts, percentages

### Component Language
- **Cards**: `bg-surface/30 backdrop-blur-md border border-border rounded-3xl shadow-xl`
- **Buttons Primary**: `bg-gradient-to-r from-brand-500 to-indigo-600 rounded-xl text-xs font-bold uppercase tracking-wider`
- **Buttons Secondary**: `bg-background hover:bg-surface border border-border rounded-xl`
- **Status Badges**: `bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[9px] font-extrabold uppercase`
- **Inputs**: `bg-background border border-border rounded-xl px-3 py-2 text-xs focus:border-green-500/50`

### Layout Patterns
- **Sidebar**: Fixed left, 64px icons-only or 240px expanded, dark slate
- **Header**: Welcome banner with gradient background + property slider
- **Stats Row**: 4-column grid with large numbers, small caps labels, trend icons
- **Content Grid**: 2-col (66/33) or 3-col (equal) layouts
- **Tables**: Clean with subtle row dividers, status badges, monospace amounts

### Animation Language
- Card hover: `hover:scale-[1.01]` with subtle shadow lift
- Page transitions: Framer Motion `initial={{ opacity: 0, y: 10 }}`
- Loading: Cinematic particle vortex preloader (already exists)
- Progress rings: SVG stroke-dashoffset animation, 1s ease-out

### Existing Assets to Leverage
- `/assets/voxel_estate.png` — 3D building fallback
- `/assets/voxel_floorplan.png` — Floor plan viewer
- `/assets/cinematic_loading_screen.png` — Preloader asset
- CinematicPreloader.jsx — Already built
- ImageUpload.jsx — Already built (drag-drop + camera)
- MapWidget.jsx — Already built (Leaflet maps)
- ChatAssistant.jsx — Already built (AI chat)

---

## Page Upgrade Plan

### Phase 1: Core Dashboards
1. **Landlord Dashboard** — Match dark prototype: hero banner, stats row, property cards, financial chart, payments table, pending actions, quick links
2. **Admin Dashboard** — Match dark prototype: KPI tiles, revenue charts, portfolio donut, approvals queue, late fee rules, property map
3. **Tenant Portal** — Match dark/light prototypes: balance card, payment history, maintenance request with photo upload, lease details, notice board

### Phase 2: Auth & Landing
4. **Login Page** — Clean centered card, brand gradient, Clerk integration
5. **SignUp Page** — Multi-step onboarding flow with role selection
6. **Landing Page** — Hero with 3D building, features grid, testimonials, CTA

### Phase 3: Management Pages
7. **Properties Page** — Grid cards with 3D thumbnails, occupancy bars, filter sidebar
8. **Payments Page** — Full table with filters, export CSV, M-Pesa reconciliation
9. **Maintenance Page** — Kanban board (Open/In Progress/Resolved), photo previews
10. **Notices Page** — Communication feed with compose panel, delivery tracking
11. **Onboarding Page** — Role-based wizard (Landlord/Agent/Tenant)
12. **Tasks Page** — Agent task list with status, priority, location check-in
13. **Agent Dashboard** — Task list, collection widget, assigned properties, performance chart

### Phase 4: Detail Pages
14. **Property Detail Page** — Photo carousel, unit grid, map, 3D view toggle
15. **Tenants Page** — Directory with search, filters, lease status
16. **Agent Performance Page** — Metrics cards, commission tracking, leaderboard

---

## Backend Route Map (Verified from api.js)

| Feature | Endpoint | Method |
|---------|----------|--------|
| Properties | /properties | GET/POST |
| Property Detail | /properties/:id | GET/PATCH/DELETE |
| Units | /properties/:id/units | POST |
| Unit Update | /properties/:id/units/:unitId | PATCH |
| Vacant Units | /properties/units/vacant | GET |
| Tenants | /tenants | GET/POST |
| Tenant Detail | /tenants/:id | GET/PATCH |
| Tenant Payments | /tenants/my/payments | GET |
| Tenant Notices | /tenants/my/notices | GET |
| Tenant Profile | /tenants/my/profile | GET |
| Payments | /payments | GET |
| STK Push | /payments/initiate-stk | POST |
| Auto Payment | /payments/auto-initiate | POST |
| Users | /users | GET/POST |
| Me | /users/me | GET |
| Sync Clerk | /users/sync-clerk | POST |
| Admin Stats | /admin/stats | GET |
| Pending Agents | /admin/agents/pending | GET |
| Approve Agent | /admin/agents/:id/approve | PATCH |
| Pending Landlords | /admin/landlords/pending | GET |
| Late Fee Rules | /admin/late-fee-rules | GET/POST |
| Late Fee Rule | /admin/late-fee-rules/:id | PATCH/DELETE |
| Maintenance | /maintenance | GET/POST |
| My Tickets | /maintenance/my-tickets | GET |
| Ticket Update | /maintenance/:id | PATCH/DELETE |
| Notices | /notices | GET |
| Generate Notice | /notices/generate | POST |
| Acknowledge | /notices/:id/acknowledge | POST |
| Bulk Notice | /notices/bulk | POST |
| KRA Report | /reports/kra?month= | GET (download) |
| Report Summary | /reports/summary | GET |
| Tasks | /tasks | GET/POST |
| My Tasks | /tasks/agent/my | GET |
| Task Status | /tasks/:id/status | PATCH |
| Agent Check-in | /agents/checkin | POST |
| Agent Location | /agents/location | GET |
| All Agent Locations | /agents/all-locations | GET |
| Agent Performance | /admin/agent-performance | GET |
| Notifications | /notifications | GET |
| Mark Read | /notifications/:id/read | PATCH |
| Upload Doc | /upload/doc | POST (multipart) |
| Inventory | /inventory/all | GET |
| Auctionable | /inventory/auctionable | GET |

---

## Tech Stack (Existing)
- React 18 + Vite
- Tailwind CSS
- Framer Motion (animations)
- Recharts (charts)
- React-Leaflet (maps)
- React Query (TanStack Query)
- React-Toastify
- Clerk (auth)
- Lucide React (icons)
- React Dropzone + React Webcam (uploads)
