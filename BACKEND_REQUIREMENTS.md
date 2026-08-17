# MutuneRent Pro — Independent Backend Architecture & Security Requirements (`BACKEND_REQUIREMENTS.md`)

**Date**: August 14, 2026  
**Audience**: Backend Lead Engineers & Security Auditors  

---

## 1. Executive Summary

This document specifies the backend architectural additions, security boundaries, database schema changes, and service integrations required to transform MutuneRent Pro into a full-scale financial property management engine.

---

## 2. Mandatory New Backend Schemas & Security Rules

### 2.1 Mongoose Schemas (`backend/models/`)

#### 1. `backend/models/AgentSalary.js`
- Payroll Mongoose schema tracking agent commission calculations and payouts.

#### 2. `backend/models/CommissionConfig.js`
- Admin-configurable document for global commission rates, tax parameters, disbursement priority, and eTIMS credentials.

#### 3. `backend/models/AgentCommissionOverride.js`
- Per-agent or per-property custom commission rate overrides.

#### 4. `backend/models/PropertyContract.js`
- Signed property management agreement terms, agency commission %, management fee rates, and remittance account details.

#### 5. `backend/models/Account.js`
- Chart of Accounts schema supporting Asset, Liability, Equity, Income, and Expense categories.

#### 6. `backend/models/JournalEntry.js`
- Double-entry ledger schema with pre-save validation enforcing `total_debit === total_credit`.

#### 7. `backend/models/DamageInspectionReport.js`
- Move-out damage survey findings, itemized damage deductions, and deposit refund calculation.

#### 8. `backend/models/AuditLog.js`
- Immutable financial action log schema (`user_id`, `action`, `target_id`, `ip_address`, `timestamp`).

---

### 2.2 Core Backend Services (`backend/services/`)

#### 1. `backend/services/paperwork.js`
- PDF compilation service generating official downloadable PDFs for:
  1. Kenyan Residential Lease Agreements
  2. 7-Day Arrears Demand Notes
  3. 30-Day Quit / Vacate Notices
  4. Agent Move-Out Damage & Deposit Refund Inspection Reports
  5. Official KRA eTIMS Digital Payment Receipts
  6. Landlord Remittance Payout Vouchers
  7. Agent Monthly Salary & Commission Vouchers

#### 2. `backend/services/bulkDisbursement.js`
- Priority-based bulk payout engine: **1. Landlords → 2. Agents → 3. Suppliers → 4. Staff → 5. Tenants (Deposit Refunds)** via Daraja B2C API (Sandbox first, then Production).

#### 3. `backend/services/exchangeRate.js`
- Live Central Bank of Kenya (CBK) exchange rate API integration for KES to USD conversion on Landlord statements.

---

### 2.3 Security Rules & REST API Routes (`backend/routes/`)

#### 1. Single Super Admin & Admin Self-Registration Security Rules
- **Single Super Admin**: Exactly 1 permanent Super Admin account holding master authority over all roles.
- **Admin Self-Registration**: Re-enabled Admin self-registration in `OnboardingPage.jsx` / `SignUpPage.jsx` requiring full name and email during registration. Access to administrative controls is strictly gated by mandatory `ADMIN_HARDCODED_PASSWORD` verification (`AdminPasswordGuard.jsx`).

#### 2. Re-enabled Landlord & Admin Self-Registration Routes (`backend/routes/users.js`)
- `POST /api/v1/users/landlord-self-register` – Re-enabled self-registration for prospective landlords (`landlord_approval_status: 'pending'`).
- `POST /api/v1/users/admin-self-register` – Re-enabled self-registration for admin applicants (requires full name, gated by `AdminPasswordGuard.jsx`).
- `POST /api/v1/users/landlord-manual` – Direct landlord creation accessible by `admin`, `super_admin`, and `agent` roles.

#### 3. Tenant 1-Month Notice & Move-Out Damage Survey Routes (`backend/routes/tenants.js`)
- `POST /api/v1/tenants/:id/terminate` – Accepts 30-day advance notice (`vacate_date`). Enforces final month rent payment.
- `POST /api/v1/tenants/:id/moveout-survey` – Accepts agent damage inspection findings, generates downloadable **Damage Inspection Report PDF**, posts deposit refund entry to GL, and releases unit.
