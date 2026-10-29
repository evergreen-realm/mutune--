import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, ShieldCheck, Printer, CheckCircle2, FileDown, AlertTriangle,
  FileSpreadsheet, Scale, Info, Search, Database, Edit3, ChevronDown, X, Building, Award, Stamp } from 'lucide-react';
import { generateLegalPDF, extractPdfBlob } from '../lib/api';
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
  {
    id: 'lease_agreement',
    name: 'Tenancy Lease Agreement',
    icon: FileText,
    desc: 'Official Kenyan property lease with e-signing & Cap 480 stamp duty schedule',
    category: 'Lease',
    statute: 'Cap 480 & Land Act 2012',
    accentColor: '#059669',
    badge: 'LEGAL CONTRACT'
  },
  {
    id: 'demand_note_7day',
    name: '7-Day Rent Demand Note',
    icon: AlertTriangle,
    desc: 'Formal statutory notice for rent arrears prior to distress under Cap 293',
    category: 'Collections',
    statute: 'Cap 293 Distress for Rent',
    accentColor: '#dc2626',
    badge: 'URGENT DEMAND'
  },
  {
    id: 'quit_notice_30day',
    name: '30-Day Notice to Quit',
    icon: FileText,
    desc: 'Formal statutory termination notice to yield up vacant possession',
    category: 'Notices',
    statute: 'S.4(2) Landlord & Tenant Act',
    accentColor: '#64748b',
    badge: 'STATUTORY NOTICE'
  },
  {
    id: 'landlord_remittance_statement',
    name: 'Landlord Remittance Statement',
    icon: FileSpreadsheet,
    desc: 'Monthly rental portfolio statement with fees, KRA MRI tax & net payout',
    category: 'Finance',
    statute: 'ICPAK Accounting Standard',
    accentColor: '#0284c7',
    badge: 'FINANCIAL STATEMENT'
  },
  {
    id: 'agent_salary_voucher',
    name: 'Agent Salary Voucher',
    icon: FileDown,
    desc: 'Itemized agent letting commission, mgmt fee & 5% WHT payout voucher',
    category: 'Payroll',
    statute: 'Cap 533 Estate Agents Act',
    accentColor: '#4f46e5',
    badge: 'EARB PAYROLL'
  },
  {
    id: 'etims_tax_receipt',
    name: 'KRA eTIMS Tax Receipt',
    icon: ShieldCheck,
    desc: 'Official Electronic Tax Invoice Management System fiscal invoice receipt',
    category: 'Tax',
    statute: 'KRA eTIMS / VAT Act 2013',
    accentColor: '#b91c1c',
    badge: 'KRA FISCAL RECEIPT'
  },
  {
    id: 'rrt_landlord_complaint',
    name: 'RRT Landlord Complaint',
    icon: Scale,
    desc: 'Rent Restriction Tribunal formal eviction application & distress filing',
    category: 'Legal',
    statute: 'Cap 301 Part III Pleadings',
    accentColor: '#1e3a8a',
    badge: 'TRIBUNAL SUIT'
  },
  {
    id: 'rrt_tenant_response',
    name: 'RRT Tenant Dispute Response',
    icon: Scale,
    desc: 'Tribunal dispute response challenging unlawful rent increments & injunction',
    category: 'Legal',
    statute: 'Cap 301 Section 6 & 15',
    accentColor: '#0369a1',
    badge: 'TRIBUNAL DEFENSE'
  },
];

const CATEGORIES = ['All', ...new Set(DOC_TYPES.map(d => d.category))];

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

/**
 * Realistic Document Thumbnail Card Component
 * Shows a true-to-life mini visual preview of the Kenyan legal/accounting instrument
 */
function DocumentVisualThumbnail({ docInfo, formData, isSelected }) {
  const isDemand = docInfo.id === 'demand_note_7day';
  const isLease = docInfo.id === 'lease_agreement';
  const isEtims = docInfo.id === 'etims_tax_receipt';
  const isRrt = docInfo.id.startsWith('rrt_');
  const isRemit = docInfo.id === 'landlord_remittance_statement';
  const isSalary = docInfo.id === 'agent_salary_voucher';

  return (
    <div className={`relative w-full h-36 rounded-xl overflow-hidden bg-white text-slate-800 shadow-md border transition-all ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-400' : 'border-slate-300'}`}>
      {/* Header bar */}
      <div className="h-7 px-2.5 flex items-center justify-between" style={{ backgroundColor: '#09111e' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[7.5px] font-black text-emerald-400 font-sans tracking-wide">MUTUNERENT PRO</span>
        </div>
        <span className="text-[6.5px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: docInfo.accentColor }}>
          {docInfo.badge}
        </span>
      </div>

      {/* Sheet Content Simulation */}
      <div className="p-2 space-y-1 bg-white select-none">
        {/* Document Title Header */}
        <div className="text-center pb-1 border-b border-slate-200">
          <p className="text-[7px] font-black uppercase tracking-tight text-slate-900 truncate">
            {docInfo.name}
          </p>
          <p className="text-[5.5px] text-slate-500 font-mono">
            {docInfo.statute} • MOMBASA
          </p>
        </div>

        {/* Micro Layout details */}
        {isDemand && (
          <div className="space-y-1">
            <div className="bg-red-50 p-1 rounded border border-red-200 flex justify-between items-center">
              <span className="text-[6px] font-bold text-red-700">7-DAY NOTICE PRIOR TO DISTRESS</span>
              <span className="text-[6px] font-mono font-black text-red-700">
                KES {Number(formData.arrears_kes || 35000).toLocaleString('en-KE')}
              </span>
            </div>
            <div className="space-y-0.5 text-[5.5px] text-slate-600">
              <div className="flex justify-between"><span>Tenant: {formData.tenant_name || 'Occupant'}</span><span className="font-mono text-red-600 font-bold">Cap 293</span></div>
              <div className="flex justify-between"><span>Unit: {formData.unit_number || '1A'}, {formData.property_name || 'Property'}</span><span>Paybill: 400200</span></div>
            </div>
          </div>
        )}

        {isLease && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1 text-[5.5px] bg-slate-50 p-1 rounded border border-slate-200">
              <div><span className="text-slate-400">Lessor:</span> <span className="font-bold truncate block">{formData.landlord_name || 'Landlord'}</span></div>
              <div><span className="text-slate-400">Lessee:</span> <span className="font-bold truncate block">{formData.tenant_name || 'Tenant'}</span></div>
            </div>
            <div className="flex justify-between text-[6px] font-mono font-bold text-slate-700 px-0.5">
              <span>Rent: KES {Number(formData.rent_amount_kes || 25000).toLocaleString('en-KE')}</span>
              <span className="text-emerald-700">Stamp Duty: Cap 480</span>
            </div>
          </div>
        )}

        {isEtims && (
          <div className="space-y-1">
            <div className="bg-slate-50 p-1 rounded border border-slate-200 text-[5.5px] space-y-0.5">
              <div className="flex justify-between font-mono font-bold text-red-700"><span>KRA CU INVOICE</span><span>PIN: P051987654Z</span></div>
              <div className="flex justify-between text-slate-500"><span>Exempt Rent (Part II)</span><span>Total: KES {Number(formData.rent_amount_kes || 25000).toLocaleString('en-KE')}</span></div>
            </div>
            <div className="text-[5px] text-center font-mono text-slate-400">QR FISCAL HASH • itax.kra.go.ke</div>
          </div>
        )}

        {isRemit && (
          <div className="space-y-1">
            <div className="bg-sky-50 p-1 rounded border border-sky-200 text-[5.5px] space-y-0.5">
              <div className="flex justify-between font-bold text-sky-900"><span>Collections Roll</span><span>Mgmt: {formData.management_fee_percent || 8}%</span></div>
              <div className="flex justify-between text-slate-600"><span>Net Disbursable</span><span className="font-mono font-bold text-emerald-700">KES {(Number(formData.rent_amount_kes || 50000) * 0.92).toLocaleString('en-KE')}</span></div>
            </div>
            <div className="flex justify-between text-[5px] text-slate-400"><span>KRA MRI Tax 7.5%</span><span>USD Live CBK</span></div>
          </div>
        )}

        {isSalary && (
          <div className="space-y-1">
            <div className="bg-indigo-50 p-1 rounded border border-indigo-200 text-[5.5px] space-y-0.5">
              <div className="flex justify-between font-bold text-indigo-900"><span>EARB Payout</span><span>WHT: 5% Resident</span></div>
              <div className="flex justify-between text-slate-600"><span>Net Payout</span><span className="font-mono font-bold text-emerald-700">M-Pesa B2C Batch</span></div>
            </div>
            <div className="text-[5px] text-center font-mono text-slate-400">EARB/MBA/2024 Regulated</div>
          </div>
        )}

        {isRrt && (
          <div className="space-y-1">
            <div className="bg-slate-50 p-1 rounded border border-slate-200 text-[5.5px] space-y-0.5">
              <div className="font-bold text-slate-800 text-center">RENT RESTRICTION TRIBUNAL</div>
              <div className="flex justify-between text-slate-600"><span>Mombasa Registry</span><span className="font-mono text-blue-700 font-bold">Cap 301</span></div>
            </div>
            <div className="text-[5px] text-center text-slate-400">Judicial Summons & Grounds</div>
          </div>
        )}
      </div>

      {/* Mini Seal / Stamp */}
      <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full border border-emerald-600/70 flex items-center justify-center bg-white/90 shadow-sm pointer-events-none">
        <div className="text-[4px] font-black text-emerald-700 text-center leading-tight">
          MUTUNE<br/>SEAL
        </div>
      </div>
    </div>
  );
}

export default function PaperworkSuiteTab() {
  const [loadingDoc, setLoadingDoc] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('lease_agreement');
  const [autoPopulate, setAutoPopulate] = useState(true);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [filterCat, setFilterCat] = useState('All');
  const [exportFormat, setExportFormat] = useState('pdf');
  const [previewModal, setPreviewModal] = useState({ open: false, url: '', title: '', docType: '', viewMode: 'official' });

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
        setTenantResults(r?.data || r?.tenants || r?.data?.data || r?.data?.tenants || []);
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
        setPropertyResults(r?.data || r?.properties || r?.data?.data || r?.data?.properties || []);
      } catch { setPropertyResults([]); }
    })();
  }, [autoPopulate]);

  const selectTenant = (t) => {
    setFormData(prev => ({
      ...prev,
      tenant_name: t.full_name || t.name || '',
      tenant_code: t.tenant_code || '',
      national_id: t.national_id || t.id_number || '',
      phone: t.phone || '',
      email: t.email || '',
      unit_number: t.current_unit_id?.unit_number || prev.unit_number,
      rent_amount_kes: t.rent_amount_kes || prev.rent_amount_kes,
      arrears_kes: t.balance_kes || t.arrears_kes || prev.arrears_kes
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

  // Stamp Duty Calculation (Cap 480)
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
      const blob = await extractPdfBlob(response);
      const url = window.URL.createObjectURL(blob);
      if (isDownload) {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${docType}_${formData.tenant_code || 'official_instrument'}_${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success(`Downloaded official ${docType}.pdf ✓`);
      } else {
        setPreviewModal({
          open: true,
          url,
          title: DOC_TYPES.find(d => d.id === docType)?.name || 'Official Legal Document Preview',
          docType,
          viewMode: 'official'
        });
        toast.info('Loaded official document preview');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to generate PDF');
    } finally {
      setLoadingDoc(null);
    }
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

  const currentDocInfo = DOC_TYPES.find(d => d.id === selectedDocType) || DOC_TYPES[0];

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white font-sans">
                Enterprise Legal & Accounting Paperwork Suite
              </h2>
              <p className="text-xs text-slate-400">
                Generate authentic Kenyan property legal instruments, Cap 293 arrears demand notices, leases, KRA eTIMS invoices, and RRT pleadings.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto/Manual Toggle */}
          <button
            onClick={() => { setAutoPopulate(!autoPopulate); if (autoPopulate) setFormData({ ...EMPTY_FORM }); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              autoPopulate
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoPopulate ? <><Database size={13} /> Auto-fill from DB</> : <><Edit3 size={13} /> Manual Entry</>}
          </button>
          {/* Export Format */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-xl border border-slate-700">
            {['pdf', 'excel'].map(f => (
              <button key={f} onClick={() => setExportFormat(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${exportFormat === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
              filterCat === cat ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Auto-populate Selectors */}
      {autoPopulate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-3xl bg-emerald-950/20 border border-emerald-500/20">
          {/* Tenant Search */}
          <div className="relative">
            <label className="block text-[10px] text-emerald-400 font-bold uppercase mb-1.5 tracking-wider">Search Tenant (Database Link)</label>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={tenantSearch} placeholder="Type tenant name, phone, or code (e.g. TEN-MOM-XXXX)..."
                onChange={e => { setTenantSearch(e.target.value); setShowTenantDD(true); }}
                onFocus={() => setShowTenantDD(true)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50"
              />
            </div>
            {showTenantDD && tenantResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-800">
                {tenantResults.map((t, i) => (
                  <button key={i} onClick={() => selectTenant(t)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-xs text-white transition-colors cursor-pointer flex items-center justify-between">
                    <div>
                      <span className="font-bold">{t.full_name || t.name}</span>
                      <span className="text-slate-400 ml-2 font-mono text-[11px]">{t.tenant_code}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {t.rent_amount_kes ? `KES ${Number(t.rent_amount_kes).toLocaleString('en-KE')}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property Select */}
          <div className="relative">
            <label className="block text-[10px] text-emerald-400 font-bold uppercase mb-1.5 tracking-wider">Select Property (Mombasa Portfolio)</label>
            <button onClick={() => setShowPropertyDD(!showPropertyDD)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white text-left flex items-center justify-between cursor-pointer">
              <span>{formData.property_name || 'Select property from portfolio...'}</span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
            {showPropertyDD && propertyResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-800">
                {propertyResults.map((p, i) => (
                  <button key={i} onClick={() => selectProperty(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-xs text-white transition-colors cursor-pointer flex items-center justify-between">
                    <div>
                      <span className="font-bold">{p.name}</span>
                      <span className="text-slate-400 ml-2 font-mono text-[11px]">{p.property_code}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{p.units?.length || 0} Units</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Selector Grid with Visual Document Thumbnails */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Building size={16} className="text-indigo-400" />
            Official Legal Instruments & Financial Documents
          </h3>
          <span className="text-xs text-slate-400">Click any document to inspect layout & edit parameters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {filteredDocs.map((doc) => {
            const isSelected = selectedDocType === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDocType(doc.id)}
                className={`p-3.5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-500 shadow-xl shadow-indigo-500/15'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Category & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {doc.category}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400">
                        <CheckCircle2 size={13} /> Active
                      </span>
                    )}
                  </div>

                  {/* True-to-life Document Thumbnail Preview */}
                  <DocumentVisualThumbnail docInfo={doc} formData={formData} isSelected={isSelected} />

                  <h4 className="text-xs font-bold text-white mt-2.5 mb-1 leading-snug">{doc.name}</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{doc.desc}</p>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.id, false); }}
                    disabled={loadingDoc === doc.id}
                    title="Live Official Document Preview"
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-700 cursor-pointer transition"
                  >
                    <Eye size={11} /> Preview
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGeneratePDF(doc.id, true); }}
                    disabled={loadingDoc === doc.id}
                    title="Download Official PDF"
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-sm shadow-indigo-600/30"
                  >
                    <Download size={11} /> PDF
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExportExcel(doc.id); }}
                    title="Export Schedule to Excel"
                    className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-sm shadow-emerald-600/30"
                  >
                    <FileSpreadsheet size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stamp Duty Advisory Notice */}
      {selectedDocType === 'lease_agreement' && Number(formData.rent_amount_kes) > 0 && (
        <div className="p-4 rounded-3xl bg-sky-950/30 border border-sky-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 rounded-2xl text-sky-400"><Info size={18} /></div>
            <div>
              <p className="font-bold text-sky-300">Statutory Stamp Duty: KES {stampDutyKes.toLocaleString('en-KE')}</p>
              <p className="text-[10px] text-sky-400/80">{stampDutyRateDesc} • Annual Gross Rental Value: KES {annualRent.toLocaleString('en-KE')}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-sky-300 font-bold px-3 py-1 bg-sky-500/10 rounded-xl border border-sky-500/20">
            Kenya Stamp Duty Act Cap 480
          </span>
        </div>
      )}

      {/* Parameter Entry Form for Selected Document */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 size={15} className="text-indigo-400" />
              {currentDocInfo.name} — Parameters & Statutory Particulars
            </h3>
            <p className="text-xs text-slate-400">
              Customize client details, arrears balances, property addresses, or rental numbers.
            </p>
          </div>
          <button
            onClick={() => setFormData({ ...EMPTY_FORM })}
            className="text-[10px] text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition cursor-pointer font-bold"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {visibleFields.map(field => (
            <div key={field}>
              <label className="block text-slate-400 font-bold mb-1 text-[10px] uppercase tracking-wider">
                {FIELD_LABELS[field]}
              </label>
              <input
                type={NUM_FIELDS.includes(field) ? 'number' : field === 'lease_start_date' ? 'date' : 'text'}
                value={formData[field] ?? ''}
                placeholder={FIELD_LABELS[field]}
                onChange={(e) => handleChange(field, e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-indigo-500/60 transition-all placeholder:text-slate-600 font-sans"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Generate Quick Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-3xl bg-slate-900/40 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Ready to execute:</span>
          <span className="text-xs font-mono font-bold text-indigo-400">{currentDocInfo.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGeneratePDF(selectedDocType, false)}
            disabled={loadingDoc}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition"
          >
            <Eye size={13} /> Official Document Preview
          </button>
          <button
            onClick={() => handleGeneratePDF(selectedDocType, true)}
            disabled={loadingDoc}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-indigo-600/20"
          >
            <Download size={13} /> Download PDF
          </button>
          <button
            onClick={() => handleExportExcel(selectedDocType)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md shadow-emerald-600/20"
          >
            <FileSpreadsheet size={13} /> Export Excel
          </button>
          <button
            onClick={() => handlePrint(selectedDocType)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* High-Fidelity Interactive Preview Modal */}
      {previewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{previewModal.title}</h3>
                  <p className="text-[10px] text-slate-400">Authentic Kenyan Enterprise Legal Instrument • Mutune Real Estate Management</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 mr-2">
                  <button
                    onClick={() => setPreviewModal(prev => ({ ...prev, viewMode: 'official' }))}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${previewModal.viewMode === 'official' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    Official Document
                  </button>
                  <button
                    onClick={() => setPreviewModal(prev => ({ ...prev, viewMode: 'pdf' }))}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${previewModal.viewMode === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    PDF Stream
                  </button>
                </div>

                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewModal.url;
                    link.setAttribute('download', `${previewModal.docType}_${Date.now()}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    toast.success('Downloaded official PDF ✓');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-white"
                >
                  <Download size={13} /> Download
                </button>
                <button
                  onClick={() => window.open(previewModal.url, '_blank')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-300"
                >
                  Open in New Tab
                </button>
                <button
                  onClick={() => {
                    if (previewModal.url) URL.revokeObjectURL(previewModal.url);
                    setPreviewModal({ open: false, url: '', title: '', docType: '', viewMode: 'official' });
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-950 p-4 overflow-y-auto flex items-center justify-center">
              {previewModal.viewMode === 'pdf' ? (
                <iframe
                  src={previewModal.url}
                  title="PDF Preview Stream"
                  className="w-full h-full rounded-2xl border border-slate-800 bg-white"
                />
              ) : (
                /* High-fidelity Authentic Kenyan Official Document Inspection Sheet */
                <div className="w-full max-w-3xl bg-white text-slate-900 p-8 rounded-2xl shadow-2xl space-y-6 font-sans text-xs border border-slate-300 my-auto">
                  {/* Top Letterhead */}
                  <div className="border-b-2 border-emerald-600 pb-4 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-emerald-600" />
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">MUTUNERENT PRO</h1>
                      </div>
                      <p className="text-[10px] font-bold text-slate-700 uppercase mt-0.5">Mutune Real Estate Management & Agencies Ltd</p>
                      <p className="text-[9px] text-slate-500">Regulated under Estate Agents Act (EARB/MBA/2024/098) • KRA PIN: P051987654Z</p>
                      <p className="text-[9px] text-slate-500">Nyali Links Plaza, P.O. Box 90120-80100 Mombasa • Tel: +254 700 000 000</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded text-[9px] font-bold text-white bg-emerald-700 uppercase tracking-wider mb-1">
                        {currentDocInfo.badge}
                      </span>
                      <p className="text-[10px] font-mono text-slate-500">REF: {previewModal.docType.toUpperCase()}-2026</p>
                      <p className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString('en-KE')} (EAT)</p>
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className="text-center py-2 bg-slate-100 rounded-lg border border-slate-200">
                    <h2 className="text-sm font-black uppercase text-slate-900 tracking-wide">
                      {previewModal.title}
                    </h2>
                    <p className="text-[10px] text-slate-600 font-mono">
                      Governed under Kenyan Statutory Law • {currentDocInfo.statute}
                    </p>
                  </div>

                  {/* Parties & Particulars */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 block mb-1">Party A (Lessor / Landlord):</span>
                      <p className="font-bold text-slate-900 text-xs">{formData.landlord_name || 'Designated Property Owner'}</p>
                      <p className="text-slate-600 text-[10px]">KRA PIN: {formData.kra_pin || 'P051239847K'}</p>
                      <p className="text-slate-600 text-[10px]">Managed by: Mutune Real Estate Mombasa</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 block mb-1">Party B (Lessee / Tenant):</span>
                      <p className="font-bold text-slate-900 text-xs">{formData.tenant_name || 'Tenant Name'} ({formData.tenant_code || 'TEN-MOM-XXXX'})</p>
                      <p className="text-slate-600 text-[10px]">National ID: {formData.national_id || '28374619'}</p>
                      <p className="text-slate-600 text-[10px]">Handset: {formData.phone || '+254 700 000 000'}</p>
                    </div>
                  </div>

                  {/* Schedule Details */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Premises & Financial Particulars</h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-900 text-white">
                          <tr>
                            <th className="py-2 px-3">Property & Unit</th>
                            <th className="py-2 px-3">Term / Duration</th>
                            <th className="py-2 px-3 text-right">Agreed Rent</th>
                            <th className="py-2 px-3 text-right">Balance / Arrears</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          <tr>
                            <td className="py-2.5 px-3 font-semibold">{formData.property_name || 'Property'} (Unit {formData.unit_number || '1A'})</td>
                            <td className="py-2.5 px-3">{formData.lease_duration_months || 12} Months</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                              KES {Number(formData.rent_amount_kes || 25000).toLocaleString('en-KE')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600">
                              KES {Number(formData.arrears_kes || 0).toLocaleString('en-KE')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Legal Attestation Block */}
                  <div className="border border-emerald-200 bg-emerald-50/60 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>Enforceable Electronic Legal Instrument</span>
                      </div>
                      <p className="text-[9px] text-emerald-700 mt-0.5">
                        Attested under Section 83B of the Kenya Information and Communications Act (Cap 411A).
                      </p>
                      <p className="text-[8px] font-mono text-slate-500 mt-1">
                        System Verification Hash: SHA256-MUTUNE-SECURE-LEAD-2026
                      </p>
                    </div>
                    <div className="w-16 h-16 rounded-full border-2 border-emerald-600 flex flex-col items-center justify-center text-center text-emerald-800 select-none">
                      <span className="text-[6px] font-black leading-tight">MUTUNE</span>
                      <span className="text-[8px]">★</span>
                      <span className="text-[5px] font-bold">MOMBASA</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
