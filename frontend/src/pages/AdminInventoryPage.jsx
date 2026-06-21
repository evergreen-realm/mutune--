import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  fetchAllInventory, fetchAuctionableItems, markItemAuctionable,
  recordAuctionSale, downloadAuctionReport, reclaimInventoryItem,
  addInventoryItem, deleteInventoryItem, fetchProperties
} from '../lib/api';
import {
  Package, Gavel, Download, Plus, X, AlertTriangle,
  DollarSign, Undo, Trash2, ChevronRight, Info, Search, TrendingUp
} from 'lucide-react';

const FMT_KES = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

const E_ADD  = { open:false, propId:'', name:'', description:'', condition:'good', estimated_value_kes:'' };
const E_FLAG = { open:false, propId:null, itemId:null, reason:'' };
const E_SALE = { open:false, propId:null, itemId:null, buyer:'', amount:'' };
const E_RECL = { open:false, propId:null, itemId:null, receiptId:'' };
const E_DEL  = { open:false, propId:null, itemId:null, itemName:'' };

export default function AdminInventoryPage() {
  const [allInventory, setAll]     = useState([]);
  const [auctionable,  setAuction] = useState([]);
  const [properties,   setProps]   = useState([]);
  const [loading,      setLoading] = useState(true);
  const [tab,          setTab]     = useState('auctionable');
  const [search,       setSearch]  = useState('');
  const [addModal,     setAdd]     = useState(E_ADD);
  const [flagModal,    setFlag]    = useState(E_FLAG);
  const [saleModal,    setSale]    = useState(E_SALE);
  const [reclModal,    setRecl]    = useState(E_RECL);
  const [delModal,     setDel]     = useState(E_DEL);
  const [downloading,  setDL]      = useState(false);
  const [working,      setWorking] = useState({});
  const [addErrs,      setAddErrs] = useState({});
  const [showInfo,     setShowInfo]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, auc, props] = await Promise.allSettled([
        fetchAllInventory(), fetchAuctionableItems(), fetchProperties({ limit:300 })
      ]);
      if (all.status   === 'fulfilled') setAll(Array.isArray(all.value?.data)    ? all.value.data    : []);
      if (auc.status   === 'fulfilled') setAuction(Array.isArray(auc.value?.data)? auc.value.data    : []);
      if (props.status === 'fulfilled') setProps(Array.isArray(props.value?.data) ? props.value.data : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const validateAdd = () => {
    const e = {};
    if (!addModal.propId)      e.propId = 'Select a property';
    if (!addModal.name.trim()) e.name   = 'Item name is required';
    if (addModal.estimated_value_kes !== '' && Number(addModal.estimated_value_kes) < 0)
      e.estimated_value_kes = 'Value must be >= 0';
    setAddErrs(e);
    return !Object.keys(e).length;
  };

  const handleAdd = async () => {
    if (!validateAdd()) return;
    setWorking(w => ({ ...w, add:true }));
    try {
      await addInventoryItem(addModal.propId, {
        name: addModal.name.trim(), description: addModal.description.trim(),
        condition: addModal.condition,
        estimated_value_kes: addModal.estimated_value_kes !== '' ? Number(addModal.estimated_value_kes) : 0
      });
      toast.success(`Added "${addModal.name}" to inventory`);
      setAdd(E_ADD); setAddErrs({}); load();
    } catch (err) { toast.error(err?.error?.message || 'Failed to add item'); }
    finally { setWorking(w => ({ ...w, add:false })); }
  };

  const handleDelete = async () => {
    setWorking(w => ({ ...w, del:true }));
    const { propId, itemId, itemName } = delModal;
    try {
      await deleteInventoryItem(propId, itemId);
      setDel(E_DEL);
      toast.success(`"${itemName}" removed from inventory`);
      load();
    } catch (err) { toast.error(err?.error?.message || 'Failed to delete'); }
    finally { setWorking(w => ({ ...w, del:false })); }
  };

  const handleFlag = async () => {
    if (!flagModal.reason.trim()) { toast.error('Reason is required'); return; }
    setWorking(w => ({ ...w, flag:true }));
    try {
      await markItemAuctionable(flagModal.propId, { item_id:flagModal.itemId, reason:flagModal.reason });
      toast.success('Item flagged for auction'); setFlag(E_FLAG); load();
    } catch (err) { toast.error(err?.error?.message || 'Failed to flag item'); }
    finally { setWorking(w => ({ ...w, flag:false })); }
  };

  const handleSale = async () => {
    if (!saleModal.buyer.trim() || !saleModal.amount || Number(saleModal.amount) <= 0) {
      toast.error('Provide buyer name and valid amount'); return;
    }
    setWorking(w => ({ ...w, sale:true }));
    try {
      await recordAuctionSale(saleModal.propId, { item_id:saleModal.itemId, buyer:saleModal.buyer, sale_amount:Number(saleModal.amount) });
      toast.success('Auction sale recorded!'); setSale(E_SALE); load();
    } catch (err) { toast.error(err?.error?.message || 'Failed to record sale'); }
    finally { setWorking(w => ({ ...w, sale:false })); }
  };

  const handleReclaim = async () => {
    const rId = reclModal.receiptId.trim();
    if (!rId)            { toast.error('Enter Payment Receipt Mongo ID'); return; }
    if (rId.length!==24) { toast.error('Mongo ID must be 24 characters'); return; }
    setWorking(w => ({ ...w, recl:true }));
    try {
      await reclaimInventoryItem(reclModal.propId, { item_id:reclModal.itemId, reclaim_receipt_id:rId });
      toast.success('Item reclaimed successfully!'); setRecl(E_RECL); load();
    } catch (err) { toast.error(err?.error?.message || 'Failed to reclaim'); }
    finally { setWorking(w => ({ ...w, recl:false })); }
  };

  const handleDownload = async () => {
    setDL(true);
    try { await downloadAuctionReport(); toast.success('Report downloaded'); }
    catch { toast.error('Download failed'); }
    finally { setDL(false); }
  };

  const auctionValue = auctionable.reduce((s,i) => s + Number(i.estimated_value_kes||0), 0);
  const totalItems   = allInventory.reduce((s,p) => s + (p.items||[]).length, 0);

  const filtered = allInventory.filter(p =>
    !search ||
    p.property_name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.items||[]).some(i => i.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const tab$ = t => ({
    padding: '8px 20px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.2s',
    background: tab === t ? '#2563EB' : 'rgba(156,163,175,0.15)',
    color: '#fff'
  });

  const inp$ = err => ({
    width: '100%',
    background: 'transparent',
    border: `1px solid ${err ? 'rgba(239,68,68,0.5)' : 'rgba(156,163,175,0.3)'}`,
    borderRadius: 12,
    padding: '12px 16px',
    color: 'inherit',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  });

  const lbl$ = {
    color: 'inherit',
    opacity: 0.7,
    fontSize: 12,
    fontWeight: 700,
    display: 'block',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  };

  const btn$ = (bg, extra = {}) => ({
    padding: '12px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    flex: 1,
    ...extra
  });

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(37,99,235,0.3)', borderTop: '3px solid #2563EB', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p className="text-slate-500 dark:text-slate-400 text-xs">Loading inventory…</p>
      </div>
    </div>
  );

  return (
    <div className="relative text-slate-900 dark:text-slate-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -right-[5%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[40px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-500 dark:text-slate-400">
          <span>Admin</span><ChevronRight size={12} /><span className="text-slate-800 dark:text-slate-200">Inventory &amp; Auction</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl font-black tracking-tight margin-0">Inventory &amp; Auction Control</h1>
              <button onClick={() => setShowInfo(v => !v)} title="How it works"
                className="bg-slate-250 dark:bg-slate-800 border-none rounded-lg p-1.5 cursor-pointer text-slate-500 dark:text-slate-400 flex items-center transition">
                <Info size={14} />
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Track assets &middot; flag for auction &middot; reclaim items &middot; log public sales</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setAdd({ ...E_ADD, open: true }); setAddErrs({}); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 20px rgba(37,99,235,0.35)' }}>
              <Plus size={15} /> Add Item
            </button>
            <button onClick={handleDownload} disabled={downloading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: downloading ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.3)' }}>
              <Download size={15} /> {downloading ? 'Downloading…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div className="bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/25 rounded-2xl p-5 mb-6 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <strong className="text-blue-600 dark:text-blue-400">How Inventory Works:</strong><br />
            1. <strong>Add Item</strong> — register any physical asset against a property (furniture, appliance, equipment).<br />
            2. <strong>Flag for Auction</strong> — mark auctionable when a tenant vacates with arrears.<br />
            3. <strong>Reclaim</strong> — if tenant pays, reclaim using the Payment Receipt ID.<br />
            4. <strong>Record Sale</strong> — log the auction outcome (buyer + amount) for KRA records.<br />
            5. <strong>Export CSV</strong> — download a KRA-compliant auction report.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {[
            { label: 'Auctionable Items', value: auctionable.length, icon: <Gavel size={18} />, color: '#fbbf24' },
            { label: 'Est. Auction Value', value: FMT_KES(auctionValue), icon: <DollarSign size={18} />, color: '#10b981' },
            { label: 'Properties with Assets', value: allInventory.length, icon: <Package size={18} />, color: '#2563EB' },
            { label: 'Total Assets', value: totalItems, icon: <TrendingUp size={18} />, color: '#ec4899' },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}22`, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">{s.label}</p>
              <p className="text-slate-900 dark:text-slate-100 text-xl font-black">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex gap-2">
            <button style={tab$('auctionable')} onClick={() => setTab('auctionable')}>
              🔨 Auctionable ({auctionable.length})
            </button>
            <button style={tab$('all')} onClick={() => setTab('all')}>
              📦 All Inventory ({totalItems})
            </button>
          </div>
          {tab === 'all' && (
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or properties…"
                className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-9 pr-3 text-slate-900 dark:text-slate-100 text-xs outline-none" />
            </div>
          )}
        </div>

        {/* AUCTIONABLE TAB */}
        {tab === 'auctionable' && (
          <div className="flex flex-col gap-3">
            {auctionable.length === 0 ? (
              <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                <Gavel size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-xs">No items flagged for auction</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">Flag items from the All Inventory tab</p>
              </div>
            ) : auctionable.map(item => {
              const days = daysSince(item.auctionable_marked_at);
              const urgent = days >= 30;
              return (
                <div key={`${item.property_id}-${item._id}`} className={`bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-5 sm:px-6 flex items-center gap-5 flex-wrap ${urgent ? 'border-red-400/40 shadow-red-500/5' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 flex items-center justify-center flex-shrink-0">
                    <Gavel size={20} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-slate-900 dark:text-slate-100 text-sm font-extrabold">{item.name}</p>
                      {urgent && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-650 uppercase">URGENT</span>}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">{item.property_name} ({item.property_code})</p>
                    <p className="text-slate-400 dark:text-slate-550 text-xs">Reason: {item.auctionable_reason} &middot; Flagged {days} day{days !== 1 ? 's' : ''} ago</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-amber-600 dark:text-amber-405 text-base font-black">{FMT_KES(item.estimated_value_kes)}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs">Est. value</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-auto">
                    <button onClick={() => setSale({ open: true, propId: item.property_id, itemId: item._id, buyer: '', amount: '' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <Gavel size={14} /> Record Sale
                    </button>
                    <button onClick={() => setRecl({ open: true, propId: item.property_id, itemId: item._id, receiptId: '' })}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold cursor-pointer transition"
                    >
                      <Undo size={14} /> Reclaim
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ALL INVENTORY TAB */}
        {tab === 'all' && (
          <div className="flex flex-col gap-4">
            {filtered.length === 0 ? (
              <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                <Package size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-xs">{search ? `No items matching "${search}"` : 'No inventory records found'}</p>
                {!search && <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }}
                  style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Plus size={14} /> Add your first item
                </button>}
              </div>
            ) : filtered.map(prop => (
              <div key={prop.property_id} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-slate-900 dark:text-slate-100">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <Package size={18} className="text-blue-600 dark:text-blue-500" />
                    <div>
                      <p className="text-slate-900 dark:text-slate-100 text-sm font-extrabold">{prop.property_name}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">{prop.property_code} &middot; {(prop.items || []).length} item{(prop.items || []).length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setAdd({ ...E_ADD, open: true, propId: prop.property_id }); setAddErrs({}); }}
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                {(prop.items || []).map(item => (
                  <div key={item._id} className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-slate-900 dark:text-slate-100 text-xs font-bold">{item.name}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">{item.description || 'No description'} &middot; Condition: {item.condition || 'unknown'}</p>
                    </div>
                    <div className="flex items-center gap-3.5 flex-wrap">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-405">{FMT_KES(item.estimated_value_kes)}</span>
                      {item.auction_status === 'sold' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/20 text-emerald-650">SOLD {FMT_KES(item.auction_sale_amount)}</span>}
                      {item.auction_status === 'reclaimed' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/20 text-emerald-650">RECLAIMED</span>}
                      {item.auction_status === 'pending' && item.auctionable_marked_at && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/20 text-amber-650">PENDING AUCTION</span>}
                      {!item.auctionable_marked_at && item.auction_status !== 'sold' && (
                        <button onClick={() => setFlag({ open: true, propId: prop.property_id, itemId: item._id, reason: '' })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          <AlertTriangle size={12} /> Flag Auction
                        </button>
                      )}
                      {item.auction_status === 'pending' && item.auctionable_marked_at && (
                        <button onClick={() => setRecl({ open: true, propId: prop.property_id, itemId: item._id, receiptId: '' })}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          <Undo size={12} /> Reclaim
                        </button>
                      )}
                      {item.auction_status !== 'pending' && (
                        <button onClick={() => setDel({ open: true, propId: prop.property_id, itemId: item._id, itemName: item.name })}
                          title="Delete item"
                          className="flex items-center gap-1 p-1.5 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30 text-red-650 rounded-lg cursor-pointer transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD ITEM MODAL */}
      {addModal.open && (
        <>
          <div onClick={() => { setAdd(E_ADD); setAddErrs({}); }} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold">Add Inventory Item</h3>
              <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }} className="background-none border-none text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer p-1.5 transition">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Property *</label>
                <select value={addModal.propId}
                  onChange={e => { setAdd(a => ({ ...a, propId: e.target.value })); setAddErrs(er => ({ ...er, propId: undefined })); }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none">
                  <option value="">Select a property</option>
                  {properties.map(p => <option key={p._id} value={p._id}>{p.name}{p.property_code ? ` (${p.property_code})` : ''}</option>)}
                </select>
                {addErrs.propId && <p className="text-red-500 text-xs mt-1.5">{addErrs.propId}</p>}
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Item Name *</label>
                <input value={addModal.name}
                  onChange={e => { setAdd(a => ({ ...a, name: e.target.value })); setAddErrs(er => ({ ...er, name: undefined })); }}
                  onBlur={() => { if (!addModal.name.trim()) setAddErrs(er => ({ ...er, name: 'Item name is required' })); }}
                  placeholder="e.g. Sofa Set, Water Heater, Generator"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none" />
                {addErrs.name && <p className="text-red-500 text-xs mt-1.5">{addErrs.name}</p>}
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Description (optional)</label>
                <input value={addModal.description} onChange={e => setAdd(a => ({ ...a, description: e.target.value }))} placeholder="Brand, model, colour, serial number"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Condition</label>
                <select value={addModal.condition} onChange={e => setAdd(a => ({ ...a, condition: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none">
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Estimated Value (KES, optional)</label>
                <input type="number" min="0" value={addModal.estimated_value_kes}
                  onChange={e => { setAdd(a => ({ ...a, estimated_value_kes: e.target.value })); setAddErrs(er => ({ ...er, estimated_value_kes: undefined })); }}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none" />
                {addErrs.estimated_value_kes && <p className="text-red-500 text-xs mt-1.5">{addErrs.estimated_value_kes}</p>}
              </div>
              <div className="flex gap-2.5 mt-4">
                <button onClick={handleAdd} disabled={working.add}
                  style={{ padding: '12px', background: working.add ? 'rgba(37,99,235,0.4)' : 'linear-gradient(135deg,#2563EB,#1D4ED8)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: working.add ? 'not-allowed' : 'pointer', flex: 1 }}>
                  {working.add ? 'Adding...' : 'Add Item'}
                </button>
                <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }}
                  className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-none rounded-xl text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* DELETE CONFIRM */}
      {delModal.open && (
        <>
          <div onClick={() => setDel(E_DEL)} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-650" />
            </div>
            <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold text-center mb-2">Delete Inventory Item?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs text-center mb-6">
              Permanently remove <strong className="text-slate-800 dark:text-slate-200">"{delModal.itemName}"</strong>. This cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleDelete} disabled={working.del}
                style={{ padding: '12px', background: working.del ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: working.del ? 'not-allowed' : 'pointer', flex: 1 }}>
                {working.del ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setDel(E_DEL)}
                className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-none rounded-xl text-xs cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* FLAG MODAL */}
      {flagModal.open && (
        <>
          <div onClick={() => setFlag(E_FLAG)} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold">Flag Item for Auction</h3>
              <button onClick={() => setFlag(E_FLAG)} className="background-none border-none text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer p-1.5 transition">
                <X size={16} />
              </button>
            </div>
            <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Reason *</label>
            <textarea value={flagModal.reason} onChange={e => setFlag(f => ({ ...f, reason: e.target.value }))} rows={3}
              placeholder="e.g. Tenant vacated with 3 months unpaid rent"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none resize-vertical fontFamily-inherit mb-4" />
            <div className="flex gap-2.5">
              <button onClick={handleFlag} disabled={working.flag}
                style={{ padding: '12px', background: working.flag ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: working.flag ? 'not-allowed' : 'pointer', flex: 1 }}>
                {working.flag ? 'Flagging...' : 'Flag for Auction'}
              </button>
              <button onClick={() => setFlag(E_FLAG)}
                className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-none rounded-xl text-xs cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* SALE MODAL */}
      {saleModal.open && (
        <>
          <div onClick={() => setSale(E_SALE)} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold">Record Auction Sale</h3>
              <button onClick={() => setSale(E_SALE)} className="background-none border-none text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer p-1.5 transition">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Buyer Full Name *</label>
                <input value={saleModal.buyer} onChange={e => setSale(s => ({ ...s, buyer: e.target.value }))} placeholder="Full name of buyer"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Sale Amount (KES) *</label>
                <input type="number" min="0" value={saleModal.amount} onChange={e => setSale(s => ({ ...s, amount: e.target.value }))} placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none" />
              </div>
              <div className="flex gap-2.5">
                <button onClick={handleSale} disabled={working.sale}
                  style={{ padding: '12px', background: working.sale ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: working.sale ? 'not-allowed' : 'pointer', flex: 1 }}>
                  {working.sale ? 'Recording...' : 'Record Sale'}
                </button>
                <button onClick={() => setSale(E_SALE)}
                  className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-none rounded-xl text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* RECLAIM MODAL */}
      {reclModal.open && (
        <>
          <div onClick={() => setRecl(E_RECL)} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold">Reclaim Flagged Item</h3>
              <button onClick={() => setRecl(E_RECL)} className="background-none border-none text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer p-1.5 transition">
                <X size={16} />
              </button>
            </div>
            <p className="text-slate-550 dark:text-slate-400 text-xs mb-4">
              Enter the M-Pesa or cash Payment Receipt Mongo ID generated when the tenant cleared their outstanding balance.
            </p>
            <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Payment Receipt ID *</label>
            <input value={reclModal.receiptId} onChange={e => setRecl(s => ({ ...s, receiptId: e.target.value }))}
              placeholder="e.g. 648fb907f12e84128f9ac124"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none font-mono mb-4" />
            <div className="flex gap-2.5">
              <button onClick={handleReclaim} disabled={working.recl}
                style={{ padding: '12px', background: working.recl ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: working.recl ? 'not-allowed' : 'pointer', flex: 1 }}>
                {working.recl ? 'Reclaiming...' : 'Reclaim Item'}
              </button>
              <button onClick={() => setRecl(E_RECL)}
                className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-none rounded-xl text-xs cursor-pointer transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
