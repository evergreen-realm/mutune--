# Project: MutuneRent Pro Auditing & Enhancement

## Architecture
MutuneRent Pro is a multi-role property management SaaS.
- **Frontend**: Single-page application built with React + Vite + Tailwind CSS. Clerk handles user authentication. The frontend queries the Node.js API server for property, payment, notification, and ticket operations.
- **Backend**: Node.js/Express app communicating with MongoDB using Mongoose models. Clerk webhooks and custom sync endpoints maintain user identity and role mapping inside the DB.
- **Database**: MongoDB storing users, properties, tenants, payments, notices, maintenance tickets, tasks, inventory, and notification logs.

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| E2E | Milestone E2E | Design and build the opaque-box test runner and test cases (Tiers 1-4) | None | PLANNED |
| 1 | Milestone 1 | Fix Vercel production deployment gap (force deployment, verify JS hash) | None | PLANNED |
| 2 | Milestone 2 | Cybersecurity hardening (OWASP Top 10): auth checks, sanitize, logs, clean routes | Milestone 1 | PLANNED |
| 3 | Milestone 3 | Identity & Role tying: Webhook, DB sync, App.jsx routing, tenant onboarding flow verification (including check-email & user sync with tenant_code) | Milestone 2 | PLANNED |
| 4 | Milestone 4 | EazzyRent parity: Bulk notices, Income statement API, M-Pesa badges, Navbar notifications polling, and fully functional tenant portal | Milestone 3 | PLANNED |
| 5 | Milestone 5 | Nielsen/Norman usability: full CRUD, confirmation modals, error toasts, navbar role badge | Milestone 4 | PLANNED |
| 6 | Milestone 6 | Code audit: resolve all TODOs, FIXMEs, stubs, and place-holders across frontend/backend | Milestone 5 | PLANNED |
| 7 | Milestone 7 | E2E Integration and Tier 5 Adversarial Hardening | Milestone 6, E2E | PLANNED |

---

## Interface Contracts
### Clerk Webhook /api/v1/users/webhook
- Handled events: `user.created`, `user.updated`, `user.deleted`
- Payload structure: Standard Clerk Webhook payload containing email, phone, name, metadata
- Behaviour: Updates matching User document in MongoDB using `clerkId`.

### DB User Sync /api/v1/users/sync
- Method: `POST`
- Payload: `{ clerkId, email, phone, name, role, tenant_code }`
- Response: 200 OK with User document `{ _id, clerkId, email, phone, name, role, isActive }`
- Behaviour: Correctly handles `tenant_code` linking and returns a valid user with `role: 'tenant'`.

### Tenant Email Check /api/v1/tenants/check-email
- Method: `GET`
- Query: `email=string`
- Response: 200 OK with `{ exists: boolean, tenant_code: string, has_account: boolean, tenant_name: string }`

### Bulk notices /api/v1/notices/bulk
- Method: `POST`
- Payload: `{ tenantIds: string[], message: string }`
- Response: 200 OK with `{ success: true, count: number }`

### Reports /api/v1/reports/income-statement
- Method: `GET`
- Query: `month=YYYY-MM`
- Response: 200 OK with JSON `{ revenue: number, expenses: number, netIncome: number }`

### Notifications /api/v1/notifications
- Method: `GET`
- Response: 200 OK with unread notifications array

---

## Code Layout
- `backend/`: Node.js Express server files
  - `server.js`: entrypoint
  - `routes/`: backend router files
  - `models/`: Mongoose schemas
  - `middleware/`: custom authentication, authorization, sanitization and security middleware
  - `services/`: messaging, email, payment verification services
- `frontend/`: React Vite app files
  - `src/App.jsx`: central React router and entrypoint
  - `src/pages/`: dashboard and feature pages
  - `src/components/`: common layout and functional UI components
  - `src/components/ui/`: generic UI library components (Button, Card, Modal, etc.)
