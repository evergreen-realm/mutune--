import React, { useState, useEffect } from 'react';
import { Zap, Droplets, CheckCircle2, Copy, Search, CreditCard, RefreshCw, Calculator } from 'lucide-react';
import { purchasePrepaidToken, queryWaterBill, payWaterBill, calculateMewascoWaterBill, fetchCombinedInvoice } from '../lib/api';
import { toast } from 'react-toastify';

export default function TenantUtilitySection({ profile }) {
  // Electricity Token Vending State
  const [tokenMeter, setTokenMeter] = useState('');
  const [tokenAmount, setTokenAmount] = useState(500);
  const [tokenPaymentMethod, setTokenPaymentMethod] = useState('mpesa'); // 'mpesa' | 'bank'
  const [vendedTokenResult, setVendedTokenResult] = useState(null);
  const [buyingToken, setBuyingToken] = useState(false);

  // Water Utility & MEWASCO State
  const [waterAccountNumber, setWaterAccountNumber] = useState('');
  const [waterProvider, setWaterProvider] = useState('MOMBASA_WATER');
  const [waterCategory, setWaterCategory] = useState('domestic');
  const [waterBillData, setWaterBillData] = useState(null);
  const [queryingWater, setQueryingWater] = useState(false);
  const [payingWater, setPayingWater] = useState(false);

  // Tiered calculation estimator
  const [estConsumption, setEstConsumption] = useState(18);
  const [estBreakdown, setEstBreakdown] = useState(null);

  useEffect(() => {
    if (estConsumption > 0) {
      calculateMewascoWaterBill({
        consumption_m3: estConsumption,
        category: waterCategory,
        provider_id: waterProvider
      }).then(res => {
        if (res?.data?.success) setEstBreakdown(res.data.data);
      }).catch(() => {});
    }
  }, [estConsumption, waterCategory, waterProvider]);

  const handlePurchaseToken = async (e) => {
    e.preventDefault();
    if (!tokenMeter) {
      toast.error('Please enter your KPLC Prepaid Meter number');
      return;
    }
    if (!tokenAmount || tokenAmount < 50) {
      toast.error('Minimum token purchase is KES 50');
      return;
    }

    setBuyingToken(true);
    const toastId = toast.loading(`Vending KPLC token for meter ${tokenMeter}...`);
    try {
      const res = await purchasePrepaidToken({
        meter_number: tokenMeter.trim(),
        amount_kes: Number(tokenAmount),
        payment_method: tokenPaymentMethod,
        tenant_id: profile?._id,
        unit_id: profile?.current_unit_id,
        property_id: profile?.current_property_id?._id
      });

      if (res?.data?.success) {
        toast.update(toastId, { render: 'KPLC token vended successfully! ✓', type: 'success', isLoading: false, autoClose: 5000 });
        setVendedTokenResult(res.data.data);
      } else {
        toast.update(toastId, { render: res?.data?.error?.message || 'Token vending failed', type: 'error', isLoading: false, autoClose: 5000 });
      }
    } catch (err) {
      toast.update(toastId, { render: err?.response?.data?.error?.message || err?.message || 'Error vending token', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setBuyingToken(false);
    }
  };

  const handleQueryWaterBill = async () => {
    if (!waterAccountNumber) {
      toast.error('Please enter your water account number');
      return;
    }
    setQueryingWater(true);
    try {
      const res = await queryWaterBill(waterAccountNumber.trim(), waterProvider);
      if (res?.data?.success) {
        setWaterBillData(res.data.data);
        toast.success(`Outstanding Water Balance: KES ${res.data.data.balance_kes.toLocaleString('en-KE')}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Error querying water bill');
    } finally {
      setQueryingWater(false);
    }
  };

  const handlePayWaterBill = async () => {
    if (!waterBillData || !waterAccountNumber) return;
    setPayingWater(true);
    const toastId = toast.loading(`Settling ${waterBillData.provider_name || 'Water'} bill...`);
    try {
      const res = await payWaterBill({
        account_number: waterAccountNumber.trim(),
        amount_kes: waterBillData.balance_kes || 500,
        provider_id: waterProvider
      });
      if (res?.data?.success) {
        toast.update(toastId, { render: `Water bill settled! Receipt: ${res.data.data.receipt_number} ✓`, type: 'success', isLoading: false, autoClose: 5000 });
        setWaterBillData(prev => ({ ...prev, balance_kes: 0 }));
      }
    } catch (err) {
      toast.update(toastId, { render: err?.response?.data?.error?.message || err?.message || 'Water payment failed', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setPayingWater(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Water Utilities & MEWASCO Breakdown */}
      <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
              <Droplets size={16} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Water Utility & MEWASCO Billing
              </h3>
              <p className="text-[11px] text-muted">
                Direct water query, WASREB tariff tier breakdown, and bill settlement.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold">
            {waterProvider === 'MOMBASA_WATER' ? '🌊 Mombasa MEWASCO' : '🏙️ Water Utility'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Water Provider</label>
            <select
              value={waterProvider}
              onChange={(e) => {
                setWaterProvider(e.target.value);
                setWaterBillData(null);
              }}
              className="w-full bg-surface border border-border focus:border-blue-500 rounded-xl px-3 py-2 text-foreground font-bold outline-none"
            >
              <option value="MOMBASA_WATER">🌊 Mombasa Water (MEWASCO)</option>
              <option value="NAIROBI_WATER">🏙️ Nairobi Water (NCWSC)</option>
              <option value="KIWASCO">🐟 Kisumu Water (KIWASCO)</option>
              <option value="ELDOWAS">🌾 Eldoret Water (ELDOWAS)</option>
              <option value="RUIRU_JUJA_WATER">🏖️ Ruiru-Juja Water (RUJWASCO)</option>
              <option value="NAIVASHA_WATER">🦩 Naivasha Water (NAIVAWASS)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Tariff Category</label>
            <select
              value={waterCategory}
              onChange={(e) => setWaterCategory(e.target.value)}
              className="w-full bg-surface border border-border focus:border-blue-500 rounded-xl px-3 py-2 text-foreground font-bold outline-none"
            >
              <option value="domestic">Domestic Tiered Rate</option>
              <option value="commercial">Commercial Flat Rate</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Account / Meter Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. MW-209411"
                value={waterAccountNumber}
                onChange={(e) => setWaterAccountNumber(e.target.value)}
                className="w-full bg-surface border border-border focus:border-blue-500 rounded-xl px-3 py-2 text-foreground font-mono outline-none"
              />
              <button
                type="button"
                onClick={handleQueryWaterBill}
                disabled={queryingWater}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Bill Query Result */}
        {waterBillData && (
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-border space-y-3 text-xs animate-fade-in">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="font-bold text-foreground">{waterBillData.customer_name || 'Water Account'}</span>
              <span className="font-mono text-base font-black text-amber-400">
                KES {Number(waterBillData.balance_kes || 0).toLocaleString('en-KE')}
              </span>
            </div>
            {waterBillData.balance_kes > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={handlePayWaterBill}
                  disabled={payingWater}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CreditCard size={13} /> {payingWater ? 'Paying...' : 'Pay Water Bill'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* MEWASCO Tiered Estimation Breakdown Panel */}
        {waterProvider === 'MOMBASA_WATER' && estBreakdown && (
          <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-400 flex items-center gap-1">
                <Calculator size={13} /> WASREB MEWASCO Tier Breakdown ({estConsumption} m³ consumption):
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted">Estimate m³:</span>
                <input
                  type="number"
                  value={estConsumption}
                  onChange={(e) => setEstConsumption(Number(e.target.value))}
                  className="w-16 bg-surface border border-border rounded-lg px-2 py-0.5 text-right font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {estBreakdown.breakdown?.map((b, idx) => (
                <div key={idx} className="flex justify-between p-2 bg-surface/50 rounded-xl border border-border/50">
                  <span className="text-muted">{b.tier}:</span>
                  <span className="font-mono font-bold text-foreground">{b.units} m³ × KES {b.rate} = KES {b.cost}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border/50 flex justify-between font-bold text-slate-200">
              <span>Sewer Surcharge (75%): KES {estBreakdown.sewer_charge_kes}</span>
              <span className="text-amber-400 font-mono">Estimated Total: KES {estBreakdown.total_kes.toLocaleString('en-KE')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: KPLC Prepaid Token Vending */}
      <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Zap size={16} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">KPLC Prepaid Electricity Token Vending</h3>
              <p className="text-[11px] text-muted">Purchase electricity units directly via M-Pesa STK Push or Card/Bank gateway.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePurchaseToken} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Prepaid Meter Number *</label>
            <input
              type="text"
              placeholder="e.g. 14234567890"
              value={tokenMeter}
              onChange={(e) => setTokenMeter(e.target.value)}
              className="w-full bg-surface border border-border focus:border-amber-500 rounded-xl px-3 py-2 text-foreground font-mono outline-none"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Amount (KES) *</label>
            <input
              type="number"
              min="50"
              placeholder="500"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(Number(e.target.value))}
              className="w-full bg-surface border border-border focus:border-amber-500 rounded-xl px-3 py-2 text-foreground font-mono outline-none"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Payment Method</label>
            <select
              value={tokenPaymentMethod}
              onChange={(e) => setTokenPaymentMethod(e.target.value)}
              className="w-full bg-surface border border-border focus:border-amber-500 rounded-xl px-3 py-2 text-foreground outline-none font-bold"
            >
              <option value="mpesa">📱 Safaricom M-Pesa STK</option>
              <option value="bank">💳 Multi-Bank & Card (IntaSend)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={buyingToken}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-amber-950/40 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap size={13} /> {buyingToken ? 'Vending...' : 'Buy Tokens'}
            </button>
          </div>
        </form>

        {/* Vended Token Display Banner */}
        {vendedTokenResult && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                <CheckCircle2 size={13} /> KPLC Token Generated Successfully:
              </span>
              <span className="text-xs font-bold text-slate-300 font-mono">
                {vendedTokenResult.units_kwh} kWh Units
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-amber-500/20">
              <span className="text-sm sm:text-base font-mono font-black text-amber-300 tracking-widest">
                {vendedTokenResult.token}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(vendedTokenResult.token);
                  toast.success('Token copied to clipboard!');
                }}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
