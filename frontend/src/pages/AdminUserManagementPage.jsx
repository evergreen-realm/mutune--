import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  fetchUsers, disableUser, enableUser, softDeleteUser,
  approveProperty, rejectProperty, fetchPendingAgents,
  approveAgent, rejectAgent, fetchLateFeeRules,
  createLateFeeRule, updateLateFeeRule, deleteLateFeeRule
} from '../lib/api';
import {
  Users2, ShieldCheck, ShieldOff, Trash2, Building2,
  CheckCircle2, XCircle, AlertTriangle, Search, Filter,
  Clock, Eye, RefreshCw, FileText, PlusCircle, Settings, Edit
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
  const [users, setUsers]                 = useState([]);
  const [pendingProps, setPending]       = useState([]);
  const [pendingAgents, setPendingAgents] = useState([]);
  const [lateFeeRules, setLateFeeRules]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState('users');
  const [roleFilter, setRoleFilter]       = useState('');
  const [search, setSearch]               = useState('');
  const [rejectModal, setRejectModal]     = useState({ open: false, propId: null, reason: '' });
  const [agentRejectModal, setAgentRejectModal] = useState({ open: false, agentId: null, reason: '' });
  const [ruleModal, setRuleModal]         = useState({ open: false, rule: null, name: '', grace_days: 5, penalty_type: 'percentage', penalty_value: 5, max_penalty_per_month: '', applies_to: 'all', is_active: true });
  const [working, setWorking]             = useState({});

  const setWorking_ = (id, val) => setWorking(prev => ({ ...prev, [id]: val }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, a, r] = await Promise.allSettled([
        fetchUsers({ limit: 200 }),
        fetch(`${import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1'}/properties?status=pending_admin_approval`, {
          headers: { Authorization: `Bearer ${await window.Clerk?.session?.getToken()}` }
        }).then(res => res.json()),
        fetchPendingAgents(),
        fetchLateFeeRules()
      ]);
      
      if (u.status === 'fulfilled') setUsers(Array.isArray(u.value?.data) ? u.value.data : []);
      if (p.status === 'fulfilled' && p.value?.data) setPending(Array.isArray(p.value.data) ? p.value.data.filter(pr => pr.status === 'pending_admin_approval') : []);
      if (a.status === 'fulfilled' && a.value?.data) setPendingAgents(Array.isArray(a.value.data) ? a.value.data : []);
      if (r.status === 'fulfilled' && r.value?.data) setLateFeeRules(Array.isArray(r.value.data) ? r.value.data : []);
    } catch (err) {
      toast.error('Failed to load administrative panel statistics');
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
    if (!window.confirm(`Permanently delete and anonymize ${name}?\n\nThis will:\n• Anonymize PII\n• Deactivate account\n• Vacate their unit\n• Delete Clerk account\n\nThis cannot be undone.`)) return;
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

  // Property approvals
  const handleApproveProp = async (propId) => {
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

  const handleRejectProp = async () => {
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

  // Agent approvals
  const handleApproveAgent = async (agentId) => {
    setWorking_(agentId, true);
    try {
      await approveAgent(agentId);
      toast.success('Estate agent account activated and approved!');
      setPendingAgents(prev => prev.filter(a => a._id !== agentId));
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to approve agent');
    } finally {
      setWorking_(agentId, false);
    }
  };

  const handleRejectAgent = async () => {
    if (!agentRejectModal.reason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setWorking_(agentRejectModal.agentId, 'reject');
    try {
      await rejectAgent(agentRejectModal.agentId, agentRejectModal.reason);
      toast.success('Agent registration rejected');
      setPendingAgents(prev => prev.filter(a => a._id !== agentRejectModal.agentId));
      setAgentRejectModal({ open: false, agentId: null, reason: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed');
    } finally {
      setWorking_(agentRejectModal.agentId, false);
    }
  };

  // Late Fee Rules CRUD
  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleModal.name.trim()) { toast.error('Rule name is required'); return; }
    if (ruleModal.penalty_value <= 0) { toast.error('Penalty value must be greater than 0'); return; }

    const payload = {
      name: ruleModal.name.trim(),
      grace_days: Number(ruleModal.grace_days),
      penalty_type: ruleModal.penalty_type,
      penalty_value: Number(ruleModal.penalty_value),
      max_penalty_per_month: ruleModal.max_penalty_per_month ? Number(ruleModal.max_penalty_per_month) : undefined,
      applies_to: ruleModal.applies_to,
      is_active: ruleModal.is_active
    };

    const isEdit = !!ruleModal.rule;
    const ruleId = isEdit ? ruleModal.rule._id : null;

    setWorking_(isEdit ? ruleId : 'new_rule', true);
    try {
      if (isEdit) {
        const res = await updateLateFeeRule(ruleId, payload);
        toast.success('Late fee rule updated successfully');
        setLateFeeRules(prev => prev.map(r => r._id === ruleId ? res.data : r));
      } else {
        const res = await createLateFeeRule(payload);
        toast.success('Late fee rule created successfully');
        setLateFeeRules(prev => [res.data, ...prev]);
      }
      setRuleModal({ open: false, rule: null, name: '', grace_days: 5, penalty_type: 'percentage', penalty_value: 5, max_penalty_per_month: '', applies_to: 'all', is_active: true });
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to save late fee rule');
    } finally {
      setWorking_(isEdit ? ruleId : 'new_rule', false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to permanently delete this late fee rule?')) return;
    setWorking_(ruleId, 'delete');
    try {
      await deleteLateFeeRule(ruleId);
      toast.success('Late fee rule deleted');
      setLateFeeRules(prev => prev.filter(r => r._id !== ruleId));
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to delete rule');
    } finally {
      setWorking_(ruleId, false);
    }
  };

  const openEditRuleModal = (rule) => {
    setRuleModal({
      open: true,
      rule,
      name: rule.name,
      grace_days: rule.grace_days,
      penalty_type: rule.penalty_type,
      penalty_value: rule.penalty_value,
      max_penalty_per_month: rule.max_penalty_per_month || '',
      applies_to: rule.applies_to,
      is_active: rule.is_active
    });
  };

  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !u.full_name?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabStyle = (t) => ({
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
    background: tab === t ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)',
    color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)'
  });

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #24243e)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(16,185,129,0.3)', borderTop: '3px solid #10b981', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading Administrative panel data…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', padding: '28px', color: '#fff' }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>User & System Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Approve agents, manage late fees, and monitor system profiles</p>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh Panel
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button style={tabStyle('users')} onClick={() => setTab('users')}>👥 Users ({users.length})</button>
          <button style={tabStyle('properties')} onClick={() => setTab('properties')}>
            🏢 Pending Properties
            {pendingProps.length > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: 10, fontWeight: 800 }}>{pendingProps.length}</span>}
          </button>
          <button style={tabStyle('agents')} onClick={() => setTab('agents')}>
            💼 Agent Approvals
            {pendingAgents.length > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: 10, fontWeight: 800 }}>{pendingAgents.length}</span>}
          </button>
          <button style={tabStyle('rules')} onClick={() => setTab('rules')}>⚙️ Late Fee Rules ({lateFeeRules.length})</button>
        </div>

        {/* USERS TAB */}
        {tab === 'users' && (
          <>
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

            <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Users2 size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No users found</p>
                </div>
              ) : filtered.map(u => (
                <div key={u._id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${ROLE_COLORS[u.role] || '#6366f1'}33`, border: `1px solid ${ROLE_COLORS[u.role] || '#6366f1'}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ROLE_COLORS[u.role] || '#6366f1', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                    {u.full_name?.charAt(0) || 'U'}
                  </div>

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{u.full_name || 'Unknown'}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{u.email} · {u.phone}</p>
                  </div>

                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: `${ROLE_COLORS[u.role] || '#6366f1'}22`, color: ROLE_COLORS[u.role] || '#6366f1', border: `1px solid ${ROLE_COLORS[u.role] || '#6366f1'}44`, textTransform: 'capitalize' }}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>

                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.is_active ? '#34d399' : '#f87171', border: `1px solid ${u.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                    {u.is_active ? '● Active' : '● Inactive'}
                  </span>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDisable(u._id, u.is_active)}
                      disabled={!!working[u._id]}
                      style={{ background: u.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', border: 'none', color: u.is_active ? '#f87171' : '#34d399', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {u.is_active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                      {working[u._id] === true ? '…' : u.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleSoftDelete(u._id, u.full_name)}
                      disabled={working[u._id] === 'delete'}
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
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyBetween: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
                      onClick={() => handleApproveProp(prop._id)}
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

        {/* AGENT APPROVALS TAB */}
        {tab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendingAgents.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Clock size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No pending estate agent applications</p>
              </div>
            ) : pendingAgents.map(agent => (
              <div key={agent._id} style={{ background: 'rgba(16,185,129,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>⏳ EARB Review Required</span>
                      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>License: {agent.earb_license || 'Not provided'}</span>
                    </div>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{agent.full_name}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 }}>
                      📧 {agent.email} · 📞 {agent.phone}
                    </p>
                    {agent.assigned_areas && agent.assigned_areas.length > 0 && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 }}>
                        Areas: {agent.assigned_areas.join(', ')}
                      </p>
                    )}
                    {agent.earb_verification_doc_url && (
                      <a
                        href={agent.earb_verification_doc_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 12, fontWeight: 700, textDecoration: 'none', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '6px 12px', marginTop: 4, transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(52,211,153,0.2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(52,211,153,0.1)'}
                      >
                        <FileText size={14} /> View Practice Certificate PDF
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={() => handleApproveAgent(agent._id)}
                      disabled={!!working[agent._id]}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
                      <CheckCircle2 size={15} /> {working[agent._id] === true ? 'Activating…' : 'Approve & Activate'}
                    </button>
                    <button
                      onClick={() => setAgentRejectModal({ open: true, agentId: agent._id, reason: '' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <XCircle size={15} /> Reject Account
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LATE FEE RULES TAB */}
        {tab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Rent Arrears Rules</h3>
              <button
                onClick={() => setRuleModal({ open: true, rule: null, name: '', grace_days: 5, penalty_type: 'percentage', penalty_value: 5, max_penalty_per_month: '', applies_to: 'all', is_active: true })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
              >
                <PlusCircle size={15} /> Add Late Fee Rule
              </button>
            </div>

            {lateFeeRules.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Settings size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No configured late payment penalties. Rent will not accrue automatic fines.</p>
              </div>
            ) : (
              <div style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', display: 'grid', gap: 16 }}>
                {lateFeeRules.map(rule => (
                  <div key={rule._id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: rule.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)', color: rule.is_active ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
                          {rule.is_active ? '● Running' : '● Paused'}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                          Applies to: {rule.applies_to}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, color: '#fff' }}>{rule.name}</h4>
                      
                      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Grace Days:</span>
                          <span style={{ fontWeight: 700, color: '#fff' }}>{rule.grace_days} Days</span>
                        </div>
                        <div style={{ display: 'flex', justifyBetween: 'space-between', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Penalty Charge:</span>
                          <span style={{ fontWeight: 700, color: '#fff' }}>
                            {rule.penalty_type === 'percentage' ? `${rule.penalty_value}% of Rent` : `Fixed KES ${rule.penalty_value.toLocaleString()}`}
                          </span>
                        </div>
                        {rule.max_penalty_per_month && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Monthly Cap:</span>
                            <span style={{ fontWeight: 700, color: '#fff' }}>KES {rule.max_penalty_per_month.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                      <button
                        onClick={() => openEditRuleModal(rule)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Edit size={13} /> Edit Rule
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule._id)}
                        disabled={working[rule._id] === 'delete'}
                        style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject property modal */}
      {rejectModal.open && (
        <>
          <div onClick={() => setRejectModal({ open: false, propId: null, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Rejection Reason</h3>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))} rows={4} placeholder="Explain why this property is being rejected…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRejectProp} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm Reject</button>
              <button onClick={() => setRejectModal({ open: false, propId: null, reason: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Reject agent modal */}
      {agentRejectModal.open && (
        <>
          <div onClick={() => setAgentRejectModal({ open: false, agentId: null, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Reject Agent Registration</h3>
            <textarea value={agentRejectModal.reason} onChange={e => setAgentRejectModal(r => ({ ...r, reason: e.target.value }))} rows={4} placeholder="Reason for rejecting this estate agent certificate (sent via email)…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRejectAgent} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm Reject</button>
              <button onClick={() => setAgentRejectModal({ open: false, agentId: null, reason: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Rules modal (add/edit) */}
      {ruleModal.open && (
        <>
          <div onClick={() => setRuleModal(rm => ({ ...rm, open: false }))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 480, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 20 }}>
              {ruleModal.rule ? 'Modify Late Fee Rule' : 'Create Late Fee Rule'}
            </h3>
            
            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Rule Title</label>
                <input value={ruleModal.name} onChange={e => setRuleModal(rm => ({ ...rm, name: e.target.value }))} type="text" placeholder="e.g. Nyali Residential Late Payment Fine" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Grace Period (Days)</label>
                  <input value={ruleModal.grace_days} onChange={e => setRuleModal(rm => ({ ...rm, grace_days: e.target.value }))} type="number" min="0" required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Applies To</label>
                  <select value={ruleModal.applies_to} onChange={e => setRuleModal(rm => ({ ...rm, applies_to: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', height: 42, boxSizing: 'border-box' }}>
                    <option value="all">All Properties</option>
                    <option value="residential">Residential Only</option>
                    <option value="commercial">Commercial Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Penalty Type</label>
                  <select value={ruleModal.penalty_type} onChange={e => setRuleModal(rm => ({ ...rm, penalty_type: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', height: 42, boxSizing: 'border-box' }}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (KES)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Penalty Charge</label>
                  <input value={ruleModal.penalty_value} onChange={e => setRuleModal(rm => ({ ...rm, penalty_value: e.target.value }))} type="number" min="0" step="any" required
                    style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Max Monthly Cap (KES, Optional)</label>
                <input value={ruleModal.max_penalty_per_month} onChange={e => setRuleModal(rm => ({ ...rm, max_penalty_per_month: e.target.value }))} type="number" placeholder="No limit if blank" min="0"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', itemsCenter: 'center', gap: 10, margin: '6px 0' }}>
                <input type="checkbox" id="rule-active" checked={ruleModal.is_active} onChange={e => setRuleModal(rm => ({ ...rm, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="rule-active" style={{ fontSize: 12, fontWeight: 700, userSelect: 'none', cursor: 'pointer' }}>Activate this penalty rule immediately</label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="submit" style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {ruleModal.rule ? 'Save Changes' : 'Create Rule'}
                </button>
                <button type="button" onClick={() => setRuleModal(rm => ({ ...rm, open: false }))} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
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
