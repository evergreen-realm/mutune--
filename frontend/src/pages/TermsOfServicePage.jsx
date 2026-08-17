import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Navigation */}
      <nav className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <FileText size={18} className="text-blue-400" />
          <span className="text-sm font-bold tracking-tight text-white">Terms of Service</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Draft Banner */}
        <div className="mb-10 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">⚠ Draft Template</p>
          <p className="text-sm text-amber-300/80 leading-relaxed">
            These terms of service are a draft template and are pending legal review.
            They do not constitute binding legal counsel until formally executed by Mutune Estate Agency.
          </p>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: August 2026</p>

        {/* 1. Acceptance of Terms */}
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using MutuneRent Pro ("<strong>Platform</strong>"), operated by Mutune Estate Agency
            ("<strong>Company</strong>", "<strong>we</strong>", "<strong>us</strong>"), you agree to be bound by these Terms
            of Service. If you do not agree to these terms, you must not access or use the Platform.
          </p>
        </Section>

        {/* 2. User Roles & Account Eligibility */}
        <Section title="2. Account Registration & User Roles">
          <p className="mb-4">
            The Platform provides specialized role-gated interfaces for Landlords, Property Managers/Agents, Tenants, Caretakers, and Administrators:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm">
            <li><strong>Tenants:</strong> Must provide verified identification (National ID / Passport) and mobile telephone numbers capable of M-Pesa transactions.</li>
            <li><strong>Landlords:</strong> Must provide proof of title or verified management mandate for properties listed on the platform.</li>
            <li><strong>Estate Agents:</strong> Must maintain active Estate Agents Registration Board (EARB) licensure or authorized affiliate certification.</li>
            <li><strong>Administrators:</strong> Subject to strict multi-factor verification and audit log monitoring.</li>
          </ul>
        </Section>

        {/* 3. Rent & Utility Payments */}
        <Section title="3. Financial Transactions & Rent Settlement">
          <p className="mb-4">
            All rent payments, utility bills (MEWASCO water, KPLC electricity), deposits, and service charges processed through
            the Platform are governed by the following terms:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm">
            <li>Payments executed via Safaricom M-Pesa (STK Push or Paybill) are acknowledged upon cryptographic receipt of payment confirmation webhooks.</li>
            <li>Double-entry General Ledger journal records are automatically generated and linked to each transaction.</li>
            <li>Late fees are calculated based on registered lease agreements and local statutes (e.g., standard grace periods up to the 5th of each calendar month).</li>
            <li>Disbursements to landlord accounts are executed according to configured settlement schedules net of agreed property management fees.</li>
          </ul>
        </Section>

        {/* 4. Submetering & Utility Tariffs */}
        <Section title="4. Multi-Provider Water & Utility Submetering">
          <p>
            Water billing follows the Mombasa Water Supply & Sanitation Co. (MEWASCO) Gazette tariff structure,
            calculated on tiered volumetric consumption brackets plus approved sanitation levies. Meter readings captured
            by caretakers or tenants are timestamped and preserved in immutable audit logs.
          </p>
        </Section>

        {/* 5. Limitation of Liability */}
        <Section title="5. Limitation of Liability & Disclaimers">
          <p>
            To the maximum extent permitted by Kenyan law (including the Consumer Protection Act, 2012 and the Law of Contract Act Cap 23),
            Mutune Estate Agency shall not be liable for indirect, punitive, or consequential damages resulting from upstream
            telecommunication network outages, Safaricom Daraja gateway maintenance windows, or utility provider downtime.
          </p>
        </Section>

        {/* 6. Dispute Resolution & Governing Law */}
        <Section title="6. Dispute Resolution & Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of Kenya. Any dispute,
            controversy, or claim arising out of or relating to these Terms shall first be submitted to mediation under the
            Chartered Institute of Arbitrators (Kenya Branch) rules before resorting to competent courts within Mombasa County.
          </p>
        </Section>

        {/* 7. Contact Information */}
        <Section title="7. Contact Information">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-sm leading-relaxed">
            <p className="font-bold text-white mb-2">Mutune Estate Agency</p>
            <p className="text-slate-300">P.O. Box Mombasa, Kenya</p>
            <p className="text-slate-400 mt-2">Email: legal@mutune.co.ke | support@mutune.co.ke</p>
          </div>
        </Section>
      </main>

      <footer className="border-t border-slate-800/60 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Mutune Estate Agency. All rights reserved.
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-4 tracking-tight">{title}</h2>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}
