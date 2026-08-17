import React, { useState } from 'react';
import { FileText, Download, Eye, ShieldCheck, Printer, CheckCircle2, FileDown, AlertTriangle, FileSpreadsheet, Scale, Info } from 'lucide-react';
import { generateLegalPDF } from '../lib/api';
import { toast } from 'react-toastify';

export default function PaperworkSuiteTab() {
  const [loadingDoc, setLoadingDoc] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('lease_agreement');
  const [formData, setFormData] = useState({
    tenant_name: 'John Doe',
    tenant_code: 'TNT-1002',
    landlord_name: 'Samuel Mutune',
    property_name: 'Mombasa Ocean Palms',
    unit_number: 'A-104',
    rent_amount_kes: 45000,
    deposit_amount_kes: 45000,
    arrears_kes: 45000,
    lease_duration_months: 12,
    commission_rate: '10%',
    case_number: '2026/042',
    demanded_rent_kes: 58000
  });

  const docTypes = [
    { id: 'lease_agreement', name: 'Tenancy Lease Agreement', icon: FileText, desc: 'Official Kenyan property lease with e-signing & stamp duty' },
    { id: 'demand_note_7day', name: '7-Day Rent Demand Note', icon: AlertTriangle, desc: 'Legal notice for overdue rent arrears' },
    { id: 'quit_notice_30day', name: '30-Day Notice to Quit', icon: FileText, desc: 'Formal tenancy termination letter' },
    { id: 'landlord_remittance_statement', name: 'Landlord Remittance Statement', icon: FileSpreadsheet, desc: 'Monthly remittance statement with KES/USD dual display' },
    { id: 'agent_salary_voucher', name: 'Agent Salary Voucher', icon: FileDown, desc: 'Agent commission payout & tax withholding receipt' },
    { id: 'etims_tax_receipt', name: 'KRA eTIMS Tax Receipt', icon: ShieldCheck, desc: 'Official eTIMS tax invoice receipt' },
    { id: 'rrt_landlord_complaint', name: 'RRT Landlord Complaint', icon: Scale, desc: 'Rent Restriction Tribunal eviction application (Cap 301)' },
    { id: 'rrt_tenant_response', name: 'RRT Tenant Dispute Response', icon: Scale, desc: 'Tribunal dispute filing for unlawful rent increases' }
  ];

  // Stamp Duty Live Calculation (Kenya Stamp Duty Act Cap 480)
  const annualRent = (formData.rent_amount_kes || 0) * 12;
  const durationMonths = Number(formData.lease_duration_months || 12);
  let stampDutyKes = 200;
  let stampDutyRateDesc = 'Flat KES 200 (< 1 yr)';
  if (durationMonths >= 12 && durationMonths <= 36) {
    stampDutyKes = Math.round(annualRent * 0.01);
    stampDutyRateDesc = '1% of Annual Rent (1-3 yrs)';
  } else if (durationMonths > 36) {
    stampDutyKes = Math.round(annualRent * 0.02);
    stampDutyRateDesc = '2% of Annual Rent (> 3 yrs)';
  }

  const handleGeneratePDF = async (docType, isDownload = false) => {
    setLoadingDoc(docType);
    try {
      const response = await generateLegalPDF(docType, formData);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      if (isDownload) {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${docType}_${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success(`Downloaded ${docType}.pdf successfully ✓`);
      } else {
        window.open(url, '_blank');
        toast.info('Opened PDF preview in new window');
      }
    } catch (err) {
      toast.error('Failed to generate legal PDF document');
    } finally {
      setLoadingDoc(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <FileText size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              Multi-Role Legal Paperwork & Document Generator
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Generate, preview, and download official PDF agreements, demand notes, remittance statements, eTIMS receipts, and Rent Restriction Tribunal (RRT) filings.
          </p>
        </div>
      </div>

      {/* Document Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {docTypes.map((doc) => {
          const Icon = doc.icon;
          const isSelected = selectedDocType === doc.id;
          return (
            <div
              key={doc.id}
              onClick={() => setSelectedDocType(doc.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-slate-800/80 border-indigo-500 shadow-xl shadow-indigo-500/10'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon size={18} />
                </div>
                {isSelected && <CheckCircle2 size={16} className="text-indigo-400" />}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{doc.name}</h3>
              <p className="text-[11px] text-slate-400">{doc.desc}</p>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/60">
                <button
                  onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.id, false); }}
                  disabled={loadingDoc === doc.id}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-700"
                >
                  <Eye size={12} /> Preview
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.id, true); }}
                  disabled={loadingDoc === doc.id}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md shadow-indigo-600/20"
                >
                  <Download size={12} /> Download
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stamp Duty Advisory Card for Lease Agreement */}
      {selectedDocType === 'lease_agreement' && (
        <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/20 text-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
              <Info size={18} />
            </div>
            <div>
              <p className="font-bold text-sky-300">KRA Stamp Duty Assessment (Cap 480): KES {stampDutyKes.toLocaleString('en-KE')}</p>
              <p className="text-[11px] text-sky-400/80">Applied: {stampDutyRateDesc} on Annual Rent of KES {annualRent.toLocaleString('en-KE')}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-sky-400 uppercase font-bold tracking-wider px-2.5 py-1 bg-sky-500/10 rounded-lg border border-sky-500/20">
            e-Slip Ready
          </span>
        </div>
      )}

      {/* Interactive Form Parameters Editor */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Document Parameters Editor</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Tenant Full Name</label>
            <input
              type="text"
              value={formData.tenant_name}
              onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Property Name</label>
            <input
              type="text"
              value={formData.property_name}
              onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Unit Number</label>
            <input
              type="text"
              value={formData.unit_number}
              onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Rent Amount (KES)</label>
            <input
              type="number"
              value={formData.rent_amount_kes}
              onChange={(e) => setFormData({ ...formData, rent_amount_kes: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Lease Duration (Months)</label>
            <input
              type="number"
              value={formData.lease_duration_months}
              onChange={(e) => setFormData({ ...formData, lease_duration_months: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Overdue Arrears (KES)</label>
            <input
              type="number"
              value={formData.arrears_kes}
              onChange={(e) => setFormData({ ...formData, arrears_kes: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">RRT Case Number</label>
            <input
              type="text"
              value={formData.case_number}
              onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Demanded / Disputed Rent (KES)</label>
            <input
              type="number"
              value={formData.demanded_rent_kes}
              onChange={(e) => setFormData({ ...formData, demanded_rent_kes: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Commission Rate</label>
            <input
              type="text"
              value={formData.commission_rate}
              onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
