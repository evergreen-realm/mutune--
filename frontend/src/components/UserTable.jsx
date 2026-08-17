import React from 'react';
import {
  Users2, ShieldOff, Search, PlusCircle, Trash2, Edit
} from 'lucide-react';

const ROLE_COLORS = {
  admin: '#6366f1', super_admin: '#8b5cf6', agent: '#10b981',
  landlord: '#f59e0b', tenant: '#ec4899', accountant: '#60a5fa', caretaker: '#14b8a6'
};

const ROLE_LABELS = {
  admin: 'Admin', super_admin: 'Super Admin', agent: 'Agent',
  landlord: 'Landlord', tenant: 'Tenant', accountant: 'Accountant', caretaker: 'Caretaker'
};

export default function UserTable({
  users = [],
  usersError = null,
  search = '',
  setSearch,
  roleFilter = '',
  setRoleFilter,
  onOpenLandlordModal,
  onDisableUser,
  onDeleteUser,
  onToggleAgentAreas,
  onEditRole,
  working = {}
}) {
  const filtered = users.filter(u => {
    const mRole = !roleFilter || u.role === roleFilter;
    const q = search.toLowerCase();
    const mSearch = !search ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.user_code?.toLowerCase().includes(q) ||
      u.landlord_id?.toLowerCase().includes(q);
    return mRole && mSearch;
  });

  return (
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
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search name, email, phone, code…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 16px 10px 36px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} 
              />
            </div>
            <select 
              value={roleFilter} 
              onChange={e => setRoleFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
            >
              <option value="" style={{ background: '#1a1a3e' }}>All Roles</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v} style={{ background: '#1a1a3e' }}>{l}</option>)}
            </select>
            <button
              onClick={onOpenLandlordModal}
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
                      onClick={() => onToggleAgentAreas(u)}
                      disabled={working[u._id]}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: u.agent_allow_all_areas ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)', color: u.agent_allow_all_areas ? '#a5b4fc' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {u.agent_allow_all_areas ? '🌐 All Areas ON' : '📍 Area Restricted'}
                    </button>
                  )}

                  {onEditRole && (
                    <button
                      title="Edit User Role"
                      onClick={() => onEditRole(u)}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Edit size={12} /> Role
                    </button>
                  )}

                  <button
                    onClick={() => onDisableUser(u._id, u.is_active)}
                    disabled={working[u._id]}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: u.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: u.is_active ? '#f87171' : '#34d399', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {working[u._id] ? '…' : u.is_active ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    onClick={() => onDeleteUser(u._id)}
                    disabled={working[u._id]}
                    title="Soft Delete User"
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12, cursor: 'pointer' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
