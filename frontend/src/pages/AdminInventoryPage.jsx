import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  fetchAllInventory, fetchAuctionableItems, markItemAuctionable,
  recordAuctionSale, downloadAuctionReport
} from '../lib/api';
import {
  Package, Gavel, CheckCircle2, Clock, TrendingUp,
  Download, Plus, X, AlertTriangle, DollarSign
} from 'lucide-react';

const FMT_KES = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = d => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

export default function AdminInventoryPage() {
  const [allInventory,  setAll]       = useState([]);
  const [auctionable,   setAuction]   = useState([]);
  const [loading,       setLoading]   = useState(true);
  const [tab,           setTab]       = useState('auctionable');
  const [flagModal,     setFlagModal] = useState({ open: false, propId: null, itemId: null, reason: '' });
  const [saleModal,     setSaleModal] = useState({ open: false, propId: null, itemId: null, buyer: '', amount: '' });
  const [downloading,   setDownload]  = useState(false);
  const [working,       setWorking]   = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, auc] = await Promise.allSettled([fetchAllInventory(), fetchAuctionableItems()]);
      if (all.status === 'fulfilled') setAll(Array.isArray(all.value?.data) ? all.value.data : []);
      if (auc.status === 'fulfilled') setAuction(Array.isArray(auc.value?.data) ? auc.value.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkAuctionable = async () => {
    if (!flagModal.reason.trim()) { toast.error('Reason is required'); return; }
    setWorking(w => ({ ...w, flag: true }));
    try {
      await markItemAuctionable(flagModal.propId, { item_id: flagModal.itemId, reason: flagModal.reason });
      toast.success('Item flagged for auction');
      setFlagModal({ open: false, propId: null, itemId: null, reason: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to flag item');
    } finally {
      setWorking(w => ({ ...w, flag: false }));
    }
  };

  const handleRecordSale = async () => {
    if (!saleModal.buyer.trim() || !saleModal.amount || Number(saleModal.amount) <= 0) {
      toast.error('Please provide buyer name and valid sale amount');
      return;
    }
    setWorking(w => ({ ...w, sale: true }));
    try {
      await recordAuctionSale(saleModal.propId, {
        item_id: saleModal.itemId,
        buyer: saleModal.buyer,
        sale_amount: Number(saleModal.amount)
      });
      toast.success('Auction sale recorded!');
      setSaleModal({ open: false, propId: null, itemId: null, buyer: '', amount: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to record sale');
    } finally {
      setWorking(w => ({ ...w, sale: false }));
    }
  };

  const handleDownload = async () => {
    setDownload(true);
    try {
      await downloadAuctionReport();
      toast.success('Auction report downloaded');
    } catch (err) {
      toast.error('Download failed');
    } finally {
      setDownload(false);
    }
  };

  const totalAuctionableValue = auctionable.reduce((s, i) => s + Number(i.estimated_value_kes || 0), 0);

  const tabStyle = (t) => ({
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
    background: tab === t ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
    color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)'
  });

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #24243e)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading inventory…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', padding: '28px' }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Inventory & Auction</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Manage property assets and auction records</p>
          </div>
          <button onClick={handleDownload} disabled={downloading} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            background: downloading ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 20px rgba(16,185,129,0.3)'
          }}>
            <Download size={15} /> {downloading ? 'Downloading…' : 'Export KRA Report'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Auctionable Items', value: auctionable.length, icon: <Gavel size={18} />, color: '#f59e0b' },
            { label: 'Est. Auction Value', value: FMT_KES(totalAuctionableValue), icon: <DollarSign size={18} />, color: '#10b981' },
            { label: 'Properties with Assets', value: allInventory.length, icon: <Package size={18} />, color: '#6366f1' }
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}22`, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</p>
              <p style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button style={tabStyle('auctionable')} onClick={() => setTab('auctionable')}>
            🔨 Auctionable ({auctionable.length})
          </button>
          <button style={tabStyle('all')} onClick={() => setTab('all')}>📦 All Inventory</button>
        </div>

        {/* AUCTIONABLE ITEMS */}
        {tab === 'auctionable' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {auctionable.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Gavel size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No items flagged for auction</p>
              </div>
            ) : auctionable.map((item, i) => {
              const days = daysSince(item.auctionable_marked_at);
              const urgent = days >= 30;
              return (
                <div key={`${item.property_id}-${item._id}`} style={{
                  background: urgent ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 20, padding: '20px 24px',
                  display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap'
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Gavel size={20} style={{ color: '#fbbf24' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>{item.name}</p>
                      {urgent && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 100, background: 'rgba(239,68,68,0.2)', color: '#f87171', textTransform: 'uppercase' }}>URGENT</span>}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 2 }}>
                      🏢 {item.property_name} ({item.property_code})
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                      Reason: {item.auctionable_reason} · Flagged {days} days ago
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: '#fbbf24', fontSize: 16, fontWeight: 800 }}>{FMT_KES(item.estimated_value_kes)}</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>Est. value</p>
                  </div>

                  <button onClick={() => setSaleModal({ open: true, propId: item.property_id, itemId: item._id, buyer: '', amount: '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(245,158,11,0.4)', flexShrink: 0 }}>
                    <Gavel size={14} /> Record Sale
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ALL INVENTORY */}
        {tab === 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {allInventory.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Package size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No inventory records found</p>
              </div>
            ) : allInventory.map(prop => (
              <div key={prop.property_id} style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Package size={18} style={{ color: '#6366f1' }} />
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{prop.property_name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{prop.property_code} · {prop.items.length} items</p>
                  </div>
                </div>
                {prop.items.map(item => (
                  <div key={item._id} style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{item.description} · Condition: {item.condition}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{FMT_KES(item.estimated_value_kes)}</span>
                      {!item.auctionable_marked_at && (
                        <button onClick={() => setFlagModal({ open: true, propId: prop.property_id, itemId: item._id, reason: '' })}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          <AlertTriangle size={12} /> Flag for Auction
                        </button>
                      )}
                      {item.auction_status === 'sold' && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 100, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✓ SOLD {FMT_KES(item.auction_sale_amount)}</span>
                      )}
                      {item.auction_status === 'pending' && item.auctionable_marked_at && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 100, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>🔨 PENDING AUCTION</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flag modal */}
      {flagModal.open && (
        <>
          <div onClick={() => setFlagModal({ open: false, propId: null, itemId: null, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Flag Item for Auction</h3>
            <textarea value={flagModal.reason} onChange={e => setFlagModal(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Reason for flagging this item for auction…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleMarkAuctionable} disabled={working.flag} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {working.flag ? 'Flagging…' : '🔨 Flag for Auction'}
              </button>
              <button onClick={() => setFlagModal({ open: false, propId: null, itemId: null, reason: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Sale modal */}
      {saleModal.open && (
        <>
          <div onClick={() => setSaleModal({ open: false, propId: null, itemId: null, buyer: '', amount: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Record Auction Sale</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Buyer Name *</label>
                <input value={saleModal.buyer} onChange={e => setSaleModal(s => ({ ...s, buyer: e.target.value }))} placeholder="Full name of the buyer"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sale Amount (KES) *</label>
                <input type="number" value={saleModal.amount} onChange={e => setSaleModal(s => ({ ...s, amount: e.target.value }))} placeholder="0"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={handleRecordSale} disabled={working.sale} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {working.sale ? 'Recording…' : '✓ Record Sale'}
                </button>
                <button onClick={() => setSaleModal({ open: false, propId: null, itemId: null, buyer: '', amount: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
