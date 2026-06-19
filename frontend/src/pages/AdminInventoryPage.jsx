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

  const tab$ = t => ({ padding:'8px 20px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, transition:'all 0.2s',
    background: tab===t ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)', color: tab===t ? '#fff' : 'rgba(255,255,255,0.45)' });
  const inp$ = err => ({ width:'100%', background:'rgba(255,255,255,0.08)', border:`1px solid ${err?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.15)'}`,
    borderRadius:12, padding:'12px 16px', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' });
  const lbl$ = { color:'rgba(255,255,255,0.55)', fontSize:11, fontWeight:700, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' };
  const btn$ = (bg, extra={}) => ({ padding:'12px', background:bg, color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', flex:1, ...extra });
  const overlay$ = { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, backdropFilter:'blur(4px)' };
  const modal$ = (bc='rgba(255,255,255,0.12)') => ({ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
    width:'90%', maxWidth:460, zIndex:201, background:'linear-gradient(135deg,#1a1a3e,#0f0c29)', border:`1px solid ${bc}`,
    borderRadius:24, padding:32, boxShadow:'0 32px 64px rgba(0,0,0,0.6)', maxHeight:'90vh', overflowY:'auto' });
  const mHead$ = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 };
  const closeBtn$ = { background:'rgba(255,255,255,0.08)', border:'none', borderRadius:8, padding:'6px 8px', cursor:'pointer', color:'rgba(255,255,255,0.6)' };

  if (loading) return (
    <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#0f0c29,#24243e)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid rgba(16,185,129,0.3)', borderTop:'3px solid #10b981', animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>Loading inventory…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)', padding:'28px', color:'#fff' }}>
      <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, fontSize:12, color:'rgba(255,255,255,0.35)' }}>
          <span>Admin</span><ChevronRight size={12} /><span style={{ color:'rgba(255,255,255,0.7)' }}>Inventory &amp; Auction</span>
        </div>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <h1 style={{ color:'#fff', fontSize:26, fontWeight:900, margin:0 }}>Inventory &amp; Auction Control</h1>
              <button onClick={() => setShowInfo(v=>!v)} title="How it works"
                style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:8, padding:'4px 8px', cursor:'pointer', color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center' }}>
                <Info size={14} />
              </button>
            </div>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:0 }}>Track assets &middot; flag for auction &middot; reclaim items &middot; log public sales</p>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(99,102,241,0.35)' }}>
              <Plus size={15} /> Add Item
            </button>
            <button onClick={handleDownload} disabled={downloading}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px', background: downloading ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor: downloading ? 'not-allowed' : 'pointer', boxShadow:'0 6px 20px rgba(16,185,129,0.3)' }}>
              <Download size={15} /> {downloading ? 'Downloading…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:16, padding:'16px 20px', marginBottom:24, fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.8 }}>
            <strong style={{ color:'#a5b4fc' }}>How Inventory Works:</strong><br />
            1. <strong>Add Item</strong> — register any physical asset against a property (furniture, appliance, equipment).<br />
            2. <strong>Flag for Auction</strong> — mark auctionable when a tenant vacates with arrears.<br />
            3. <strong>Reclaim</strong> — if tenant pays, reclaim using the Payment Receipt ID.<br />
            4. <strong>Record Sale</strong> — log the auction outcome (buyer + amount) for KRA records.<br />
            5. <strong>Export CSV</strong> — download a KRA-compliant auction report.
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
          {[
            { label:'Auctionable Items',      value:auctionable.length,     icon:<Gavel size={18}/>,      color:'#fbbf24' },
            { label:'Est. Auction Value',     value:FMT_KES(auctionValue),  icon:<DollarSign size={18}/>, color:'#10b981' },
            { label:'Properties with Assets', value:allInventory.length,    icon:<Package size={18}/>,    color:'#6366f1' },
            { label:'Total Assets',           value:totalItems,             icon:<TrendingUp size={18}/>, color:'#ec4899' },
          ].map((s,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:20 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:`${s.color}22`, border:`1px solid ${s.color}44`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <span style={{ color:s.color }}>{s.icon}</span>
              </div>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{s.label}</p>
              <p style={{ color:'#fff', fontSize:20, fontWeight:900 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:8 }}>
            <button style={tab$('auctionable')} onClick={() => setTab('auctionable')}>
              {String.fromCodePoint(0x1F528)} Auctionable ({auctionable.length})
            </button>
            <button style={tab$('all')} onClick={() => setTab('all')}>
              {String.fromCodePoint(0x1F4E6)} All Inventory ({totalItems})
            </button>
          </div>
          {tab === 'all' && (
            <div style={{ position:'relative', minWidth:220 }}>
              <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or properties…"
                style={{ width:'100%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'8px 12px 8px 34px', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
          )}
        </div>

        {/* AUCTIONABLE TAB */}
        {tab === 'auctionable' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {auctionable.length === 0 ? (
              <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:48, textAlign:'center' }}>
                <Gavel size={40} style={{ color:'rgba(255,255,255,0.15)', margin:'0 auto 12px' }} />
                <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14 }}>No items flagged for auction</p>
                <p style={{ color:'rgba(255,255,255,0.2)', fontSize:12, marginTop:8 }}>Flag items from the All Inventory tab</p>
              </div>
            ) : auctionable.map(item => {
              const days = daysSince(item.auctionable_marked_at);
              const urgent = days >= 30;
              return (
                <div key={`${item.property_id}-${item._id}`} style={{ background: urgent ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', border:`1px solid ${urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius:20, padding:'20px 24px', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'rgba(251,191,36,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Gavel size={20} style={{ color:'#fbbf24' }} />
                  </div>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <p style={{ color:'#fff', fontSize:15, fontWeight:800 }}>{item.name}</p>
                      {urgent && <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:100, background:'rgba(239,68,68,0.2)', color:'#f87171', textTransform:'uppercase' }}>URGENT</span>}
                    </div>
                    <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, marginBottom:2 }}>{item.property_name} ({item.property_code})</p>
                    <p style={{ color:'rgba(255,255,255,0.35)', fontSize:12 }}>Reason: {item.auctionable_reason} &middot; Flagged {days} day{days!==1?'s':''} ago</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ color:'#fbbf24', fontSize:16, fontWeight:800 }}>{FMT_KES(item.estimated_value_kes)}</p>
                    <p style={{ color:'rgba(255,255,255,0.35)', fontSize:11 }}>Est. value</p>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button onClick={() => setSale({ open:true, propId:item.property_id, itemId:item._id, buyer:'', amount:'' })}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      <Gavel size={14} /> Record Sale
                    </button>
                    <button onClick={() => setRecl({ open:true, propId:item.property_id, itemId:item._id, receiptId:'' })}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'rgba(16,185,129,0.2)', color:'#34d399', border:'1px solid rgba(16,185,129,0.3)', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer' }}>
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
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {filtered.length === 0 ? (
              <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:48, textAlign:'center' }}>
                <Package size={40} style={{ color:'rgba(255,255,255,0.15)', margin:'0 auto 12px' }} />
                <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14 }}>{search ? `No items matching "${search}"` : 'No inventory records found'}</p>
                {!search && <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }}
                  style={{ marginTop:16, display:'inline-flex', alignItems:'center', gap:6, padding:'10px 20px', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  <Plus size={14} /> Add your first item
                </button>}
              </div>
            ) : filtered.map(prop => (
              <div key={prop.property_id} style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, overflow:'hidden' }}>
                <div style={{ padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Package size={18} style={{ color:'#6366f1' }} />
                    <div>
                      <p style={{ color:'#fff', fontSize:14, fontWeight:800 }}>{prop.property_name}</p>
                      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:11 }}>{prop.property_code} &middot; {(prop.items||[]).length} item{(prop.items||[]).length!==1?'s':''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setAdd({ ...E_ADD, open:true, propId:prop.property_id }); setAddErrs({}); }}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                {(prop.items||[]).map(item => (
                  <div key={item._id} style={{ padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:160 }}>
                      <p style={{ color:'#fff', fontSize:13, fontWeight:600 }}>{item.name}</p>
                      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:11 }}>{item.description||'No description'} &middot; Condition: {item.condition||'unknown'}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#fbbf24' }}>{FMT_KES(item.estimated_value_kes)}</span>
                      {item.auction_status==='sold'      && <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:100, background:'rgba(16,185,129,0.15)', color:'#34d399' }}>SOLD {FMT_KES(item.auction_sale_amount)}</span>}
                      {item.auction_status==='reclaimed' && <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:100, background:'rgba(16,185,129,0.15)', color:'#34d399' }}>RECLAIMED</span>}
                      {item.auction_status==='pending'&&item.auctionable_marked_at && <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:100, background:'rgba(251,191,36,0.15)', color:'#fbbf24' }}>PENDING AUCTION</span>}
                      {!item.auctionable_marked_at && item.auction_status!=='sold' && (
                        <button onClick={() => setFlag({ open:true, propId:prop.property_id, itemId:item._id, reason:'' })}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.3)', color:'#fbbf24', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          <AlertTriangle size={12} /> Flag Auction
                        </button>
                      )}
                      {item.auction_status==='pending'&&item.auctionable_marked_at && (
                        <button onClick={() => setRecl({ open:true, propId:prop.property_id, itemId:item._id, receiptId:'' })}
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#34d399', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          <Undo size={12} /> Reclaim
                        </button>
                      )}
                      {item.auction_status!=='pending' && (
                        <button onClick={() => setDel({ open:true, propId:prop.property_id, itemId:item._id, itemName:item.name })}
                          title="Delete item"
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>
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
      {addModal.open && (<>
        <div onClick={() => { setAdd(E_ADD); setAddErrs({}); }} style={overlay$} />
        <div style={modal$()}>
          <div style={mHead$}>
            <h3 style={{ color:'#fff', fontSize:18, fontWeight:800, margin:0 }}>Add Inventory Item</h3>
            <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }} style={closeBtn$}><X size={16} /></button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={lbl$}>Property *</label>
              <select value={addModal.propId}
                onChange={e => { setAdd(a => ({ ...a, propId:e.target.value })); setAddErrs(er => ({ ...er, propId:undefined })); }}
                style={{ ...inp$(addErrs.propId), appearance:'none' }}>
                <option value="">Select a property</option>
                {properties.map(p => <option key={p._id} value={p._id} style={{ background:'#1a1a3e' }}>{p.name}{p.property_code?` (${p.property_code})`:''}</option>)}
              </select>
              {addErrs.propId && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{addErrs.propId}</p>}
            </div>
            <div>
              <label style={lbl$}>Item Name *</label>
              <input value={addModal.name}
                onChange={e => { setAdd(a => ({ ...a, name:e.target.value })); setAddErrs(er => ({ ...er, name:undefined })); }}
                onBlur={() => { if (!addModal.name.trim()) setAddErrs(er => ({ ...er, name:'Item name is required' })); }}
                placeholder="e.g. Sofa Set, Water Heater, Generator" style={inp$(addErrs.name)} />
              {addErrs.name && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{addErrs.name}</p>}
            </div>
            <div>
              <label style={lbl$}>Description (optional)</label>
              <input value={addModal.description} onChange={e => setAdd(a => ({ ...a, description:e.target.value }))} placeholder="Brand, model, colour, serial number" style={inp$(false)} />
            </div>
            <div>
              <label style={lbl$}>Condition</label>
              <select value={addModal.condition} onChange={e => setAdd(a => ({ ...a, condition:e.target.value }))} style={{ ...inp$(false), appearance:'none' }}>
                <option value="good"    style={{ background:'#1a1a3e' }}>Good</option>
                <option value="fair"    style={{ background:'#1a1a3e' }}>Fair</option>
                <option value="poor"    style={{ background:'#1a1a3e' }}>Poor</option>
                <option value="damaged" style={{ background:'#1a1a3e' }}>Damaged</option>
              </select>
            </div>
            <div>
              <label style={lbl$}>Estimated Value (KES, optional)</label>
              <input type="number" min="0" value={addModal.estimated_value_kes}
                onChange={e => { setAdd(a => ({ ...a, estimated_value_kes:e.target.value })); setAddErrs(er => ({ ...er, estimated_value_kes:undefined })); }}
                placeholder="0" style={inp$(addErrs.estimated_value_kes)} />
              {addErrs.estimated_value_kes && <p style={{ color:'#f87171', fontSize:11, marginTop:4 }}>{addErrs.estimated_value_kes}</p>}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button onClick={handleAdd} disabled={working.add}
                style={btn$(working.add ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', { cursor: working.add ? 'not-allowed' : 'pointer' })}>
                {working.add ? 'Adding...' : 'Add Item'}
              </button>
              <button onClick={() => { setAdd(E_ADD); setAddErrs({}); }}
                style={btn$('rgba(255,255,255,0.08)', { border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)' })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>)}

      {/* DELETE CONFIRM */}
      {delModal.open && (<>
        <div onClick={() => setDel(E_DEL)} style={overlay$} />
        <div style={modal$('rgba(239,68,68,0.25)')}>
          <div style={{ width:52, height:52, borderRadius:14, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Trash2 size={24} style={{ color:'#f87171' }} />
          </div>
          <h3 style={{ color:'#fff', fontSize:17, fontWeight:800, textAlign:'center', marginBottom:8 }}>Delete Inventory Item?</h3>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, textAlign:'center', marginBottom:24 }}>
            Permanently remove <strong style={{ color:'#fff' }}>"{delModal.itemName}"</strong>. This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleDelete} disabled={working.del}
              style={btn$(working.del ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg,#ef4444,#dc2626)', { cursor: working.del ? 'not-allowed' : 'pointer' })}>
              {working.del ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button onClick={() => setDel(E_DEL)}
              style={btn$('rgba(255,255,255,0.08)', { border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)' })}>
              Cancel
            </button>
          </div>
        </div>
      </>)}

      {/* FLAG MODAL */}
      {flagModal.open && (<>
        <div onClick={() => setFlag(E_FLAG)} style={overlay$} />
        <div style={modal$()}>
          <div style={mHead$}>
            <h3 style={{ color:'#fff', fontSize:18, fontWeight:800, margin:0 }}>Flag Item for Auction</h3>
            <button onClick={() => setFlag(E_FLAG)} style={closeBtn$}><X size={16} /></button>
          </div>
          <label style={lbl$}>Reason *</label>
          <textarea value={flagModal.reason} onChange={e => setFlag(f => ({ ...f, reason:e.target.value }))} rows={3}
            placeholder="e.g. Tenant vacated with 3 months unpaid rent"
            style={{ width:'100%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, padding:'12px 16px', color:'#fff', fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', marginBottom:16 }} />
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleFlag} disabled={working.flag}
              style={btn$(working.flag ? 'rgba(245,158,11,0.3)' : 'linear-gradient(135deg,#f59e0b,#d97706)', { cursor: working.flag ? 'not-allowed' : 'pointer' })}>
              {working.flag ? 'Flagging...' : 'Flag for Auction'}
            </button>
            <button onClick={() => setFlag(E_FLAG)}
              style={btn$('rgba(255,255,255,0.08)', { border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)' })}>
              Cancel
            </button>
          </div>
        </div>
      </>)}

      {/* SALE MODAL */}
      {saleModal.open && (<>
        <div onClick={() => setSale(E_SALE)} style={overlay$} />
        <div style={modal$()}>
          <div style={mHead$}>
            <h3 style={{ color:'#fff', fontSize:18, fontWeight:800, margin:0 }}>Record Auction Sale</h3>
            <button onClick={() => setSale(E_SALE)} style={closeBtn$}><X size={16} /></button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl$}>Buyer Full Name *</label>
              <input value={saleModal.buyer} onChange={e => setSale(s => ({ ...s, buyer:e.target.value }))} placeholder="Full name of buyer" style={inp$(false)} />
            </div>
            <div>
              <label style={lbl$}>Sale Amount (KES) *</label>
              <input type="number" min="0" value={saleModal.amount} onChange={e => setSale(s => ({ ...s, amount:e.target.value }))} placeholder="0" style={inp$(false)} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleSale} disabled={working.sale}
                style={btn$(working.sale ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)', { cursor: working.sale ? 'not-allowed' : 'pointer' })}>
                {working.sale ? 'Recording...' : 'Record Sale'}
              </button>
              <button onClick={() => setSale(E_SALE)}
                style={btn$('rgba(255,255,255,0.08)', { border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)' })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>)}

      {/* RECLAIM MODAL */}
      {reclModal.open && (<>
        <div onClick={() => setRecl(E_RECL)} style={overlay$} />
        <div style={modal$()}>
          <div style={mHead$}>
            <h3 style={{ color:'#fff', fontSize:18, fontWeight:800, margin:0 }}>Reclaim Flagged Item</h3>
            <button onClick={() => setRecl(E_RECL)} style={closeBtn$}><X size={16} /></button>
          </div>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginBottom:16 }}>
            Enter the M-Pesa or cash Payment Receipt Mongo ID generated when the tenant cleared their outstanding balance.
          </p>
          <label style={lbl$}>Payment Receipt ID *</label>
          <input value={reclModal.receiptId} onChange={e => setRecl(s => ({ ...s, receiptId:e.target.value }))}
            placeholder="e.g. 648fb907f12e84128f9ac124"
            style={{ ...inp$(false), fontFamily:'monospace', marginBottom:16 }} />
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleReclaim} disabled={working.recl}
              style={btn$(working.recl ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)', { cursor: working.recl ? 'not-allowed' : 'pointer' })}>
              {working.recl ? 'Reclaiming...' : 'Reclaim Item'}
            </button>
            <button onClick={() => setRecl(E_RECL)}
              style={btn$('rgba(255,255,255,0.08)', { border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)' })}>
              Cancel
            </button>
          </div>
        </div>
      </>)}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        select option { background: #1a1a3e; color: #fff; }
      `}</style>
    </div>
  );
}
