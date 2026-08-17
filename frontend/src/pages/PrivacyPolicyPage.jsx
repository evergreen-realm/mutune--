import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Navigation */}
      <nav className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <Shield size={18} className="text-blue-400" />
          <span className="text-sm font-bold tracking-tight text-white">Privacy Policy</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Draft Banner */}
        <div className="mb-10 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">⚠ Draft Template</p>
          <p className="text-sm text-amber-300/80 leading-relaxed">
            This privacy policy is a draft template and is pending legal review.
            It does not constitute legal advice. A qualified advocate should review
            this document before it is published as a binding policy.
          </p>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: August 2026</p>

        {/* 1. Introduction */}
        <Section title="1. Introduction">
          <p>
            MutuneRent Pro ("<strong>Platform</strong>") is a property management platform
            operated by Mutune Estate Agency ("<strong>Data Controller</strong>"), located
            in Mombasa, Kenya. This Privacy Policy explains how we collect, use, store,
            and protect personal data in compliance with the{' '}
            <strong>Kenya Data Protection Act, 2019</strong> (DPA 2019) and the regulations
            issued by the Office of the Data Protection Commissioner (ODPC).
          </p>
        </Section>

        {/* 2. Data We Collect */}
        <Section title="2. Data We Collect">
          <p className="mb-4">We collect the following categories of personal data:</p>
          <DataTable rows={[
            ['Identity Data', 'Full name, national ID number, KRA PIN, email, phone number'],
            ['Financial Data', 'M-Pesa transaction IDs, payment amounts, bank account references, rent balances'],
            ['Property Data', 'Property addresses, GPS coordinates (Plus Codes), unit details, lease terms'],
            ['Usage Data', 'Login timestamps, page views, feature interactions, IP addresses'],
            ['Location Data', 'Agent check-in GPS coordinates (only for estate agents during work hours)'],
            ['Communication Data', 'SMS messages sent via Africa\'s Talking, email notifications via Resend'],
            ['Media Data', 'Property photos, verification documents, maintenance ticket images, 3D room scans'],
            ['Device Data', 'Browser type, operating system, device identifiers (for analytics via PostHog)'],
          ]} />
        </Section>

        {/* 3. Legal Basis */}
        <Section title="3. Legal Basis for Processing">
          <p className="mb-4">
            Under Section 30 of the DPA 2019, we process personal data on the following legal bases:
          </p>
          <DataTable rows={[
            ['Contractual Necessity', 'Processing rent payments, managing lease agreements, tenant onboarding'],
            ['Legal Obligation', 'KRA eTIMS tax invoice transmission, statutory notice generation, audit logging'],
            ['Legitimate Interest', 'Platform analytics, fraud detection, agent geo-tracking for accountability'],
            ['Consent', 'Marketing communications, optional AI chat usage, PostHog analytics (opt-in)'],
          ]} />
        </Section>

        {/* 4. Third-Party Data Sharing */}
        <Section title="4. Third-Party Data Sharing">
          <p className="mb-4">
            We share personal data with the following third parties strictly as required for
            Platform operations. We do not sell personal data.
          </p>
          <DataTable rows={[
            ['Safaricom (M-Pesa Daraja)', 'Phone numbers, payment amounts — for STK Push, C2B callbacks, and B2C disbursements'],
            ['Kenya Revenue Authority (KRA)', 'KRA PINs, invoice amounts — for eTIMS electronic tax compliance'],
            ['Africa\'s Talking', 'Phone numbers — for SMS notifications and USSD gateway'],
            ['Kyanda', 'Meter numbers — for KPLC/water utility token vending and bill queries'],
            ['Cloudflare (R2)', 'Property photos, PDFs, 3D assets — for cloud object storage'],
            ['Clerk', 'Email, name — for authentication and session management'],
            ['Resend', 'Email addresses — for transactional email delivery (notices, onboarding)'],
            ['Moonshot AI (Kimi)', 'Chat messages (no PII) — for AI-powered tenant/agent assistance'],
            ['Sentry', 'Error metadata (no PII) — for application error tracking and diagnostics'],
            ['PostHog', 'Anonymized usage events — for product analytics (opt-in)'],
          ]} />
        </Section>

        {/* 5. Data Retention */}
        <Section title="5. Data Retention">
          <DataTable rows={[
            ['Payment Records', '7 years (KRA requirement under the Income Tax Act)'],
            ['Lease Agreements', 'Duration of tenancy + 3 years'],
            ['Audit Logs', '5 years (compliance trail)'],
            ['Agent Location Data', '90 days (rolling, then aggregated)'],
            ['User Account Data', 'Until account deletion request + 30-day grace period'],
            ['Maintenance Tickets', 'Duration of tenancy + 1 year'],
            ['AI Chat Logs', '30 days (auto-purged)'],
          ]} />
        </Section>

        {/* 6. Data Security */}
        <Section title="6. Data Security">
          <p className="mb-4">
            We implement technical and organizational measures to protect personal data:
          </p>
          <ul className="space-y-2 text-sm text-slate-300 leading-relaxed list-disc list-inside">
            <li>AES-256-GCM encryption of sensitive PII fields at rest</li>
            <li>HMAC-SHA256 blind indexes for searchable encrypted fields</li>
            <li>TLS 1.3 encryption for all data in transit</li>
            <li>MongoDB Atlas encryption at rest with AWS KMS</li>
            <li>IP whitelist for M-Pesa callbacks (Safaricom CIDR ranges)</li>
            <li>Role-based access control (RBAC) with Clerk session tokens</li>
            <li>Rate limiting on all API endpoints</li>
            <li>Input sanitization against NoSQL injection and XSS</li>
            <li>Audit logging of all administrative and financial actions</li>
          </ul>
        </Section>

        {/* 7. Data Subject Rights */}
        <Section title="7. Your Rights (DPA 2019 Sections 26–32)">
          <p className="mb-4">
            As a data subject under Kenyan law, you have the following rights:
          </p>
          <DataTable rows={[
            ['Right of Access (s.26)', 'Request a copy of all personal data we hold about you'],
            ['Right to Rectification (s.27)', 'Request correction of inaccurate or incomplete data'],
            ['Right to Erasure (s.28)', 'Request deletion of your data (subject to legal retention obligations)'],
            ['Right to Restrict Processing (s.29)', 'Request limitation of processing in certain circumstances'],
            ['Right to Data Portability (s.30)', 'Request your data in a structured, machine-readable format'],
            ['Right to Object (s.31)', 'Object to processing based on legitimate interest or direct marketing'],
            ['Right Not to be Subject to Automated Decisions (s.32)', 'Object to decisions made solely by automated means'],
          ]} />
          <p className="mt-4">
            To exercise any of these rights, contact us at the address below. We will respond
            within <strong>30 days</strong> as required by the DPA 2019.
          </p>
        </Section>

        {/* 8. Cookies */}
        <Section title="8. Cookies & Local Storage">
          <p>
            The Platform uses essential cookies and browser local storage for authentication
            session management (Clerk), theme preferences, and role verification state.
            We do not use third-party advertising cookies. Analytics cookies (PostHog) are
            loaded only when the <code className="text-blue-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">VITE_POSTHOG_KEY</code> environment
            variable is configured and can be opted out of via browser settings.
          </p>
        </Section>

        {/* 9. Children's Data */}
        <Section title="9. Children's Data">
          <p>
            The Platform is not intended for use by individuals under the age of 18. We do not
            knowingly collect personal data from children. If you believe a child has provided
            us with personal data, please contact us immediately.
          </p>
        </Section>

        {/* 10. International Transfers */}
        <Section title="10. International Data Transfers">
          <p>
            Some of our service providers process data outside Kenya (e.g., Cloudflare in
            globally distributed data centers, Clerk in the United States, Sentry in the EU).
            Where personal data is transferred outside Kenya, we ensure adequate safeguards
            are in place as required by Section 48 of the DPA 2019, including standard
            contractual clauses and adequacy determinations by the ODPC.
          </p>
        </Section>

        {/* 11. Changes */}
        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be
            communicated via in-app notification and email to registered users. The "Last
            updated" date at the top of this page indicates the most recent revision.
          </p>
        </Section>

        {/* 12. Contact */}
        <Section title="12. Data Controller & Contact Information">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-sm leading-relaxed">
            <p className="font-bold text-white mb-3">Mutune Estate Agency</p>
            <p className="text-slate-300">Data Controller under the Kenya Data Protection Act, 2019</p>
            <div className="mt-4 space-y-1 text-slate-400">
              <p><strong className="text-slate-300">Address:</strong> Mombasa, Kenya</p>
              <p><strong className="text-slate-300">Email:</strong> privacy@mutune.co.ke</p>
              <p><strong className="text-slate-300">Phone:</strong> +254 XXX XXX XXX</p>
            </div>
            <p className="mt-4 text-slate-500 text-xs">
              For complaints that cannot be resolved directly, you may contact the
              Office of the Data Protection Commissioner (ODPC) at{' '}
              <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:underline">www.odpc.go.ke</a>.
            </p>
          </div>
        </Section>
      </main>

      <footer className="border-t border-slate-800/60 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Mutune Estate Agency. All rights reserved.
      </footer>
    </div>
  );
}

/* ── Helper components ─────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-4 tracking-tight">{title}</h2>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

function DataTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, desc], i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'}>
              <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap border-r border-slate-700/30 w-1/3">
                {label}
              </td>
              <td className="px-4 py-3 text-slate-400">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
