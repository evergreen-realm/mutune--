# Competitor Functions Review: Master Functional Matrix

Comprehensive functional inventory across market-leading Kenyan Property Management Systems (EazzyRent, Silqu, Pangoni, PropertyPro, MutuneRent Pro).

---

## Master Functional Comparison Matrix

| Functional Category | Core Sub-Function | EazzyRent | Silqu | Pangoni | MutuneRent Pro |
|---|---|---|---|---|---|
| **Property & Unit Management** | Multi-tier property hierarchy (Block/Floor/Unit) | ✅ | ✅ | ✅ | ✅ |
| | Interactive 3D Building Viewer (Three.js/WebGL) | ❌ | ❌ | ❌ | ✅ (`BuildingPreview3D.jsx`) |
| | Gaussian Splatting 3D Interior Viewer (.splat) | ❌ | ❌ | ❌ | ✅ (`SplatViewerModal.jsx`) |
| | Mapbox Spatial GIS Geo-location Map | ❌ | ❌ | ❌ | ✅ (`MapWidget.jsx`) |
| **Rent Collection & Recon** | Safaricom Daraja M-Pesa C2B Paybill Integration | ✅ | ✅ | ✅ | ✅ (`payments.js`) |
| | 95%+ Confidence Auto-Reconciliation Engine | ✅ | ✅ | ⚠️ Partial | ✅ (`reconciliation.js`) |
| | Unmatched Payment Queue & Agent Manual Match | ✅ | ⚠️ Partial | ⚠️ Partial | ✅ (`UnmatchedPaymentsTab.jsx`) |
| **Financial Accounting** | Chart of Accounts (Asset, Liability, Equity, Income, Exp) | ✅ | ❌ | ⚠️ Partial | ✅ (`Account.js`) |
| | Double-Entry General Ledger (`debit === credit`) | ✅ | ❌ | ❌ | ✅ (`JournalEntry.js`) |
| | Trial Balance & General Ledger Reporting | ✅ | ❌ | ⚠️ Partial | ✅ (`AdminSettingsTab.jsx`) |
| **Agent Payroll & Commission** | Agent Letting Fee % & Management Fee Calculation | ✅ | ❌ | ⚠️ Partial | ✅ (`agentCommission.js`) |
| | Agent Initiation Fees & EARB License Tracking | ⚠️ Partial | ❌ | ❌ | ✅ (`AgentSalary.js`) |
| | Agent Monthly Payroll Approval & B2C Payout | ✅ | ❌ | ❌ | ✅ (`AdminSalaryTab.jsx`) |
| **Priority Bulk Disbursement** | Priority Payout Engine (Landlords → Agents → Suppliers) | ✅ | ⚠️ Partial | ⚠️ Partial | ✅ (`bulkDisbursement.js`) |
| | Safaricom Daraja B2C Batch Payout (Sandbox/Prod) | ✅ | ✅ | ✅ | ✅ (`disbursement.js`) |
| **Tax Compliance** | KRA eTIMS 16% VAT & 7.5% MRI Calculation | ✅ | ❌ | ❌ | ✅ (`etimsTax.js`) |
| | KRA eTIMS Multi-Sheet CSV/Excel Export | ✅ | ❌ | ⚠️ Partial | ✅ (`TaxReportsTab.jsx`) |
| **Legal Paperwork Suite** | Downloadable PDF Tenancy Lease Agreement | ✅ | ✅ | ✅ | ✅ (`pdfGenerator.js`) |
| | Downloadable PDF 7-Day Demand Note (Late Fees) | ✅ | ⚠️ Partial | ✅ | ✅ (`pdfGenerator.js`) |
| | Downloadable PDF 30-Day Notice to Quit & Vacate | ✅ | ❌ | ✅ | ✅ (`pdfGenerator.js`) |
| | Landlord Remittance Statement (KES / USD) | ✅ | ✅ | ✅ | ✅ (`PaperworkSuiteTab.jsx`) |
| | Agent Salary Payout Voucher PDF | ✅ | ❌ | ❌ | ✅ (`pdfGenerator.js`) |
| | KRA eTIMS Official Tax Invoice Receipt PDF | ✅ | ❌ | ❌ | ✅ (`pdfGenerator.js`) |
| **Tenant Move-Out Survey** | 30-Day Move-Out Notice Enforcement | ✅ | ❌ | ✅ | ✅ (`vacation.js`) |
| | Physical Move-Out Damage Survey & Photo Log | ⚠️ Partial | ❌ | ⚠️ Partial | ✅ (`MoveOutInspectionModal.jsx`) |
| | Net Deposit Refund Calculation & Unit Unlock | ✅ | ❌ | ⚠️ Partial | ✅ (`vacation.js`) |
| **Forex & Compliance** | Live CBK USD/KES Exchange Rate Integration | ❌ | ❌ | ⚠️ Partial | ✅ (`cbkExchangeRate.js`) |
| | System Audit Trail Logging (`user`, `ip`, `action`) | ✅ | ⚠️ Partial | ✅ | ✅ (`AuditLog.js`) |
