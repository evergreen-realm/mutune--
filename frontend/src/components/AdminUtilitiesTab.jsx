import React, { useState, useEffect } from 'react';
import {
  Droplets, Zap, Search, CheckCircle2, AlertTriangle, ShieldCheck,
  Building, CreditCard, Receipt, FileText, ArrowRight, RefreshCw, Send,
  TrendingUp, UploadCloud, Sliders, Calculator
} from 'lucide-react';
import {
  fetchUtilityProviders, validateWaterAccount, queryWaterBill,
  payWaterBill, queryPostpaidBill, payPostpaidBill, logUtilityReading,
  fetchProperties, fetchWaterAnalytics, bulkImportReadings,
  calculateMewascoWaterBill, fetchMewascoTariffs, updateMewascoTariffs
} from '../lib/api';
import { toast } from 'react-toastify';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area
} from 'recharts';

export default function AdminUtilitiesTab() {
  const [activeSubTab, setActiveSubTab] = useState('biller'); // 'biller' | 'analytics' | 'bulk' | 'tariffs'
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('MOMBASA_WATER');
  const [accountNumber, setAccountNumber] = useState('');
  const [billData, setBillData] = useState(null);
  const [validatedAccount, setValidatedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  // Properties & Analytics State
  const [properties, setProperties] = useState([]);
  const [analyticsPropertyId, setAnalyticsPropertyId] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Manual meter reading fallback state
  const [manualForm, setManualForm] = useState({
    property_id: '',
    unit_id: '',
    previous_reading: 0,
    current_reading: 0,
    rate_per_unit_kes: 50,
    billing_month: new Date().toISOString().slice(0, 7)
  });

  // Bulk Import State
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // MEWASCO Tariff Configuration & Calculator State
  const [tariffs, setTariffs] = useState(null);
  const [savingTariffs, setSavingTariffs] = useState(false);
  const [calcUnits, setCalcUnits] = useState(25);
  const [calcCategory, setCalcCategory] = useState('domestic');
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => {
    loadProviders();
    loadPropertiesList();
    loadTariffs();
  }, []);

  useEffect(() => {
    if (analyticsPropertyId) {
      loadPropertyAnalytics(analyticsPropertyId);
    }
  }, [analyticsPropertyId]);

  const loadProviders = async () => {
    try {
      const res = await fetchUtilityProviders();
      if (res?.data?.success) {
        setProviders(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load utility providers', err);
    }
  };

  const loadPropertiesList = async () => {
    try {
      const res = await fetchProperties();
      if (res?.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setProperties(list);
        if (list.length > 0 && !analyticsPropertyId) {
          setAnalyticsPropertyId(list[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load properties', err);
    }
  };

  const loadPropertyAnalytics = async (propertyId) => {
    setLoadingAnalytics(true);
    try {
      const res = await fetchWaterAnalytics(propertyId, 6);
      if (res?.data?.success) {
        setAnalyticsData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load water analytics', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadTariffs = async () => {
    try {
      const res = await fetchMewascoTariffs();
      if (res?.data?.success) {
        setTariffs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load MEWASCO tariffs', err);
    }
  };

  const handleValidate = async () => {
    if (!accountNumber) {
      toast.error('Please enter a utility account or meter number');
      return;
    }
    setLoading(true);
    setBillData(null);
    try {
      const res = await validateWaterAccount({
        account_number: accountNumber.trim(),
        provider_id: selectedProvider
      });
      if (res?.data?.success) {
        setValidatedAccount(res.data.data);
        toast.success(`Validated: ${res.data.data.meter_owner} (${res.data.data.provider_name}) ✓`);
      } else {
        toast.error('Validation failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Error validating account');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryBill = async () => {
    if (!accountNumber) {
      toast.error('Please enter an account number');
      return;
    }
    setLoading(true);
    try {
      const isElectricity = selectedProvider.startsWith('KPLC');
      const res = isElectricity
        ? await queryPostpaidBill(accountNumber.trim(), selectedProvider)
        : await queryWaterBill(accountNumber.trim(), selectedProvider);

      if (res?.data?.success) {
        setBillData(res.data.data);
        toast.success(`Outstanding Balance: KES ${res.data.data.balance_kes.toLocaleString('en-KE')}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Error querying bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePayBill = async () => {
    if (!billData || !accountNumber) return;
    setPaying(true);
    const toastId = toast.loading(`Paying ${billData.provider_name || 'Utility'} bill...`);
    try {
      const isElectricity = selectedProvider.startsWith('KPLC');
      const res = isElectricity
        ? await payPostpaidBill({
            account_number: accountNumber.trim(),
            amount_kes: billData.balance_kes || 1000
          })
        : await payWaterBill({
            account_number: accountNumber.trim(),
            amount_kes: billData.balance_kes || 1000,
            provider_id: selectedProvider
          });

      if (res?.data?.success) {
        toast.update(toastId, { render: `Bill paid successfully! Receipt: ${res.data.data.receipt_number} ✓`, type: 'success', isLoading: false, autoClose: 5000 });
        setBillData(prev => ({ ...prev, balance_kes: 0 }));
      }
    } catch (err) {
      toast.update(toastId, { render: err?.response?.data?.error?.message || err?.message || 'Bill payment failed', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setPaying(false);
    }
  };

  const handleCalculateBillPreview = async () => {
    try {
      const res = await calculateMewascoWaterBill({
        consumption_m3: Number(calcUnits),
        category: calcCategory,
        provider_id: selectedProvider
      });
      if (res?.data?.success) {
        setCalcResult(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to calculate bill');
    }
  };

  const handleSaveTariffs = async () => {
    if (!tariffs) return;
    setSavingTariffs(true);
    try {
      const res = await updateMewascoTariffs(tariffs);
      if (res?.data?.success) {
        toast.success('MEWASCO WASREB tariff rates saved successfully ✓');
      }
    } catch (err) {
      toast.error('Failed to save tariff rates');
    } finally {
      setSavingTariffs(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkCsvText.trim()) {
      toast.error('Please paste CSV lines in format: property_id,unit_id,previous_reading,current_reading,rate_kes');
      return;
    }
    setBulkImporting(true);
    setBulkResult(null);

    try {
      const lines = bulkCsvText.trim().split('\n');
      const readings = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('property_id')) continue;
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 4) {
          readings.push({
            property_id: parts[0],
            unit_id: parts[1],
            previous_reading: Number(parts[2] || 0),
            current_reading: Number(parts[3] || 0),
            rate_per_unit_kes: parts[4] ? Number(parts[4]) : 50,
            billing_month: new Date().toISOString().slice(0, 7)
          });
        }
      }

      if (readings.length === 0) {
        toast.error('No valid reading rows parsed. Check CSV formatting.');
        setBulkImporting(false);
        return;
      }

      const res = await bulkImportReadings(readings);
      if (res?.data?.success) {
        setBulkResult(res.data.data);
        toast.success(`Bulk Import Completed: ${res.data.data.imported} imported, ${res.data.data.failed} failed ✓`);
      }
    } catch (err) {
      toast.error('Bulk import error: ' + (err?.response?.data?.error?.message || err.message));
    } finally {
      setBulkImporting(false);
    }
  };

  const handleLogManualReading = async (e) => {
    e.preventDefault();
    if (!manualForm.property_id || !manualForm.current_reading) {
      toast.error('Please select property and enter current reading');
      return;
    }
    try {
      const res = await logUtilityReading(manualForm);
      if (res?.data?.success) {
        toast.success('Manual meter reading recorded & invoice updated ✓');
        setManualForm({
          property_id: '',
          unit_id: '',
          previous_reading: 0,
          current_reading: 0,
          rate_per_unit_kes: 50,
          billing_month: new Date().toISOString().slice(0, 7)
        });
      }
    } catch (err) {
      toast.error('Failed to log manual reading');
    }
  };

  const allProvidersList = providers.length > 0 ? providers : [
    { id: 'MOMBASA_WATER', name: 'Mombasa Water & Sanitation (MEWASCO)', billerCode: '895500', region: 'Mombasa' },
    { id: 'NAIROBI_WATER', name: 'Nairobi City Water & Sewerage (NCWSC)', billerCode: '444400', region: 'Nairobi' },
    { id: 'KIWASCO', name: 'Kisumu Water & Sanitation (KIWASCO)', billerCode: '517000', region: 'Kisumu' },
    { id: 'ELDOWAS', name: 'Eldoret Water & Sanitation (ELDOWAS)', billerCode: '511000', region: 'Eldoret / Uasin Gishu' },
    { id: 'RUIRU_JUJA_WATER', name: 'Ruiru-Juja Water Services (RUJWASCO)', billerCode: '895502', region: 'Kiambu' },
    { id: 'NAIVASHA_WATER', name: 'Naivasha Water & Sanitation (NAIVAWASS)', billerCode: '895503', region: 'Nakuru' },
    { id: 'KPLC_PREPAID', name: 'Kenya Power Prepaid Electricity', billerCode: '888880', region: 'National' },
    { id: 'KPLC_POSTPAID', name: 'Kenya Power Postpaid Electricity', billerCode: '888888', region: 'National' }
  ];

  return (
    <div className="space-y-6 animate-fade-in text-slate-100 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
              <Droplets size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              Water Utilities & Mombasa MEWASCO Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Multi-provider water billing, WASREB-approved MEWASCO tiered tariff calculators, monthly consumption analytics, and direct Daraja/Kyanda settlement.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('biller')}
            className={`px-3 py-1.5 rounded-xl transition ${activeSubTab === 'biller' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Provider Hub
          </button>
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${activeSubTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <TrendingUp size={13} /> Consumption Analytics
          </button>
          <button
            onClick={() => setActiveSubTab('bulk')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${activeSubTab === 'bulk' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <UploadCloud size={13} /> Bulk Reading Import
          </button>
          <button
            onClick={() => setActiveSubTab('tariffs')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${activeSubTab === 'tariffs' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Sliders size={13} /> MEWASCO Tariffs
          </button>
        </div>
      </div>

      {/* SubTab 1: Main Provider Query & Settle Hub */}
      {activeSubTab === 'biller' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" /> Multi-Provider Account Query & Settlement
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Select Utility Provider *</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => {
                      setSelectedProvider(e.target.value);
                      setValidatedAccount(null);
                      setBillData(null);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none font-bold focus:border-blue-500"
                  >
                    {allProvidersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.billerCode || p.id}) - {p.region}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Account / Meter Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. MW-100234 or 4589201"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Search size={13} /> {loading ? 'Validating...' : 'Validate Account'}
                </button>
                <button
                  type="button"
                  onClick={handleQueryBill}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                >
                  <RefreshCw size={13} /> Query Outstanding Bill
                </button>
              </div>

              {/* Validation & Bill Details Panel */}
              {(validatedAccount || billData) && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Account Holder</span>
                      <span className="font-bold text-sm text-white">{billData?.customer_name || validatedAccount?.meter_owner}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold">
                      {billData?.provider_name || validatedAccount?.provider_name || 'Active Account'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Account Number</span>
                      <span className="font-mono text-white font-bold">{accountNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Paybill Code</span>
                      <span className="font-mono text-white font-bold">{billData?.biller_code || validatedAccount?.biller_code || '895500'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Outstanding Bill</span>
                      <span className="font-mono text-base font-black text-amber-400">
                        KES {Number(billData?.balance_kes || 0).toLocaleString('en-KE')}
                      </span>
                    </div>
                  </div>

                  {billData && billData.balance_kes > 0 && (
                    <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                      <p className="text-[11px] text-slate-400">
                        Settlement will be debited from Bank Operating Reserve and posted to GL Account 5030.
                      </p>
                      <button
                        onClick={handlePayBill}
                        disabled={paying}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                      >
                        <CreditCard size={13} /> {paying ? 'Processing...' : 'Settle Bill (Direct Paybill)'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Col: Manual Meter Reading Fallback */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" /> Manual Meter Reading Fallback
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">For rural or private borehole submeters.</p>
            </div>

            <form onSubmit={handleLogManualReading} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Property *</label>
                <select
                  required
                  value={manualForm.property_id}
                  onChange={(e) => setManualForm({ ...manualForm, property_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="">Select Property...</option>
                  {properties.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Prev Reading</label>
                  <input
                    type="number"
                    value={manualForm.previous_reading}
                    onChange={(e) => setManualForm({ ...manualForm, previous_reading: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Current Reading *</label>
                  <input
                    type="number"
                    required
                    value={manualForm.current_reading}
                    onChange={(e) => setManualForm({ ...manualForm, current_reading: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Rate per Unit (KES/m³)</label>
                <input
                  type="number"
                  value={manualForm.rate_per_unit_kes}
                  onChange={(e) => setManualForm({ ...manualForm, rate_per_unit_kes: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                <Send size={13} /> Save Meter Reading
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SubTab 2: Water Consumption Analytics */}
      {activeSubTab === 'analytics' && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-blue-400" size={18} /> Property Water Consumption Trends
              </h3>
              <p className="text-xs text-slate-400">Monthly water consumption volume (m³) and billed amounts.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={analyticsPropertyId}
                onChange={(e) => setAnalyticsPropertyId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
              >
                {properties.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.property_code})</option>
                ))}
              </select>
            </div>
          </div>

          {loadingAnalytics ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
              Loading consumption analytics...
            </div>
          ) : analyticsData?.trend && analyticsData.trend.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Avg Monthly Consumption</span>
                  <span className="text-2xl font-black text-blue-400">{analyticsData.average_monthly_consumption_units} m³</span>
                </div>
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Meter Readings</span>
                  <span className="text-2xl font-black text-emerald-400">{analyticsData.total_readings}</span>
                </div>
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Analysis Period</span>
                  <span className="text-2xl font-black text-purple-400">{analyticsData.period_months} Months</span>
                </div>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.trend}>
                    <defs>
                      <linearGradient id="waterColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="total_units" stroke="#3b82f6" fillOpacity={1} fill="url(#waterColor)" name="Consumption (m³)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
              No historical reading data recorded for this property yet. Log readings to visualize trend.
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Bulk Reading Import */}
      {activeSubTab === 'bulk' && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="text-blue-400" size={18} /> Bulk Meter Reading CSV Importer
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Import multiple meter readings at once. Format: <code className="text-blue-400 font-mono">property_id, unit_id, previous_reading, current_reading, rate_per_unit_kes</code>
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300">Paste CSV Data</label>
            <textarea
              rows={8}
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              placeholder="property_id,unit_id,previous_reading,current_reading,rate_per_unit_kes&#10;66b0a1b2c3d4e5f607182930,66b0a1b2c3d4e5f607182931,120,135,50&#10;66b0a1b2c3d4e5f607182930,66b0a1b2c3d4e5f607182932,240,262,50"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleBulkImport}
              disabled={bulkImporting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <UploadCloud size={14} /> {bulkImporting ? 'Importing Batch...' : 'Process Bulk Readings'}
            </button>
          </div>

          {bulkResult && (
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-emerald-400">Successfully Imported: {bulkResult.imported}</span>
                <span className="text-rose-400">Failed: {bulkResult.failed}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SubTab 4: MEWASCO Tariff Configuration & Calculator */}
      {activeSubTab === 'tariffs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tariff Rates Editor */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders size={16} className="text-amber-400" /> MEWASCO WASREB Tariff Rates
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Configurable tiers stored in system settings.</p>
              </div>
              <button
                onClick={handleSaveTariffs}
                disabled={savingTariffs}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-600/20"
              >
                {savingTariffs ? 'Saving...' : 'Save Tariffs'}
              </button>
            </div>

            {tariffs?.domestic && (
              <div className="space-y-3 text-xs">
                <span className="font-bold text-slate-300 block">Domestic Tiers (KES/m³)</span>
                {tariffs.domestic.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="w-36 font-semibold text-slate-300 text-[11px]">{tier.label}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-slate-500">Rate:</span>
                      <input
                        type="number"
                        value={tier.ratePerUnit}
                        onChange={(e) => {
                          const updated = { ...tariffs };
                          updated.domestic[idx].ratePerUnit = Number(e.target.value);
                          setTariffs(updated);
                        }}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-right"
                      />
                      <span className="text-slate-500">KES</span>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-slate-300">Sewerage Surcharge (%)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      value={(tariffs.sewerSurcharge || 0.75) * 100}
                      onChange={(e) => {
                        setTariffs({ ...tariffs, sewerSurcharge: Number(e.target.value) / 100 });
                      }}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-right"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instant Calculator Preview */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calculator size={16} className="text-blue-400" /> Tiered Bill Calculation Preview
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Consumption (m³)</label>
                <input
                  type="number"
                  value={calcUnits}
                  onChange={(e) => setCalcUnits(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Category</label>
                <select
                  value={calcCategory}
                  onChange={(e) => setCalcCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-bold"
                >
                  <option value="domestic">Domestic</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCalculateBillPreview}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Calculator size={13} /> Compute MEWASCO Bill
            </button>

            {calcResult && (
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3 text-xs animate-fade-in">
                <div className="space-y-1 border-b border-slate-800 pb-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Water Charge:</span>
                    <span className="font-mono text-white font-bold">KES {calcResult.water_charge_kes.toLocaleString('en-KE')}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Sewer Surcharge:</span>
                    <span className="font-mono text-white font-bold">KES {calcResult.sewer_charge_kes.toLocaleString('en-KE')}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-amber-400 pt-1">
                    <span>Total Bill:</span>
                    <span className="font-mono">KES {calcResult.total_kes.toLocaleString('en-KE')}</span>
                  </div>
                </div>

                {calcResult.breakdown && (
                  <div className="space-y-1 text-[11px]">
                    <span className="font-bold text-slate-400 block mb-1">Tier Breakdown:</span>
                    {calcResult.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-slate-400">
                        <span>{b.tier} ({b.units} m³ @ {b.rate}):</span>
                        <span className="font-mono text-slate-200">KES {b.cost}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
