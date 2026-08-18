import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Eye, ShieldCheck, Printer, CheckCircle2, FileDown, AlertTriangle,
  FileSpreadsheet, Scale, Info, ToggleLeft, ToggleRight, Search, Database, Edit3, ChevronDown } from 'lucide-react';
import { generateLegalPDF, fetchPublicListings } from '../lib/api';
import { exportToExcel } from '../lib/excelExport';
import { toast } from 'react-toastify';
import api from '../lib/api';

const EMPTY_FORM = {
  tenant_name: '', tenant_code: '', national_id: '', phone: '', email: '',
  landlord_name: '', landlord_id_number: '', kra_pin: '',
  property_name: '', property_code: '', unit_number: '', property_address: '',
  rent_amount_kes: '', deposit_amount_kes: '', arrears_kes: '',
  lease_start_date: '', lease_duration_months: 12,
  commission_rate: '10%', agent_name: '',
  case_number: '', demanded_rent_kes: '',
  management_fee_percent: 8, maintenance_kes: 0, net_payout_kes: 0,
};

const DOC_TYPES = [
  { id: 'lease_agreement',              name: 'Tenancy Lease Agreement',        icon: FileText,        desc: 'Official Kenyan property lease with e-signing & stamp duty (Cap 480)', category: 'Lease' },
  { id: 'demand_note_7day',             name: '7-Day Rent Demand Note',         icon: AlertTriangle,   desc: 'Legal notice for overdue rent arrears — S.4(1) Landlord & Tenant Act', category: 'Collections' },
  { id: 'quit_notice_30day',            name: '30-Day Notice to Quit',          icon: FileText,        desc: 'Formal tenancy termination letter — S.4(2) Landlord & Tenant Act',    category: 'Notices' },
  { id: 'landlord_remittance_statement', name: 'Landlord Remittance Statement', icon: FileSpreadsheet, desc: 'Monthly remittance with management fees, deductions & net payout',     category: 'Finance' },
  { id: 'agent_salary_voucher',         name: 'Agent Salary Voucher',           icon: FileDown,        desc: 'Agent commission payout & WHT withholding receipt',                   category: 'Payroll' },
  { id: 'etims_tax_receipt',            name: 'KRA eTIMS Tax Receipt',          icon: ShieldCheck,     desc: 'Official eTIMS compliant tax invoice receipt',                        category: 'Tax' },
  { id: 'rrt_landlord_complaint',       name: 'RRT Landlord Complaint',         icon: Scale,           desc: 'Rent Restriction Tribunal eviction application (Cap 301)',            category: 'Legal' },
  { id: 'rrt_tenant_response',          name: 'RRT Tenant Dispute Response',    icon: Scale,           desc: 'Tribunal dispute filing for unlawful rent increases (Cap 301)',       category: 'Legal' },
];

const CATEGORIES = ['All', ...new Set(DOC_TYPES.map(d => d.category))];

// Fields relevant to each doc type
const DOC_FIELDS = {
  lease_agreement:              ['tenant_name','tenant_code','national_id','phone','landlord_name','property_name','unit_number','property_address','rent_amount_kes','deposit_amount_kes','lease_start_date','lease_duration_months'],
  demand_note_7day:             ['tenant_name','tenant_code','property_name','unit_number','rent_amount_kes','arrears_kes'],
  quit_notice_30day:            ['tenant_name','tenant_code','property_name','unit_number','property_address'],
  landlord_remittance_statement:['landlord_name','kra_pin','property_name','rent_amount_kes','management_fee_percent','maintenance_kes'],
  agent_salary_voucher:         ['agent_name','commission_rate','property_name'],
  etims_tax_receipt:            ['tenant_name','landlord_name','kra_pin','property_name','rent_amount_kes'],
  rrt_landlord_complaint:       ['tenant_name','landlord_name','property_name','unit_number','case_number','arrears_kes','demanded_rent_kes'],
  rrt_tenant_response:          ['tenant_name','landlord_name','property_name','unit_number','case_number','demanded_rent_kes'],
};

const FIELD_LABELS = {
  tenant_name: 'Tenant Full Name', tenant_code: 'Tenant Code', national_id: 'National ID', phone: 'Phone',
  email: 'Email', landlord_name: 'Landlord Name', landlord_id_number: 'Landlord ID', kra_pin: 'KRA PIN',
  property_name: 'Property Name', property_code: 'Property Code', unit_number: 'Unit Number',
  property_address: 'Property Address', rent_amount_kes: 'Monthly Rent (KES)', deposit_amount_kes: 'Deposit (KES)',
  arrears_kes: 'Arrears (KES)', lease_start_date: 'Lease Start Date', lease_duration_months: 'Lease Duration (Months)',
  commission_rate: 'Commission Rate', agent_name: 'Agent Name', case_number: 'RRT Case Number',
  demanded_rent_kes: 'Demanded/Disputed Rent (KES)', management_fee_percent: 'Management Fee (%)',
  maintenance_kes: 'Maintenance Deductions (KES)', net_payout_kes: 'Net Payout (KES)',
};

const NUM_FIELDS = ['rent_amount_kes','deposit_amount_kes','arrears_kes','lease_duration_months','demanded_rent_kes','management_fee_percent','maintenance_kes','net_payout_kes'];

export default function PaperworkSuiteTab() {
  const [loadingDoc, setLoadingDoc] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('lease_agreement');
  const [autoPopulate, setAutoPopulate] = useState(true);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [filterCat, setFilterCat] = useState('All');
  const [exportFormat, setExportFormat] = useState('pdf');

  // Auto-populate: tenant search
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantResults, setTenantResults] = useState([]);
  const [propertyResults, setPropertyResults] = useState([]);
  const [showTenantDD, setShowTenantDD] = useState(false);
  const [showPropertyDD, setShowPropertyDD] = useState(false);

  // Search tenants from API
  useEffect(() => {
    if (!autoPopulate || tenantSearch.length < 2) { setTenantResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/tenants', { params: { search: tenantSearch, limit: 8 } });
        setTenantResults(r?.data?.data || r?.data?.tenants || []);
      } catch { setTenantResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [tenantSearch, autoPopulate]);

  // Load properties
  useEffect(() => {
    if (!autoPopulate) return;
    (async () => {
      try {
        const r = await api.get('/properties', { params: { limit: 50 } });
        setPropertyResults(r?.data?.data || r?.data?.properties || []);
      } catch { setPropertyResults([]); }
    })();
  }, [autoPopulate]);

  const selectTenant = (t) => {
    setFormData(prev => ({
      ...prev,
      tenant_name: t.full_name || t.name || '',
      tenant_code: t.tenant_code || '',
      national_id: t.national_id || '',
      phone: t.phone || '',
      email: t.email || '',
    }));
    setTenantSearch(t.full_name || t.name || '');
    setShowTenantDD(false);
  };

  const selectProperty = (p) => {
    setFormData(prev => ({
      ...prev,
      property_name: p.name || '',
      property_code: p.property_code || '',
      property_address: p.address?.street ? `${p.address.street}, ${p.address.area || ''}` : '',
      landlord_name: p.landlord_name || prev.landlord_name,
    }));
    setShowPropertyDD(false);
  };

  // Stamp Duty Calculation
  const annualRent = (Number(formData.rent_amount_kes) || 0) * 12;
  const durationMonths = Number(formData.lease_duration_months || 12);
  let stampDutyKes = 200, stampDutyRateDesc = 'Flat KES 200 (< 1 yr)';
  if (durationMonths >= 12 && durationMonths <= 36) {
    stampDutyKes = Math.round(annualRent * 0.01);
    stampDutyRateDesc = '1% of Annual Rent (1-3 yrs)';
  } else if (durationMonths > 36) {
    stampDutyKes = Math.round(annualRent * 0.02);
    stampDutyRateDesc = '2% of Annual Rent (> 3 yrs)';
  }

  // Remittance auto-calc
  const mgmtFee = Math.round((Number(formData.rent_amount_kes) || 0) * (Number(formData.management_fee_percent) || 0) / 100);
  const netPayout = (Number(formData.rent_amount_kes) || 0) - mgmtFee - (Number(formData.maintenance_kes) || 0);

  // Visible fields for selected doc
  const visibleFields = DOC_FIELDS[selectedDocType] || Object.keys(FIELD_LABELS);
  const filteredDocs = filterCat === 'All' ? DOC_TYPES : DOC_TYPES.filter(d => d.category === filterCat);

  const handleGeneratePDF = async (docType, isDownload = false) => {
    setLoadingDoc(docType);
    try {
      const payload = { ...formData, stamp_duty_kes: stampDutyKes, net_payout_kes: netPayout };
      const response = await generateLegalPDF(docType, payload);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      if (isDownload) {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${docType}_${formData.tenant_code || 'doc'}_${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success(`Downloaded ${docType}.pdf ✓`);
      } else {
        window.open(url, '_blank');
        toast.info('Opened PDF preview');
      }
    } catch { toast.error('Failed to generate PDF'); }
    finally { setLoadingDoc(null); }
  };

  const handleExportExcel = (docType) => {
    const doc = DOC_TYPES.find(d => d.id === docType);
    const fields = DOC_FIELDS[docType] || Object.keys(FIELD_LABELS);
    const row = {};
    fields.forEach(f => { row[f] = formData[f] || ''; });
    if (docType === 'lease_agreement') { row.stamp_duty_kes = stampDutyKes; row.annual_rent_kes = annualRent; }
    if (docType === 'landlord_remittance_statement') { row.management_fee_kes = mgmtFee; row.net_payout_kes = netPayout; }

    const columns = fields.map(f => ({ key: f, label: FIELD_LABELS[f] || f }));
    if (docType === 'lease_agreement') {
      columns.push({ key: 'stamp_duty_kes', label: 'Stamp Duty (KES)' });
      columns.push({ key: 'annual_rent_kes', label: 'Annual Rent (KES)' });
    }
    if (docType === 'landlord_remittance_statement') {
      columns.push({ key: 'management_fee_kes', label: 'Management Fee (KES)' });
      columns.push({ key: 'net_payout_kes', label: 'Net Payout (KES)' });
    }

    exportToExcel([row], columns, `${doc?.name || docType}`, doc?.name || 'Document');
    toast.success(`Exported ${doc?.name} to Excel ✓`);
  };

  const handlePrint = (docType) => {
    handleGeneratePDF(docType, false);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: NUM_FIELDS.includes(field) ? Number(value) || 0 : value,
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <FileText size={20} />
            </div>
            <h2 className="text-lg font-black tracking-tight text-white">
              Enterprise Document Generator
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Generate legal documents as PDF, Excel, or print-ready format. Auto-populate from database or enter manually.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto/Manual Toggle */}
          <button
            onClick={() => { setAutoPopulate(!autoPopulate); if (autoPopulate) setFormData({ ...EMPTY_FORM }); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
              autoPopulate
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoPopulate ? <><Database size={13} /> Auto-fill from DB</> : <><Edit3 size={13} /> Manual Entry</>}
          </button>
          {/* Export Format */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg border border-slate-700">
            {['pdf', 'excel'].map(f => (
              <button key={f} onClick={() => setExportFormat(f)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${exportFormat === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              filterCat === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Auto-populate Selectors */}
      {autoPopulate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/15">
          {/* Tenant Search */}
          <div className="relative">
            <label className="block text-[10px] text-emerald-400 font-bold uppercase mb-1">Search Tenant</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={tenantSearch} placeholder="Type tenant name or code..."
                onChange={e => { setTenantSearch(e.target.value); setShowTenantDD(true); }}
                onFocus={() => setShowTenantDD(true)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
              />
            </div>
            {showTenantDD && tenantResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {tenantResults.map((t, i) => (
                  <button key={i} onClick={() => selectTenant(t)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs text-white border-b border-slate-800/50 last:border-0">
                    <span className="font-bold">{t.full_name || t.name}</span>
                    <span className="text-slate-400 ml-2">{t.tenant_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Property Select */}
          <div className="relative">
            <label className="block text-[10px] text-emerald-400 font-bold uppercase mb-1">Select Property</label>
            <button onClick={() => setShowPropertyDD(!showPropertyDD)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white text-left flex items-center justify-between">
              {formData.property_name || 'Select property...'} <ChevronDown size={13} className="text-slate-500" />
            </button>
            {showPropertyDD && propertyResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {propertyResults.map((p, i) => (
                  <button key={i} onClick={() => selectProperty(p)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-xs text-white border-b border-slate-800/50 last:border-0">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-slate-400 ml-2">{p.property_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {filteredDocs.map((doc) => {
          const Icon = doc.icon;
          const isSelected = selectedDocType === doc.id;
          return (
            <div key={doc.id} onClick={() => setSelectedDocType(doc.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                isSelected ? 'bg-slate-800/80 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{doc.category}</span>
                  {isSelected && <CheckCircle2 size={14} className="text-indigo-400" />}
                </div>
              </div>
              <h3 className="text-xs font-bold text-white mb-0.5">{doc.name}</h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">{doc.desc}</p>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/60">
                <button onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.id, false); }}
                  disabled={loadingDoc === doc.id} title="Preview PDF"
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-700">
                  <Eye size={11} /> Preview
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.id, true); }}
                  disabled={loadingDoc === doc.id} title="Download PDF"
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                  <Download size={11} /> PDF
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleExportExcel(doc.id); }}
                  title="Download Excel"
                  className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1">
                  <FileSpreadsheet size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stamp Duty Advisory */}
      {selectedDocType === 'lease_agreement' && Number(formData.rent_amount_kes) > 0 && (
        <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400"><Info size={16} /></div>
            <div>
              <p className="font-bold text-sky-300">KRA Stamp Duty: KES {stampDutyKes.toLocaleString('en-KE')}</p>
              <p className="text-[10px] text-sky-400/80">{stampDutyRateDesc} — Annual Rent: KES {annualRent.toLocaleString('en-KE')}</p>
            </div>
          </div>
          <span className="text-[9px] font-mono text-sky-400 uppercase font-bold px-2 py-1 bg-sky-500/10 rounded-lg border border-sky-500/20 self-start sm:self-auto">
            e-Slip Ready
          </span>
        </div>
      )}

      {/* Remittance Summary */}
      {selectedDocType === 'landlord_remittance_statement' && Number(formData.rent_amount_kes) > 0 && (
        <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span className="font-bold text-emerald-300">Remittance Calculation</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-slate-950/60">
              <p className="text-[9px] text-slate-500">Gross Rent</p>
              <p className="font-bold text-white">KES {Number(formData.rent_amount_kes).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60">
              <p className="text-[9px] text-slate-500">Mgmt Fee ({formData.management_fee_percent}%)</p>
              <p className="font-bold text-amber-400">- KES {mgmtFee.toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60">
              <p className="text-[9px] text-slate-500">Maintenance</p>
              <p className="font-bold text-amber-400">- KES {Number(formData.maintenance_kes).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
              <p className="text-[9px] text-emerald-500">Net Payout</p>
              <p className="font-black text-emerald-400">KES {netPayout.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Document Parameters Form */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">
            {DOC_TYPES.find(d => d.id === selectedDocType)?.name} — Parameters
          </h3>
          <button onClick={() => setFormData({ ...EMPTY_FORM })}
            className="text-[10px] text-slate-500 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-all">
            Clear All
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {visibleFields.map(field => (
            <div key={field}>
              <label className="block text-slate-400 font-semibold mb-1 text-[10px] uppercase tracking-wider">{FIELD_LABELS[field]}</label>
              <input
                type={NUM_FIELDS.includes(field) ? 'number' : field === 'lease_start_date' ? 'date' : 'text'}
                value={formData[field] ?? ''}
                placeholder={FIELD_LABELS[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Generate Actions */}
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
        <span className="text-xs font-bold text-slate-300 mr-2">Quick Actions:</span>
        <button onClick={() => handleGeneratePDF(selectedDocType, true)}
          disabled={loadingDoc} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
          <Download size={12} /> Download PDF
        </button>
        <button onClick={() => handleExportExcel(selectedDocType)}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
          <FileSpreadsheet size={12} /> Export Excel
        </button>
        <button onClick={() => handlePrint(selectedDocType)}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5">
          <Printer size={12} /> Print Preview
        </button>
      </div>
    </div>
  );
}
