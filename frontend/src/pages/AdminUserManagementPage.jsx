import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  fetchUsers, disableUser, enableUser, softDeleteUser,
  approveProperty, rejectProperty, fetchPendingAgents,
  approveAgent, rejectAgent, fetchLateFeeRules,
  createLateFeeRule, updateLateFeeRule, deleteLateFeeRule,
  fetchPendingLandlords, approveLandlord, rejectLandlord,
  createLandlordManually, fetchPropertyTiers, createPropertyTier,
  updatePropertyTier, fetchPendingProperties,
  verifyPropertyTier, fetchCustomerCareNumber, updateCustomerCareNumber,
  updateUser
} from '../lib/api';
import ImageUpload from '../components/ImageUpload';
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
  const location = useLocation();
  const [users, setUsers]                 = useState([]);
  const [pendingProps, setPending]       = useState([]);
  const [pendingAgents, setPendingAgents] = useState([]);
  const [pendingLandlords, setPendingLandlords] = useState([]);
  const [propertyTiers, setPropertyTiers] = useState([]);
  const [lateFeeRules, setLateFeeRules]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState(() => location.state?.defaultTab || 'users');
  const [usersError, setUsersError]       = useState(null);
  const [roleFilter, setRoleFilter]       = useState('');
  const [search, setSearch]               = useState('');
  const [rejectModal, setRejectModal]     = useState({ open: false, propId: null, reason: '' });
  const [agentRejectModal, setAgentRejectModal] = useState({ open: false, agentId: null, reason: '' });
  const [landlordRejectModal, setLandlordRejectModal] = useState({ open: false, landlordId: null, reason: '' });
  const [ruleModal, setRuleModal]         = useState({ open: false, rule: null, name: '', grace_days: 5, penalty_type: 'percentage', penalty_value: 5, max_penalty_per_month: '', applies_to: 'all', is_active: true });
  const [landlordModal, setLandlordModal] = useState({ open: false, full_name: '', email: '', phone: '', landlord_verification_doc_url: '' });
  const [tierModal, setTierModal]         = useState({ open: false, tier: null, name: '', min_rent_kes: '', max_rent_kes: '', description: '', criteria: '' });
  const [working, setWorking]             = useState({});
  const [selectedTiers, setSelectedTiers] = useState({});
  const [customerCareNumber, setCustomerCareNumber] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const setWorking_ = (id, val) => setWorking(prev => ({ ...prev, [id]: val }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, a, r, l, t, cc] = await Promise.allSettled([
        fetchUsers({ limit: 200 }),
        fetchPendingProperties(),
        fetchPendingAgents(),
        fetchLateFeeRules(),
        fetchPendingLandlords(),
        fetchPropertyTiers(),
        fetchCustomerCareNumber()
      ]);
      
      if (u.status === 'fulfilled') {
        setUsers(Array.isArray(u.value?.data) ? u.value.data : []);
        setUsersError(null);
      } else {
        setUsersError(u.reason);
      }
      if (p.status === 'fulfilled' && p.value?.data) setPending(Array.isArray(p.value.data) ? p.value.data.filter(pr => pr.status === 'pending_admin_approval') : []);
      if (a.status === 'fulfilled' && a.value?.data) setPendingAgents(Array.isArray(a.value.data) ? a.value.data : []);
      if (r.status === 'fulfilled' && r.value?.data) setLateFeeRules(Array.isArray(r.value.data) ? r.value.data : []);
      if (l.status === 'fulfilled' && l.value?.data) setPendingLandlords(Array.isArray(l.value.data) ? l.value.data : []);
      if (t.status === 'fulfilled' && t.value?.data) setPropertyTiers(Array.isArray(t.value.data) ? t.value.data : []);
      if (cc.status === 'fulfilled' && cc.value?.number) setCustomerCareNumber(cc.value.number);
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

  // Property approvals & tier verification
  const handleApproveProp = async (propId) => {
    const tierId = selectedTiers[propId] || pendingProps.find(p => p._id === propId)?.proposed_tier_id;
    if (!tierId) {
      toast.error('Please select or verify a property tier first.');
      return;
    }
    setWorking_(propId, true);
    try {
      await verifyPropertyTier(propId, { action: 'approve', tier_id: tierId });
      toast.success('Property approved and tier verified!');
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
      await verifyPropertyTier(rejectModal.propId, { action: 'reject', reason: rejectModal.reason });
      toast.success('Property tier verification rejected');
      setPending(prev => prev.filter(p => p._id !== rejectModal.propId));
      setRejectModal({ open: false, propId: null, reason: '' });
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed');
    } finally {
      setWorking_(rejectModal.propId, false);
    }
  };

  const handleUpdateCustomerCare = async (e) => {
    e.preventDefault();
    if (!customerCareNumber.trim()) {
      toast.error('Customer care number is required');
      return;
    }
    setSavingSettings(true);
    try {
      await updateCustomerCareNumber(customerCareNumber.trim());
      toast.success('Customer care number updated successfully');
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to update customer care number');
    } finally {
      setSavingSettings(false);
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

  // Landlord approvals
  const handleApproveLandlord = async (ldId) => {
    setWorking_(ldId, true);
    try {
      await approveLandlord(ldId);
      toast.success('Landlord account approved!');
      setPendingLandlords(prev => prev.filter(l => l._id !== ldId));
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to approve landlord');
    } finally {
      setWorking_(ldId, false);
    }
  };

  const handleRejectLandlord = async () => {
    if (!landlordRejectModal.reason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setWorking_(landlordRejectModal.landlordId, 'reject');
    try {
      await rejectLandlord(landlordRejectModal.landlordId, landlordRejectModal.reason);
      toast.success('Landlord application rejected');
      setPendingLandlords(prev => prev.filter(l => l._id !== landlordRejectModal.landlordId));
      setLandlordRejectModal({ open: false, landlordId: null, reason: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed');
    } finally {
      setWorking_(landlordRejectModal.landlordId, false);
    }
  };

  // Manual Landlord creation
  const handleCreateLandlord = async (e) => {
    e.preventDefault();
    if (!landlordModal.full_name.trim() || !landlordModal.email.trim() || !landlordModal.phone.trim()) {
      toast.error('Name, email, and phone are required');
      return;
    }
    setWorking_('new_landlord', true);
    try {
      await createLandlordManually({
        full_name: landlordModal.full_name.trim(),
        email: landlordModal.email.trim(),
        phone: landlordModal.phone.trim(),
        landlord_verification_doc_url: landlordModal.landlord_verification_doc_url.trim() || undefined
      });
      toast.success('Landlord manually created and notified');
      setLandlordModal({ open: false, full_name: '', email: '', phone: '', landlord_verification_doc_url: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Manual creation failed');
    } finally {
      setWorking_('new_landlord', false);
    }
  };

  // Property Tiers CRUD
  const handleSaveTier = async (e) => {
    e.preventDefault();
    if (!tierModal.name.trim() || !tierModal.min_rent_kes || !tierModal.max_rent_kes) {
      toast.error('Name, min rent, and max rent are required');
      return;
    }
    const payload = {
      name: tierModal.name.trim(),
      min_rent_kes: Number(tierModal.min_rent_kes),
      max_rent_kes: Number(tierModal.max_rent_kes),
      description: tierModal.description.trim(),
      criteria: tierModal.criteria.trim()
    };
    const isEdit = !!tierModal.tier;
    const tierId = isEdit ? tierModal.tier._id : null;

    setWorking_(isEdit ? tierId : 'new_tier', true);
    try {
      if (isEdit) {
        await updatePropertyTier(tierId, payload);
        toast.success('Property tier updated successfully');
      } else {
        await createPropertyTier(payload);
        toast.success('Property tier created successfully');
      }
      setTierModal({ open: false, tier: null, name: '', min_rent_kes: '', max_rent_kes: '', description: '', criteria: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to save property tier');
    } finally {
      setWorking_(isEdit ? tierId : 'new_tier', false);
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

  const openEditTierModal = (tier) => {
    setTierModal({
      open: true,
      tier,
      name: tier.name,
      min_rent_kes: tier.min_rent_kes,
      max_rent_kes: tier.max_rent_kes,
      description: tier.description || '',
      criteria: tier.criteria || ''
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
    <div className="admin-user-management text-foreground" style={{ color: 'var(--foreground)' }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1600, margin: '0 auto' }}>
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
            {pendingProps.length > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: 12, fontWeight: 800 }}>{pendingProps.length}</span>}
          </button>
          <button style={tabStyle('agents')} onClick={() => setTab('agents')}>
            💼 Agent Approvals
            {pendingAgents.length > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: 12, fontWeight: 800 }}>{pendingAgents.length}</span>}
          </button>
          <button style={tabStyle('landlords')} onClick={() => setTab('landlords')}>
            👑 Landlords Approvals
            {pendingLandlords.length > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: 12, fontWeight: 800 }}>{pendingLandlords.length}</span>}
          </button>
          <button style={tabStyle('tiers')} onClick={() => setTab('tiers')}>💎 Property Tiers ({propertyTiers.length})</button>
          <button style={tabStyle('rules')} onClick={() => setTab('rules')}>⚙️ Late Fee Rules ({lateFeeRules.length})</button>
          <button style={tabStyle('settings')} onClick={() => setTab('settings')}>📞 Customer Care</button>
        </div>

        {/* USERS TAB */}
        {tab === 'users' && (
          <>
            {usersError ? (
              <div style={{ padding: 48, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
                <ShieldOff size={40} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Access Restricted</h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
                  {usersError?.error?.message || usersError?.message || 'You do not have the required permissions to view the user list.'}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
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
              <button
                onClick={() => setLandlordModal({ open: true, full_name: '', email: '', phone: '', landlord_verification_doc_url: '' })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
              >
                <PlusCircle size={15} /> Add Landlord
              </button>
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
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      {u.email} · {u.phone}
                      {u.landlord_id && ` · Landlord ID: ${u.landlord_id}`}
                      {u.user_code && u.role === 'agent' && ` · Agent ID: ${u.user_code}`}
                      {u.user_code && u.role === 'tenant' && ` · Tenant Code: ${u.user_code}`}
                    </p>
                  </div>

                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: `${ROLE_COLORS[u.role] || '#6366f1'}22`, color: ROLE_COLORS[u.role] || '#6366f1', border: `1px solid ${ROLE_COLORS[u.role] || '#6366f1'}44`, textTransform: 'capitalize' }}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>

                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.is_active ? '#34d399' : '#f87171', border: `1px solid ${u.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                    {u.is_active ? '● Active' : '● Inactive'}
                  </span>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {u.role === 'agent' && (
                      <button
                        title={u.agent_allow_all_areas ? 'Revoke all-areas access' : 'Grant all-areas access'}
                        disabled={!!working[u._id + '_areas']}
                        onClick={async () => {
                          setWorking_(u._id + '_areas', true);
                          try {
                            const updated = await updateUser(u._id, { agent_allow_all_areas: !u.agent_allow_all_areas });
                            setUsers(prev => prev.map(usr => usr._id === u._id ? { ...usr, agent_allow_all_areas: updated.data?.agent_allow_all_areas ?? !u.agent_allow_all_areas } : usr));
                            toast.success(`Agent can now ${!u.agent_allow_all_areas ? 'see all areas' : 'only see assigned areas'}`);
                          } catch (err) {
                            toast.error(err?.error?.message || 'Failed to update area access');
                          } finally {
                            setWorking_(u._id + '_areas', false);
                          }
                        }}
                        style={{
                          background: u.agent_allow_all_areas ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${u.agent_allow_all_areas ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.12)'}`,
                          color: u.agent_allow_all_areas ? '#fbbf24' : 'rgba(255,255,255,0.45)',
                          borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                        }}
                      >
                        🌐 {working[u._id + '_areas'] ? '…' : u.agent_allow_all_areas ? 'All Areas ✓' : 'All Areas'}
                      </button>
                    )}
                    {u.role === 'tenant' && (
                      <button
                        title="Generate Rent Invoice"
                        onClick={() => {
                          const now = new Date();
                          const month = now.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
                          const content = [
                            '╔══════════════════════════════════════════╗',
                            '║       MUTUNE ESTATE AGENCY               ║',
                            '║       RENT INVOICE                       ║',
                            '╚══════════════════════════════════════════╝',
                            '',
                            `Invoice Date:   ${now.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                            `Invoice Period: ${month}`,
                            `Tenant Name:    ${u.full_name || 'N/A'}`,
                            `Email:          ${u.email || 'N/A'}`,
                            `Phone:          ${u.phone || 'N/A'}`,
                            `User ID:        ${u.user_code || u._id?.slice(-8) || 'N/A'}`,
                            '',
                            '─'.repeat(44),
                            'CHARGES',
                            '─'.repeat(44),
                            `Monthly Rent:              KES (see profile)`,
                            `Arrears:                   KES (see profile)`,
                            '',
                            '─'.repeat(44),
                            'NOTE: For exact figures, please check the tenant',
                            'profile in the Tenants management section.',
                            '─'.repeat(44),
                            '',
                            'Payment Method: M-Pesa (Lipa Na M-Pesa)',
                            'Paybill:        As communicated by agent',
                            '',
                            'For queries: mutunerentz@gmail.com',
                            'Mutune Estate Agency — Mombasa, Kenya',
                          ].join('\n');
                          const blob = new Blob([content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Invoice_${u.full_name?.replace(/\s+/g, '_') || 'tenant'}_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.txt`;
                          document.body.appendChild(a); a.click(); a.remove();
                          URL.revokeObjectURL(url);
                          toast.success(`Invoice generated for ${u.full_name}`);
                        }}
                        style={{
                          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                          color: '#a78bfa', borderRadius: 8, padding: '7px 10px',
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <FileText size={13} /> Invoice
                      </button>
                    )}
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
            ) : pendingProps.map(prop => {
              const proposedTier = propertyTiers.find(t => t._id === prop.proposed_tier_id);
              const selectedTier = selectedTiers[prop._id] || prop.proposed_tier_id || '';
              return (
                <div key={prop._id} style={{ background: 'rgba(251,191,36,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>⏳ Pending Approval</span>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{prop.property_code}</span>
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

                      <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Proposed Classification Tier:</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: proposedTier ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
                            {proposedTier ? proposedTier.name : 'None proposed by agent'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }} htmlFor={`tier-select-${prop._id}`}>Select/Verify Tier:</label>
                          <select
                            id={`tier-select-${prop._id}`}
                            value={selectedTier}
                            onChange={(e) => setSelectedTiers(prev => ({ ...prev, [prop._id]: e.target.value }))}
                            style={{
                              background: '#1a1a3e',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#fff',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12,
                              outline: 'none'
                            }}
                          >
                            <option value="">-- Verify & Select Tier --</option>
                            {propertyTiers.map(t => (
                              <option key={t._id} value={t._id}>
                                {t.name} (KES {t.min_rent_kes?.toLocaleString()} - {t.max_rent_kes?.toLocaleString()})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignSelf: 'center' }}>
                      <button
                        onClick={() => handleApproveProp(prop._id)}
                        disabled={!!working[prop._id]}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
                        <CheckCircle2 size={15} /> {working[prop._id] === true ? 'Approving…' : 'Approve & Verify Tier'}
                      </button>
                      <button
                        onClick={() => setRejectModal({ open: true, propId: prop._id, reason: '' })}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>⏳ Agent Review Pending</span>
                      {agent.earb_license && (
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>EARB License: {agent.earb_license}</span>
                      )}
                    </div>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{agent.full_name}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 }}>
                      📧 {agent.email} · 📞 {agent.phone || '—'}
                    </p>
                    {agent.assigned_areas && agent.assigned_areas.length > 0 && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 }}>
                        📍 Areas: {agent.assigned_areas.join(', ')}
                      </p>
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 8 }}>
                      Applied: {agent.created_at ? new Date(agent.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                    {agent.earb_verification_doc_url ? (
                      <a
                        href={agent.earb_verification_doc_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 12, fontWeight: 700, textDecoration: 'none', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '6px 12px', marginTop: 4, transition: 'all 0.2s' }}
                      >
                        <FileText size={14} /> View Verification Document
                      </a>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'rgba(251,191,36,0.8)', fontSize: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '5px 10px' }}>
                        ⚠ No verification document uploaded
                      </span>
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

        {/* LANDLORD APPROVALS TAB */}
        {tab === 'landlords' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendingLandlords.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Clock size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No pending landlord approvals</p>
              </div>
            ) : pendingLandlords.map(lld => (
              <div key={lld._id} style={{ background: 'rgba(245,158,11,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(245,158,11,0.2)', color: '#fb923c' }}>👑 Landlord Verification Pending</span>
                    </div>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{lld.full_name}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 4 }}>
                      📧 {lld.email} · 📞 {lld.phone || '—'}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 8 }}>
                      Registered: {lld.created_at ? new Date(lld.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                    {lld.landlord_verification_doc_url ? (
                      <a
                        href={lld.landlord_verification_doc_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fb923c', fontSize: 12, fontWeight: 700, textDecoration: 'none', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 12px', marginTop: 4, transition: 'all 0.2s' }}
                      >
                        <FileText size={14} /> View Property Verification Document
                      </a>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'rgba(251,191,36,0.8)', fontSize: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '5px 10px' }}>
                        ⚠ No verification document uploaded
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={() => handleApproveLandlord(lld._id)}
                      disabled={!!working[lld._id]}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
                      <CheckCircle2 size={15} /> {working[lld._id] === true ? 'Approving…' : 'Approve Landlord'}
                    </button>
                    <button
                      onClick={() => setLandlordRejectModal({ open: true, landlordId: lld._id, reason: '' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      <XCircle size={15} /> Reject Landlord
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROPERTY TIERS TAB */}
        {tab === 'tiers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Property Classification Tiers</h3>
              <button
                onClick={() => setTierModal({ open: true, tier: null, name: '', min_rent_kes: '', max_rent_kes: '', description: '', criteria: '' })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
              >
                <PlusCircle size={15} /> Add New Tier
              </button>
            </div>

            {propertyTiers.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Settings size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No Property Tiers configured.</p>
              </div>
            ) : (
              <div style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', display: 'grid', gap: 16 }}>
                {propertyTiers.map(tier => (
                  <div key={tier._id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 900, marginBottom: 8, color: '#fff' }}>{tier.name}</h4>
                      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Min Monthly Rent:</span>
                          <span style={{ fontWeight: 700, color: '#fff' }}>KES {tier.min_rent_kes?.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Max Monthly Rent:</span>
                          <span style={{ fontWeight: 700, color: '#fff' }}>KES {tier.max_rent_kes?.toLocaleString()}</span>
                        </div>
                      </div>
                      {tier.description && (
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 8 }}>{tier.description}</p>
                      )}
                      {tier.criteria && (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontStyle: 'italic' }}><strong>Criteria:</strong> {tier.criteria}</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginTop: 14 }}>
                      <button
                        onClick={() => openEditTierModal(tier)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Edit size={13} /> Edit Tier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: rule.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)', color: rule.is_active ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
                          {rule.is_active ? '● Running' : '● Paused'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                          Applies to: {rule.applies_to}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, color: '#fff' }}>{rule.name}</h4>
                      
                      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Grace Days:</span>
                          <span style={{ fontWeight: 700, color: '#fff' }}>{rule.grace_days} Days</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
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

        {/* CUSTOMER CARE SETTINGS TAB */}
        {tab === 'settings' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, maxWidth: 500, margin: '0 auto' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={20} style={{ color: '#10b981' }} /> Customer Care Settings
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
              Configure the primary contact phone number shown to tenants and landlords for support inquiries.
            </p>
            <form onSubmit={handleUpdateCustomerCare} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }} htmlFor="customer-care-phone">
                  Customer Care Number (Format: e.g. 2547XXXXXXXX)
                </label>
                <input
                  id="customer-care-phone"
                  type="text"
                  value={customerCareNumber}
                  onChange={e => setCustomerCareNumber(e.target.value)}
                  placeholder="254700000000"
                  required
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {savingSettings ? <RefreshCw size={14} className="animate-spin" /> : null}
                {savingSettings ? 'Saving...' : 'Update Settings'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Manual Landlord creation modal */}
      {landlordModal.open && (
        <>
          <div onClick={() => setLandlordModal(m => ({ ...m, open: false }))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
           <div className="admin-user-management-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Register Landlord manually</h3>
            <form onSubmit={handleCreateLandlord} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Full Name *</label>
                <input value={landlordModal.full_name} onChange={e => setLandlordModal(m => ({ ...m, full_name: e.target.value }))} type="text" placeholder="e.g. John Mutune" required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Email Address *</label>
                <input value={landlordModal.email} onChange={e => setLandlordModal(m => ({ ...m, email: e.target.value }))} type="email" placeholder="e.g. landlord@mutune.test" required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Phone Number *</label>
                <input value={landlordModal.phone} onChange={e => setLandlordModal(m => ({ ...m, phone: e.target.value }))} type="text" placeholder="e.g. 254700000000" required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Verification Document (Optional)</label>
                <ImageUpload
                  value={landlordModal.landlord_verification_doc_url ? [landlordModal.landlord_verification_doc_url] : []}
                  onChange={(urls) => setLandlordModal(m => ({ ...m, landlord_verification_doc_url: urls[0] || '' }))}
                  multiple={false}
                  label="Upload Property Deed/ID"
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="submit" disabled={working['new_landlord']} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {working['new_landlord'] ? 'Creating…' : 'Register & Approve'}
                </button>
                <button type="button" onClick={() => setLandlordModal(m => ({ ...m, open: false }))} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Property Tier Modal (add/edit) */}
      {tierModal.open && (
        <>
          <div onClick={() => setTierModal(tm => ({ ...tm, open: false }))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div className="admin-user-management-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 460, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              {tierModal.tier ? 'Modify Classification Tier' : 'Create Classification Tier'}
            </h3>
            <form onSubmit={handleSaveTier} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Tier Name *</label>
                <input value={tierModal.name} onChange={e => setTierModal(tm => ({ ...tm, name: e.target.value }))} type="text" placeholder="e.g. Gold" required style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Min Rent (KES) *</label>
                  <input value={tierModal.min_rent_kes} onChange={e => setTierModal(tm => ({ ...tm, min_rent_kes: e.target.value }))} type="number" required style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Max Rent (KES) *</label>
                  <input value={tierModal.max_rent_kes} onChange={e => setTierModal(tm => ({ ...tm, max_rent_kes: e.target.value }))} type="number" required style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Description</label>
                <textarea value={tierModal.description} onChange={e => setTierModal(tm => ({ ...tm, description: e.target.value }))} rows={2} placeholder="Sleek summary of this class..." style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Criteria</label>
                <textarea value={tierModal.criteria} onChange={e => setTierModal(tm => ({ ...tm, criteria: e.target.value }))} rows={2} placeholder="Listing check criteria..." style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="submit" style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {tierModal.tier ? 'Save Changes' : 'Create Tier'}
                </button>
                <button type="button" onClick={() => setTierModal(tm => ({ ...tm, open: false }))} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Reject landlord modal */}
      {landlordRejectModal.open && (
        <>
          <div onClick={() => setLandlordRejectModal({ open: false, landlordId: null, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div className="admin-user-management-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Reject Landlord Application</h3>
            <textarea value={landlordRejectModal.reason} onChange={e => setLandlordRejectModal(r => ({ ...r, reason: e.target.value }))} rows={4} placeholder="Reason for rejecting this landlord application (sent via email)…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRejectLandlord} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm Reject</button>
              <button onClick={() => setLandlordRejectModal({ open: false, landlordId: null, reason: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontStyle: 'bold', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Reject property modal */}
      {rejectModal.open && (
        <>
          <div onClick={() => setRejectModal({ open: false, propId: null, reason: '' })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div className="admin-user-management-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90%', maxWidth: 440, zIndex: 201, background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Rejection Reason</h3>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal(r => ({ ...r, reason: e.target.value }))} rows={4} placeholder="Explain why this property is being rejected…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRejectProp} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm Reject</button>
              <button onClick={() => setRejectModal({ open: false, propId: null, reason: '' })} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 14, fontStyle: 'bold', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {styleInputFix}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box'
};

const styleInputFix = (
  <style>{`
    @keyframes spin { to { transform: rotate(360deg); } }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
    select option { background: #1a1a3e; }
  `}</style>
);
