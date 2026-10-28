# MutuneRent Pro — Independent Competitor Research & Legal Paperwork Suite (`RESEARCH_REPORT.md`)

**Date**: August 14, 2026  
**Target Market**: Kenya & East Africa Property Management & Legal Accounting Ecosystem  

---

## 1. Executive Overview

Property management in Kenya demands full financial accounting (Chart of Accounts, Journal Entries, Trial Balance, Income Statement, Balance Sheet), M-Pesa/Bank real-time posting, bulk disbursements (landlords, suppliers, staff salaries, tenants), re-enabled self-registration onboarding, single Super Admin role governance, and a legally compliant **Multi-Role Paperwork Suite**.

---

## 2. MutuneRent Pro Target State Capabilities vs. Competitors

| Feature Category | EazzyRent (Primary Target) | Pangoni | SILQU | **MutuneRent Pro Target State** |
|---|---|---|---|---|
| **Full Financial Accounting** | ✅ Full GL | ❌ Basic | ❌ Basic | **✅ Chart of Accounts, Double-Entry Journals, Trial Balance, Income Statement, Balance Sheet, Supplier/Expense Ledger** |
| **M-Pesa & Bank Integrations** | ✅ M-Pesa/Bank | ✅ M-Pesa | ✅ M-Pesa | **✅ Native M-Pesa STK/C2B/B2C & Bank API Real-Time Posting** |
| **Automated Notifications** | ✅ SMS/Email | ✅ SMS | ✅ SMS | **✅ Automated Real-Time SMS & Email Receipts & Reminders** |
| **Bulk Disbursements** | ✅ Landlord/Staff | ❌ Manual | ✅ Remittance | **✅ Priority Bulk Disbursements: 1. Landlords → 2. Agents → 3. Suppliers → 4. Staff → 5. Tenants (Refunds)** |
| **Landlord Self-Registration** | ✅ Enabled | ❌ Admin | ✅ Self/Admin | **✅ Re-enabled Onboarding Self-Reg + Admin & Agent Creation Buttons** |
| **Super Admin Governance** | ✅ Single Admin | ✅ Single Admin | ✅ Auth | **✅ Permanent Single Super Admin + AdminPasswordGuard.jsx Security** |
| **Tenant Vacation & Refund** | ✅ Standard | ❌ Basic | ❌ Basic | **✅ 1-Month Advance Notice (Rent Mandatory) + Agent Move-Out Damage Survey Report PDF** |

---

## 3. The 8 Core Paperwork & Debt Control Processes

Every role in MutuneRent Pro (Super Admin, Admin, Landlord, Agent, Tenant) accesses a standardized 8-process paperwork engine:

1. **Lease Duration Tracking**: Automated monitoring of active tenancy start/end dates.
2. **Lease Expiry Reminders**: System alerts dispatched at 90, 60, and 30 days prior to lease end.
3. **Lease Document Generation**: Auto-compiles tenant, landlord, and property details into official downloadable contracts.
4. **Automatic Rent Increments**: Scheduled annual percentage escalation (e.g. 5% or 10%) applied on lease renewal.
5. **Payment & Due Date Reminders**: SMS/Email prompts dispatched 3 days before rent due date.
6. **Demand Notes (7-Day Arrears Notice)**: Formal notice issued immediately upon grace period expiry for overdue rent.
7. **Quit Notices (30-Day Vacate Notice)**: 1-month advance notice issued prior to termination. Tenant MUST pay rent for final month.
8. **Move-Out Damage Survey & Deposit Refund Report**: Agent conducts physical damage inspection, generates a downloadable **Damage & Deposit Refund Inspection Report PDF**, and posts net deposit refund entry.

---

## 4. Standard Industry Downloadable Legal Document Templates

Below are the exact industry-standard blueprints implemented in `backend/services/paperwork.js` for PDF download across all portals:

### 4.1 Template 1: Official Kenyan Residential Lease Agreement Blueprint

```markdown
REPUBLIC OF KENYA — TENANCY AGREEMENT

THIS AGREEMENT is made this [DAY] day of [MONTH], [YEAR]
BETWEEN:
LANDLORD: [LANDLORD_FULL_NAME], ID No. [LANDLORD_ID], Phone: [LANDLORD_PHONE]
AND
TENANT: [TENANT_FULL_NAME], ID No. [TENANT_ID], Phone: [TENANT_PHONE]

PROPERTY & UNIT DETAILS:
Property Name: [PROPERTY_NAME] (Code: [PROPERTY_CODE])
Unit Number: [UNIT_NUMBER], Floor: [UNIT_FLOOR]
Location: [PROPERTY_STREET], [PROPERTY_AREA], [PROPERTY_CITY]

TERMS AND CONDITIONS:
1. DURATION: [LEASE_DURATION_MONTHS] months commencing [LEASE_START_DATE] to [LEASE_END_DATE].
2. RENT: KES [RENT_AMOUNT_KES] payable on/before 5th via M-Pesa Paybill [PAYBILL_NO] Account [UNIT_NUMBER].
3. RENT INCREMENT: Automatic annual increment of [RENT_INCREMENT_PERCENT]% upon renewal.
4. DEPOSIT: Security deposit of KES [DEPOSIT_AMOUNT_KES].
5. VACATION NOTICE: 1-month written notice required. Final month's rent MUST be paid. Deposit refunded post Move-Out Damage Survey.

IN WITNESS WHEREOF:
Signed by Landlord: ________________________ Date: ____________
Signed by Tenant:   ________________________ Date: ____________
Agent Verification: [AGENT_FULL_NAME], EARB License: [EARB_LICENSE_NO]
```

### 4.2 Template 2: Agent Move-Out Damage & Deposit Refund Inspection Report Blueprint

```markdown
MUTUNERENT PRO — AGENT MOVE-OUT DAMAGE & DEPOSIT REFUND INSPECTION REPORT
REPORT SERIAL NO: [SURVEY_REPORT_ID] | DATE OF INSPECTION: [INSPECTION_DATE]

TENANT DETAILS:
Name: [TENANT_FULL_NAME] | Tenant Code: [TENANT_CODE]
Property: [PROPERTY_NAME] | Unit: [UNIT_NUMBER]
Vacate Notice Date: [NOTICE_DATE] | Actual Vacate Date: [VACATE_DATE]
Final Month Rent Status: PAID IN FULL (M-Pesa Ref: [FINAL_MONTH_MPESA_REF])

INSPECTION FINDINGS & DAMAGE ASSESSMENT:
1. Walls & Paintwork: [PAINT_CONDITION] (Deduction: KES [WALL_DEDUCTION_KES])
2. Fixtures & Plumbing: [PLUMBING_CONDITION] (Deduction: KES [PLUMBING_DEDUCTION_KES])
3. Electrical & Appliances: [ELECTRICAL_CONDITION] (Deduction: KES [ELECTRICAL_DEDUCTION_KES])
4. Keys & Locks Returned: [KEYS_RETURNED_STATUS]

DEPOSIT REFUND CALCULATION:
- Original Security Deposit Held: KES [ORIGINAL_DEPOSIT_KES]
- Less Total Damage Deductions: KES [TOTAL_DEDUCTION_KES]
- Less Outstanding Arrears / Utilities: KES [ARREARS_DEDUCTION_KES]
NET REFUNDABLE DEPOSIT: KES [NET_REFUND_KES]

AGENT CERTIFICATION:
Inspected By Agent: [AGENT_FULL_NAME] (ID: [AGENT_CODE])
Agent Signature: ________________________ Date: ____________
Tenant Acknowledgment: ____________________ Date: ____________

STATUS: APPROVED FOR M-PESA B2C DEPOSIT REFUND DISBURSEMENT
```
