# Scope: Implementation Track

## Architecture
- **Frontend**: React + Vite + Tailwind CSS. Hosted on Vercel. Auth handled via Clerk.
- **Backend**: Node.js + Express. Hosted on Render. DB is MongoDB with Mongoose.
- **Auth**: Clerk integration with webhooks and DB user sync.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Milestone 1 | Vercel production deployment gap & pipeline setup | None | DONE |
| 2 | Milestone 2 | Cybersecurity hardening (OWASP Top 10) | Milestone 1 | IN_PROGRESS |
| 3 | Milestone 3 | User Identity & Role tying (Webhook sync, DB models, App.jsx routing, tenant onboarding) | Milestone 2 | PLANNED |
| 4 | Milestone 4 | Competitive Feature Parity (bulk notices, P&L statement, notifications polling, M-Pesa badges) | Milestone 3 | PLANNED |
| 5 | Milestone 5 | Nielsen/Norman Usability (CRUD actions, form validation, modals, sorting/exporting, role navbar badge) | Milestone 4 | PLANNED |
| 6 | Milestone 6 | Stub audit and code cleanup (TODOs/placeholders removal, scratch files cleanup) | Milestone 5 | PLANNED |
| 7 | Milestone 7 | Pass 100% E2E tests and perform Tier 5 adversarial coverage hardening | Milestone 6 | PLANNED |

## Interface Contracts
- Refer to PROJECT.md at project root for detailed contracts.
- **Tenant Onboarding & Portal Specifics**:
  - `POST /api/v1/users/sync` must link `tenant_code` and map to `role: 'tenant'`.
  - `GET /api/v1/tenants/check-email` must return `{ exists, tenant_code, has_account, tenant_name }`.
  - Frontend `OnboardingPage.jsx` must redirect to `/tenant` upon successful tenant code validation.
  - Tenant Portal `/tenant` must be fully functional.

