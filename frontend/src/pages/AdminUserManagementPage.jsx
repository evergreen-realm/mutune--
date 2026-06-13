import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { fetchUsers, disableUser, enableUser, softDeleteUser, fetchProperties, approveProperty, rejectProperty } from '../lib/api';
import {
  Users2, ShieldCheck, ShieldOff, Trash2, Building2,
  CheckCircle2, XCircle, AlertTriangle, Search, Filter,
  Clock, Eye, RefreshCw
} from 'lucide-react';

const ROLE_COLORS = {
  admin: '#6366f1', super_admin: '#8b5cf6', agent: '#10b981',
  landlord: '#f59e0b', tenant: '#ec4899', accountant: '#60a5fa'
};

const ROLE_LABELS = {
  admin: 'Admin', super_admin: 'Super Admin', agent: 'Agent',
  landlord: 'Landlord', tenant: 'Tenant', accountant: 'Accountant'
};

export default function AdminUserManagementPage() {
  const [users, setUsers]         = useState([]);
  const [pendingProps, setPending] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('users');
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, propId: null, reason: '' });
  const [working, setWorking]     = useState({});

  const setWorking_ = (id, val) => setWorking(prev => ({ ...prev, [id]: val }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.allSettled([
        fetchUsers({ limit: 200 }),
        fetchUsers({ limit: 200, role: 'landlord' }).then(async () => fetch(`${import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1'}/properties?status=pending_admin_approval`, {
          headers: { Authorization: `Bearer ${await window.Clerk?.session?.getToken()}` }
        }).then(r => r.json()))
      ]);
      if (u.status === 'fulfilled') setUsers(Array.isArray(u.value?.data) ? u.value.data : []);
      if (p.status === 'fulfilled' && p.value?.data) setPending(Array.isArray(p.value.data) ? p.value.data.filter(pr => pr.status === 'pending_admin_approval') : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDisable = async (id, currentlyActive) => {
    if (!window.confirm(`${currentlyActive ? 'Disable' : 'Enable'} this user account?`)) return;
    setWorking_(id, true);
    try {
      if (currentlyActive) {
        await disableUser(id);
        toast.success('User account disabled');
      } else {
        await enableUser(id);
        toast.success('User account enabled');
      }
      setUsers(prev => prev.map(u => u._id === id ? { ...u, is_active: !currentlyActive } : u));
    } catch (err) {
      toast.error(err?.error?.message || 'Action failed');
    } finally {
      setWorking_(id, false);
    }
  };

  const handleSoftDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete and anonymize ${name}?\n\nThis will:\n• Anonymize all PII\n• Deactivate account\n• Vacate their unit\n• Delete Clerk account\n\nThis cannot be undone.`)) return;
    setWorking_(id, 'delete');
    try {
      await softDeleteUser(id);
      toast.success('User permanently removed');
      setUsers(prev => prev.filter(u => u._id !== id));
    } catch (err) {
      toast.error(err?.error?.message || 'Deletion failed');
    } finally {
      setWorking_(id, false);
    }
  };

  const handleApprove = async (propId) => {
    setWorking_(propId, true);
    try {
      await approveProperty(propId);
      toast.success('Property approved!');
      setPending(prev => prev.filter(p => p._id !== propId));
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to approve');
    } finally {
      setWorking_(propId, false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.reason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setWorking_(rejectModal.propId, 'reject');
    try {
      await rejectProperty(rejectModal.propId, rejectModal.reason);
      toast.success('Property rejected');
      setPending(prev => prev.filter(p => p._id !== rejectModal.propId));
      setRejectModal({ open: false, propId: null, reason: '' });
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed');
    } finally {
      setWorking_(rejectModal.propId, false);
    }
  };

  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !u.full_name?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabStyle = (t) => ({
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
    background: tab === t ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
    color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)'
  });

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #24243e)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading users…</p>
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
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>User Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Manage accounts, roles, and property approvals</p>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button style={tabStyle('users')} onClick={() => setTab('users')}>👥 Users ({users.length})</button>
          <button style={tabStyle('properties')} onClick={() => setTab('properties')}>
            🏢 Pending Properties
            {pendingProps.length > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: 10, fontWeight: 800 }}>{pendingProps.length}</span>}
          </button>
        </div>

        {/* USERS TAB */}
        {tab === 'users' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 16px 10px 36px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}>
                <option value="" style={{ background: '#1a1a3e' }}>All Roles</option>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v} style={{ background: '#1a1a3e' }}>{l}</option>)}
              </select>
            </div>

            {/* Users table */}
            <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Users2 size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No users found</p>
                </div>
              ) : filtered.map(u => (
                <div key={u._id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${ROLE_COLORS[u.role] || '#6366f1'}33`, border: `1px solid ${ROLE_COLORS[u.role] || '#6366f1'}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ROLE_COLORS[u.role] || '#6366f1', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {u.full_name?.charAt(0) || 'U'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{u.full_name || 'Unknown'}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{u.email} · {u.phone}</p>
                  </div>

                  {/* Role badge */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: `${ROLE_COLORS[u.role] || '#6366f1'}22`, color: ROLE_COLORS[u.role] || '#6366f1', border: `1px solid ${ROLE_COLORS[u.role] || '#6366f1'}44`, textTransform: 'capitalize' }}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>

                  {/* Status */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.is_active ? '#34d399' : '#f87171', border: `1px solid ${u.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                    {u.is_active ? '● Active' : '● Inactive'}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDisable(u._id, u.is_active)}
                      disabled={!!working[u._id]}
                      title={u.is_active ? 'Disable account' : 'Enable account'}
                      style={{ background: u.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', border: 'none', color: u.is_active ? '#f87171' : '#34d399', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {u.is_active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                      {working[u._id] === true ? '…' : u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleSoftDelete(u._id, u.full_name)}
                      disabled={working[u._id] === 'delete'}
                      title="Permanently delete & anonymize"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PENDING PROPERTIES TAB */}
        {tab === 'properties' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendingProps.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Building2 size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No properties pending approval</p>
              </div>
            ) : pendingProps.map(prop => (
              <div key={prop._id} style={{ background: 'rgba(251,191,36,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>⏳ Pending Approval</span>
                      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{prop.property_code}</span>
                    </div>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{prop.name}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 }}>
                      📍 {prop.address?.area}, {prop.address?.city} · {prop.type}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      {prop.units?.length || 0} units · {prop.num_floors || 1} floor(s)
                    </p>
                    {prop.description && (
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8 }}>{prop.description}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={() => handleApprove(prop._id)}
                      disabled={!!working[prop._id]}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
                      <CheckCircle2 size={15} /> {working[prop._id] === true ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setRejectModal({ open: true, propId: prop._id, reason: '' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal.open && (
        <>
          <div onClick={() => setRejectModal({ open: false, propId: null, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Rejection Reason</h3>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))} rows={4} placeholder="Explain why this property is being rejected…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleReject} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm Reject</button>
              <button onClick={() => setRejectModal({ open: false, propId: null, reason: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        select option { background: #1a1a3e; }
      `}</style>
    </div>
  );
}
