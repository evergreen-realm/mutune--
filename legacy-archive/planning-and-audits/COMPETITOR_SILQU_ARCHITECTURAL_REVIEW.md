# Competitor Architectural Review: Silqu Real Estate Operating System

## Executive Overview
**Silqu** is an AI-powered proptech platform operating in Kenya, Uganda, and Rwanda, specializing in automated rent collection, digital utility billing (water & electricity sub-metering), and automated tenant credit scoring.

---

## 1. Architectural Architecture & Workflow Highlights

1. **Automated Utility Meter Billing Integration**:
   - Integrates smart IoT water & electric meters to automatically bill tenants based on consumption (`KPLC / Water Provider Sub-metering`).
   - Generates itemized monthly invoices combining base rent + water unit usage + electricity token charges.

2. **Automated M-Pesa Paybill Routing**:
   - Assigns unique virtual M-Pesa Till/Paybill account numbers per unit (`Paybill: 400200, Account: UNIT-A101`).
   - Webhook automatically routes collected funds to property owner accounts.

3. **Tenant Financial Health Scoring**:
   - Tracks tenant payment punctuality over 12 months, calculating a creditworthiness rating used by landlords before lease renewals.

---

## 2. Eliminated Paper Workflows

- **Manual Utility Sub-meter Reading Cards**: Replaced by automated IoT meter polling & digital invoice attachment.
- **Physical Rent Collection Slips**: Replaced by real-time M-Pesa C2B webhooks & SMS notifications.
- **Paper Eviction & Warning Letters**: Replaced by automated SMS & Email drip sequences for overdue arrears.

---

## 3. Structural Flaws & Architectural Vulnerabilities

1. **High Dependency on Proprietary Hardware**: Utility sub-metering requires physical IoT hardware installation, creating onboarding friction for non-smart properties.
2. **Limited Custom Accounting Controls**: Lacks multi-tier double-entry General Ledger trial balance reporting, focusing primarily on cash flow logs rather than enterprise double-entry accounting.
