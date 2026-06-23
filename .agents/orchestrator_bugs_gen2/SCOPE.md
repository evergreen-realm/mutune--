# Scope: MutuneRent Pro Bugs Resolution

## Architecture
MutuneRent Pro is a full-stack React and Express.js property management application.
- **Frontend (React + Vite + Tailwind CSS)**: Interacts with the backend via TanStack Query. Uses Clerk for user authentication.
- **Backend (Node.js + Express + Mongoose/MongoDB)**: Provides REST API endpoints.
- **Storage**: Uses AWS S3 or Cloudflare R2 via `@aws-sdk/client-s3` for file uploads.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| 1 | Exploration & Research | Analyze R1-R11 codebase locations, propose solutions, and compile modern visual layout prototype recommendations (R12) | None | PLANNED |
| 2 | Layout, Theme & UI fixes | R1 (Layout Width/Spacing), R2 (Light Mode contrast), R3 (Search implementation), R4 (Notification dismissal), R11 (Toast feedback) | M1 | PLANNED |
| 3 | Backend and Registry | R5 (Inventory & Tenant Rent updates), R6 (Late Fee rules implementation), R7 (Tenant ID/Code visibility) | M2 | PLANNED |
| 4 | Media & Property config | R8 (Drag-and-Drop S3/R2 upload credentials), R9 (Multi-unit configuration setup) | M3 | PLANNED |
| 5 | Chat Assistant Premium | R10 (Premium ChatAssistant UX, animations & text input contrast fixes) | M4 | PLANNED |
| 6 | E2E Audit & Integration | R13 (Backend Integration validation, zero stubs, production build, forensic audit) | M5 | PLANNED |

## Interface Contracts
## Notification API (`/api/v1/notifications`)
- `DELETE /api/v1/notifications/:id` or similar endpoint for dismissing/clearing a notification.
- Expected response: `200 OK` with deleted status.

### Inventory API (`/api/v1/inventory`)
- `POST /api/v1/inventory`
- Fix schema or route handling issues returning 500 error on add item.

### Tenant Rent API (`/api/v1/tenants/:id/rent` or `/api/v1/tenants/:id`)
- `PUT /api/v1/tenants/:id/rent` or matching endpoint
- Expected behavior: Update tenant's monthly rent amount without returning server errors.

### Late Fee Rule API (`/api/v1/late-fees`)
- `POST /api/v1/late-fees`
- Ensure rules are stored in MongoDB and applied correctly via cron.

### Upload Credentials (S3/R2)
- Validate credentials resolution in `backend/utils/r2.js` and frontend upload payload.
