# PCI-DSS Compliance Attestation & Scope

> **Platform**: MutuneRent Pro  
> **Entity**: Mutune Estate Agency, Mombasa, Kenya  
> **Assessment Date**: August 2026  
> **SAQ Eligibility**: Self-Assessment Questionnaire A (SAQ-A)

---

## 1. Executive Summary

MutuneRent Pro processes digital payments for rent, deposits, and utility bills exclusively via third-party payment service providers. **No credit or debit cardholder data (CHD) or sensitive authentication data (SAD) is ever stored, processed, or transmitted on MutuneRent Pro servers or databases.**

As a result, the platform operates under **PCI-DSS SAQ-A** eligibility criteria.

---

## 2. Payment Architecture & Integration Channels

| Channel | Provider | PCI Status | Scope on MutuneRent |
|---|---|---|---|
| **M-Pesa STK Push** | Safaricom PLC (Daraja API) | Fully Certified Telco | Phone number & transaction ID only. No card data. |
| **M-Pesa C2B / Paybill** | Safaricom PLC (Daraja API) | Fully Certified Telco | Webhook confirmation payload only. |
| **Bank / Card Checkout** | IntaSend Payments | PCI-DSS Level 1 Compliant | Hosted checkout & client-side redirect. No card inputs on our DOM. |
| **B2C Disbursements** | Safaricom PLC (Daraja B2C) | Fully Certified Telco | Bulk payout initiated server-to-server with credentials. |
| **Utility Vending** | Kyanda Africa | Regulated Aggregator | Meter numbers & payment references only. |

---

## 3. SAQ-A Criteria Fulfillment

1. **Card Processing Outsourcing**: All cardholder data handling is 100% outsourced to PCI-DSS validated payment gateways (IntaSend).
2. **No Direct Card Input**: MutuneRent Pro does not host payment card forms or iframes handling primary account numbers (PANs) on its origin server.
3. **No Electronic Storage of Cardholder Data**: No cardholder data is received, processed, or stored in MongoDB Atlas, memory caches, logs, or backups.
4. **Network Segmentation**: Internal servers only receive tokenized transaction references and status webhooks validated via HMAC signatures.
5. **Secure Transmission**: All communications between browser clients, backend APIs, and payment gateways use TLS 1.3 encryption.

---

## 4. Operational Controls & Hygiene

- **Logging**: Application logs (Pino/Winston) and error aggregators (Sentry) strictly exclude PII and authorization headers.
- **Access Control**: Role-based access control (RBAC) restricts payment reconciliation and refund views to authorized administrative personnel.
- **Audit Trails**: All financial transaction records, webhook payloads, and adjustments generate immutable records in `JournalEntry` and `AuditLog` collections.
- **Vulnerability Scanning**: CI/CD pipelines run automated `npm audit` and static analysis checks on every commit.

---

## 5. Annual Review

This compliance document is reviewed annually and updated whenever payment processor integrations or transaction routing workflows are modified.
