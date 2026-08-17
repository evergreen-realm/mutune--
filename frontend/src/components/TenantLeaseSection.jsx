import React from 'react';
import { FileText, ShieldCheck, Key, FileCheck, Download } from 'lucide-react';
import { requestLeaseSigningOTP, verifyAndSignLease, generateLegalPDF } from '../lib/api';
import { toast } from 'react-toastify';

export default function TenantLeaseSection({
  profile,
  leaseSignature,
  setLeaseSignature,
  signingOtp,
  setSigningOtp,
  otpRequested,
  setOtpRequested,
  signingLoading,
  setSigningLoading
}) {
  const handleRequestOtp = async () => {
    setSigningLoading(true);
    try {
      const res = await requestLeaseSigningOTP({
        tenant_id: profile?._id,
        phone_number: profile?.phone
      });
      if (res?.data?.success) {
        setOtpRequested(true);
        toast.success(`6-Digit OTP sent to ${res.data.phone_masked || profile?.phone} ✓`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to dispatch OTP');
    } finally {
      setSigningLoading(false);
    }
  };

  const handleVerifyAndSign = async () => {
    if (!signingOtp || signingOtp.length < 6) {
      toast.error('Please enter the 6-digit OTP code sent via SMS');
      return;
    }
    setSigningLoading(true);
    try {
      const res = await verifyAndSignLease({
        tenant_id: profile?._id,
        unit_id: profile?.current_unit_id,
        property_id: profile?.current_property_id?._id,
        otp_code: signingOtp.trim(),
        agreed_terms: true
      });
      if (res?.data?.success) {
        setLeaseSignature(res.data.data);
        toast.success('Lease agreement digitally signed & verified! ✓');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Invalid or expired OTP');
    } finally {
      setSigningLoading(false);
    }
  };

  const handleDownloadSignedLease = async () => {
    try {
      const response = await generateLegalPDF('lease', {
        tenant_name: profile?.full_name,
        tenant_phone: profile?.phone,
        tenant_national_id: profile?.national_id || 'ID-REDACTED',
        property_name: profile?.current_property_id?.name || 'Mutune Residential',
        unit_number: profile?.unit_number || 'Unit 1',
        rent_amount: profile?.rent_amount_kes || 25000,
        deposit_amount: profile?.deposit_amount_kes || 25000,
        lease_duration_months: 12,
        is_digitally_signed: true,
        signature_hash: leaseSignature?.verification_hash || 'SHA256-MUTUNE-SECURE-LEAD-9988',
        signed_at: leaseSignature?.signed_at || new Date().toISOString()
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Signed_Lease_${profile?.tenant_code || 'Tenancy'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded signed lease agreement ✓');
    } catch (err) {
      toast.error('Failed to download signed lease');
    }
  };

  return (
    <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-indigo-400" /> Digital Lease Agreement & Attestation
          </h2>
          <p className="text-xs text-muted mt-1">2-Step OTP Verified Electronic Signature with Stamp Duty Compliance.</p>
        </div>
        {leaseSignature?.status === 'signed' && (
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 self-start">
            <ShieldCheck size={14} /> Digitally Signed
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Tenancy Terms Summary */}
        <div className="p-5 rounded-2xl bg-surface/50 border border-border space-y-3">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Tenancy Agreement Details</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted">Tenant Name:</span>
              <span className="font-bold text-foreground">{profile?.full_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted">Registered Phone:</span>
              <span className="font-bold text-foreground">{profile?.phone || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted">Property & Unit:</span>
              <span className="font-bold text-foreground">{profile?.current_property_id?.name || 'Mutune Estate'} • {profile?.unit_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted">Monthly Rent:</span>
              <span className="font-bold text-emerald-400">KES {Number(profile?.rent_amount_kes || 0).toLocaleString('en-KE')}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">Stamp Duty (Cap 480):</span>
              <span className="font-bold text-foreground">KES 200.00 (Fixed Rate &lt; 1 Year)</span>
            </div>
          </div>
        </div>

        {/* Right Column: 2-Step E-Signing Interface */}
        <div className="p-5 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between">
          {leaseSignature?.status === 'signed' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <FileCheck size={16} /> Signed on {new Date(leaseSignature.signed_at).toLocaleString()}
                </p>
                <p className="text-[11px] text-muted font-mono break-all">
                  SHA-256 Hash: {leaseSignature.verification_hash || 'SHA256-MUTUNE-SECURE-LEAD-9988'}
                </p>
              </div>
              <button
                onClick={handleDownloadSignedLease}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-indigo-950/40 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download Signed PDF Lease
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Step 2: Authenticate & Sign</h4>
                <p className="text-xs text-muted">Click below to receive a secure 6-digit OTP on your phone.</p>
              </div>

              {!otpRequested ? (
                <button
                  onClick={handleRequestOtp}
                  disabled={signingLoading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-indigo-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Key size={14} /> {signingLoading ? 'Sending OTP…' : 'Send 6-Digit Signing OTP'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Enter 6-Digit SMS Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 849201"
                      value={signingOtp}
                      onChange={(e) => setSigningOtp(e.target.value)}
                      className="w-full bg-surface border border-border focus:border-indigo-500 rounded-xl px-4 py-2.5 text-center text-base font-mono font-black text-foreground tracking-widest outline-none"
                    />
                  </div>
                  <button
                    onClick={handleVerifyAndSign}
                    disabled={signingLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck size={14} /> {signingLoading ? 'Signing…' : 'Authorize & Sign Lease'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
