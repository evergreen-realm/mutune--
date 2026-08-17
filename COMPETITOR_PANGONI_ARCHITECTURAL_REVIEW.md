# Competitor Architectural Review: Pangoni Estate Engine

## Executive Overview
**Pangoni** is a property management software solution in East Africa tailored for high-density residential complexes, commercial plazas, and estate management agencies.

---

## 1. Core Architectural Modules

1. **Vendor & Maintenance Ticketing Hub**:
   - Work order dispatch system matching maintenance tickets with registered external contractors (plumbers, electricians, painters).
   - Contractor invoice approval and automated payout workflow.

2. **Landlord Diaspora Multi-Currency Portal**:
   - Multi-currency ledger supporting KES, USD, GBP, and EUR for international property investors.

3. **Tenant Onboarding & Document Verification**:
   - Identity verification against national ID / Passport and employment verification.

---

## 2. Eliminated Paper Workflows

- **Paper Job Cards & Maintenance Vouchers**: Replaced by digital maintenance ticket lifecycle (`open -> assigned -> completed -> paid`).
- **Physical Banking Deposit Slips**: Replaced by automated M-Pesa & Bank API reconciliation.
- **Physical Landlord Remittance Statements**: Replaced by downloadable PDF statement with multi-currency conversion.

---

## 3. Structural Flaws & Competitor Vulnerabilities

1. **Manual KRA eTIMS Tax Compliance**: Requires exported reports to be manually re-formatted before uploading to KRA iTax, creating tax compliance friction.
2. **Missing Integrated 3D/Spatial Visualization**: Uses standard flat table layouts, lacking interactive 3D building visualization or WebGL spatial unit previews.
