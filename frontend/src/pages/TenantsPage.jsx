import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import {
  fetchTenants, fetchTenant, createTenant, updateTenant,
  terminateTenancy, fetchTenantPaymentHistory, fetchProperties,
  fetchUsers, linkTenantUser
} from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';
import { toast } from 'react-toastify';
import {
  Users2, Search, Phone, Mail, Home, Calendar, AlertCircle,
  CheckCircle2, XCircle, ChevronRight, UserX, UserPlus, X,
  Building2, FileText, Edit2, Save, Link2, CreditCard,
  RefreshCw, ExternalLink, Shield
} from 'lucide-react';

const STATUS_CONFIG = {
  active:     { label: 'Active',       color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  terminated: { label: 'Terminated',   color: 'text-red-700 bg-red-50 border-red-200' },
  notice:     { label: 'Notice Given', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  pending:    { label: 'Pending',      color: 'text-blue-700 bg-blue-50 border-blue-200' }
};

const FIELD = ({ label, id, children, required }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition';

// ─── Add Tenant Modal ─────────────────────────────────────────────────────────
function AddTenantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    full_name: '', id_number: '', phone: '254',
    email: '', current_property_id: '', current_unit_id: '',
    rent_amount_kes: '', deposit_paid_kes: '',
    lease_start: '', lease_end: '', notes: '', user_id: ''
  });
  const [selectedProperty, setSelectedProperty] = useState(null);

  const { data: propsData } = useQuery({ queryKey: ['properties'], queryFn: () => fetchProperties({ limit: 100 }) });
  const { data: usersData } = useQuery({ queryKey: ['users-list'], queryFn: () => fetchUsers({ limit: 200 }) });

  const properties = propsData?.data || [];
  const users = (usersData?.data || []).filter(u => !['admin', 'super_admin'].includes(u.role));

  const handlePropChange = (pid) => {
    const prop = properties.find(p => p._id === pid);
    setSelectedProperty(prop || null);
    setForm(f => ({ ...f, current_property_id: pid, current_unit_id: '' }));
  };

  const mutation = useMutation({
    mutationFn: (data) => createTenant(data),
    onSuccess: (res) => {
      toast.success(`Tenant ${res.data.tenant_code} created successfully`);
      onCreated();
      onClose();
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to create tenant');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.full_name || !form.id_number || !form.phone || !form.current_property_id || !form.current_unit_id || !form.rent_amount_kes || !form.lease_start || !form.lease_end) {
      toast.error('Please fill all required fields');
      return;
    }
    const payload = { ...form, rent_amount_kes: parseInt(form.rent_amount_kes, 10) };
    if (form.deposit_paid_kes) payload.deposit_paid_kes = parseInt(form.deposit_paid_kes, 10);
    if (!form.user_id) delete payload.user_id;
    if (!form.email) delete payload.email;
    if (!form.notes) delete payload.notes;
    if (!form.deposit_paid_kes) delete payload.deposit_paid_kes;
    mutation.mutate(payload);
  };

  const availableUnits = (selectedProperty?.units || []).filter(u => u.status === 'vacant');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b">
          <div className="p-2.5 bg-green-50 rounded-xl">
            <UserPlus size={20} className="text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Register New Tenant</h2>
            <p className="text-xs text-gray-400">Create a lease record for Mutune Estate Agency</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Personal Details */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Personal Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FIELD label="Full Name" id="tf-full-name" required>
                <input id="tf-full-name" type="text" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. John Kamau Mwangi" className={inputCls} />
              </FIELD>
              <FIELD label="National ID / Passport" id="tf-id" required>
                <input id="tf-id" type="text" value={form.id_number}
                  onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))}
                  placeholder="e.g. 12345678" className={inputCls} />
              </FIELD>
              <FIELD label="Phone (254XXXXXXXXX)" id="tf-phone" required>
                <input id="tf-phone" type="text" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="254700123456" className={inputCls} />
              </FIELD>
              <FIELD label="Email Address" id="tf-email">
                <input id="tf-email" type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com" className={inputCls} />
              </FIELD>
            </div>
          </div>

          {/* Property & Lease */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Property & Lease</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FIELD label="Property" id="tf-property" required>
                <select id="tf-property" value={form.current_property_id}
                  onChange={e => handlePropChange(e.target.value)} className={inputCls}>
                  <option value="">Select property…</option>
                  {properties.map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.property_code})</option>
                  ))}
                </select>
              </FIELD>
              <FIELD label="Unit" id="tf-unit" required>
                <select id="tf-unit" value={form.current_unit_id}
                  onChange={e => setForm(f => ({ ...f, current_unit_id: e.target.value }))}
                  className={inputCls} disabled={!selectedProperty}>
                  <option value="">Select unit…</option>
                  {availableUnits.map(u => (
                    <option key={u._id} value={u._id}>{u.unit_number} — {u.type || 'Unit'}</option>
                  ))}
                </select>
                {selectedProperty && availableUnits.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">No vacant units in this property</p>
                )}
              </FIELD>
              <FIELD label="Monthly Rent (KES)" id="tf-rent" required>
                <input id="tf-rent" type="number" min="1" value={form.rent_amount_kes}
                  onChange={e => setForm(f => ({ ...f, rent_amount_kes: e.target.value }))}
                  placeholder="e.g. 15000" className={inputCls} />
              </FIELD>
              <FIELD label="Deposit Paid (KES)" id="tf-deposit">
                <input id="tf-deposit" type="number" min="0" value={form.deposit_paid_kes}
                  onChange={e => setForm(f => ({ ...f, deposit_paid_kes: e.target.value }))}
                  placeholder="e.g. 30000" className={inputCls} />
              </FIELD>
              <FIELD label="Lease Start" id="tf-lease-start" required>
                <input id="tf-lease-start" type="date" value={form.lease_start}
                  onChange={e => setForm(f => ({ ...f, lease_start: e.target.value }))} className={inputCls} />
              </FIELD>
              <FIELD label="Lease End" id="tf-lease-end" required>
                <input id="tf-lease-end" type="date" value={form.lease_end}
                  onChange={e => setForm(f => ({ ...f, lease_end: e.target.value }))} className={inputCls} />
              </FIELD>
            </div>
          </div>

          {/* Link to Clerk User (optional) */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Link2 size={11} /> Link to Registered User Account (Optional)
            </div>
            <FIELD label="System User (if tenant already has a login)" id="tf-user-id">
              <select id="tf-user-id" value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} className={inputCls}>
                <option value="">Not linked — tenant has no account yet</option>
                {users.map(u => (
                  <option key={u._id} value={u._id}>{u.full_name} ({u.email}) — {u.role}</option>
                ))}
              </select>
            </FIELD>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Linking will set their role to <strong>tenant</strong> and grant access to the tenant portal.
            </p>
          </div>

          {/* Notes */}
          <FIELD label="Notes" id="tf-notes">
            <textarea id="tf-notes" rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes about this tenancy…"
              className={`${inputCls} resize-none`} />
          </FIELD>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} type="button"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSubmit} id="btn-create-tenant" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {mutation.isPending ? <><RefreshCw size={14} className="animate-spin" /> Creating…</> : <><UserPlus size={14} /> Register Tenant</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Detail Drawer ─────────────────────────────────────────────────────
function TenantDetailDrawer({ tenantId, onClose, onChanged }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showLinkUser, setShowLinkUser] = useState(false);
  const [linkUserId, setLinkUserId] = useState('');
  const [showTermModal, setShowTermModal] = useState(false);
  const [termReason, setTermReason] = useState('');
  const [termDate, setTermDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => fetchTenant(tenantId),
    enabled: !!tenantId
  });

  const { data: histData } = useQuery({
    queryKey: ['tenant-history', tenantId],
    queryFn: () => fetchTenantPaymentHistory(tenantId),
    enabled: !!tenantId
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => fetchUsers({ limit: 200 })
  });

  const tenant = data?.data;
  const history = histData?.data || [];
  const users = (usersData?.data || []).filter(u => u.role !== 'admin' && u.role !== 'super_admin');

  const updateMutation = useMutation({
    mutationFn: (d) => updateTenant(tenantId, d),
    onSuccess: () => {
      qc.invalidateQueries(['tenant', tenantId]);
      qc.invalidateQueries(['tenants']);
      toast.success('Tenant updated');
      setEditing(false);
      onChanged();
    },
    onError: (err) => toast.error(err?.error?.message || 'Update failed')
  });

  const linkMutation = useMutation({
    mutationFn: (uid) => linkTenantUser(tenantId, uid),
    onSuccess: () => {
      qc.invalidateQueries(['tenant', tenantId]);
      qc.invalidateQueries(['tenants']);
      toast.success('User linked to tenant — role updated to tenant');
      setShowLinkUser(false);
      onChanged();
    },
    onError: (err) => toast.error(err?.error?.message || 'Link failed')
  });

  const terminateMutation = useMutation({
    mutationFn: (d) => terminateTenancy(tenantId, d),
    onSuccess: () => {
      qc.invalidateQueries(['tenant', tenantId]);
      qc.invalidateQueries(['tenants']);
      toast.success('Tenancy terminated');
      setShowTermModal(false);
      onChanged();
      onClose();
    },
    onError: (err) => toast.error(err?.error?.message || 'Termination failed')
  });

  const startEdit = () => {
    setEditForm({
      full_name: tenant.full_name,
      phone: tenant.phone,
      email: tenant.email || '',
      rent_amount_kes: tenant.rent_amount_kes,
      lease_end: tenant.lease_end ? tenant.lease_end.split('T')[0] : '',
      tenancy_status: tenant.tenancy_status,
      notes: tenant.notes || ''
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload = { ...editForm, rent_amount_kes: parseInt(editForm.rent_amount_kes, 10) };
    if (!editForm.email) delete payload.email;
    if (!editForm.notes) delete payload.notes;
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end bg-black/30 backdrop-blur-sm">
        <div className="w-full sm:w-[480px] h-full bg-white shadow-2xl flex items-center justify-center">
          <RefreshCw size={24} className="animate-spin text-gray-300" />
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  const statusCfg = STATUS_CONFIG[tenant.tenancy_status] || STATUS_CONFIG.pending;
  const leaseEnd = tenant.lease_end ? new Date(tenant.lease_end) : null;
  const daysLeft = leaseEnd ? Math.ceil((leaseEnd - new Date()) / 86400000) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:w-[500px] h-full bg-white shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Drawer header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-gray-50/50">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            {tenant.full_name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 truncate">{tenant.full_name}</div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-mono">{tenant.tenant_code}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!editing && tenant.tenancy_status === 'active' && (
              <button id={`btn-edit-tenant-${tenantId}`} onClick={startEdit}
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="Edit tenant">
                <Edit2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Edit form OR display */}
          {editing ? (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FIELD label="Full Name" id="de-name" required>
                  <input id="de-name" type="text" value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Phone" id="de-phone">
                  <input id="de-phone" type="text" value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Email" id="de-email">
                  <input id="de-email" type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Rent (KES)" id="de-rent">
                  <input id="de-rent" type="number" min="1" value={editForm.rent_amount_kes}
                    onChange={e => setEditForm(f => ({ ...f, rent_amount_kes: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Lease End" id="de-lease-end">
                  <input id="de-lease-end" type="date" value={editForm.lease_end}
                    onChange={e => setEditForm(f => ({ ...f, lease_end: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Status" id="de-status">
                  <select id="de-status" value={editForm.tenancy_status}
                    onChange={e => setEditForm(f => ({ ...f, tenancy_status: e.target.value }))} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="notice">Notice Given</option>
                    <option value="pending">Pending</option>
                  </select>
                </FIELD>
              </div>
              <FIELD label="Notes" id="de-notes">
                <textarea id="de-notes" rows={3} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </FIELD>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)} type="button"
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button id="btn-save-tenant" onClick={handleSave} disabled={updateMutation.isPending}
                  className="flex-1 px-3 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {updateMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Key info */}
              <div className="grid grid-cols-2 gap-3">
                <InfoBox icon={<Phone size={13} className="text-gray-400" />} label="Phone" value={tenant.phone} />
                <InfoBox icon={<Mail size={13} className="text-gray-400" />} label="Email" value={tenant.email || '—'} />
                <InfoBox icon={<FileText size={13} className="text-gray-400" />} label="National ID" value={tenant.id_number} />
                <InfoBox icon={<Shield size={13} className="text-gray-400" />} label="KYC" value={tenant.kyc_verified ? 'Verified' : 'Pending'} valueClass={tenant.kyc_verified ? 'text-green-600' : 'text-amber-500'} />
              </div>

              {/* Property */}
              <Section title="Property & Lease">
                <div className="grid grid-cols-2 gap-3">
                  <InfoBox icon={<Building2 size={13} className="text-gray-400" />} label="Property" value={tenant.current_property_id?.name || '—'} />
                  <InfoBox icon={<Home size={13} className="text-gray-400" />} label="Unit" value={tenant.current_unit_id || '—'} mono />
                  <InfoBox icon={<Calendar size={13} className="text-gray-400" />} label="Lease End" value={leaseEnd ? leaseEnd.toLocaleDateString('en-KE') : '—'} />
                  <InfoBox label="Days Left" value={daysLeft !== null ? `${daysLeft > 0 ? daysLeft : 0}d` : '—'} valueClass={daysLeft < 30 ? 'text-red-500 font-bold' : daysLeft < 90 ? 'text-amber-500 font-bold' : ''} />
                  <InfoBox label="Rent (KES)" value={tenant.rent_amount_kes?.toLocaleString()} />
                  <InfoBox label="Deposit (KES)" value={tenant.deposit_paid_kes?.toLocaleString() || '—'} />
                </div>
              </Section>

              {/* Linked User */}
              <Section title="System Account">
                {tenant.user_id ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100">
                    <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold text-green-800">Linked to user account</div>
                      <div className="text-green-600">{typeof tenant.user_id === 'object' ? tenant.user_id.email || tenant.user_id._id : tenant.user_id}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">No system account linked. Link one to give this tenant portal access.</div>
                    {!showLinkUser ? (
                      <button onClick={() => setShowLinkUser(true)} id={`btn-link-user-${tenantId}`}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition">
                        <Link2 size={13} /> Link User Account
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <select value={linkUserId} onChange={e => setLinkUserId(e.target.value)}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition">
                          <option value="">Select user…</option>
                          {users.map(u => (
                            <option key={u._id} value={u._id}>{u.full_name} ({u.email})</option>
                          ))}
                        </select>
                        <button onClick={() => linkMutation.mutate(linkUserId)} disabled={!linkUserId || linkMutation.isPending}
                          className="px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                          {linkMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : 'Link'}
                        </button>
                        <button onClick={() => setShowLinkUser(false)} className="px-2 py-2 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* Payment History */}
              <Section title={`Payment History (${history.length} records)`}>
                {history.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">No payments recorded yet.</div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {history.slice().reverse().map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 text-xs">
                        <div className="flex items-center gap-2">
                          {p.status === 'paid'
                            ? <CheckCircle2 size={12} className="text-emerald-500" />
                            : <XCircle size={12} className="text-red-400" />}
                          <span className="font-medium text-gray-700">{p.month}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-800">KES {p.amount_kes?.toLocaleString()}</span>
                          <span className={`capitalize font-medium ${p.status === 'paid' ? 'text-emerald-600' : p.status === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {tenant.notes && (
                <Section title="Notes">
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{tenant.notes}</p>
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Drawer footer actions */}
        {!editing && tenant.tenancy_status === 'active' && (
          <div className="px-5 py-4 border-t bg-gray-50/50">
            <button id={`btn-terminate-drawer-${tenantId}`} onClick={() => setShowTermModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition">
              <UserX size={15} /> Terminate Tenancy
            </button>
          </div>
        )}
      </div>

      {/* Terminate confirm modal inside drawer */}
      {showTermModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-red-50 rounded-xl"><UserX size={20} className="text-red-500" /></div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Terminate Tenancy</h2>
                <p className="text-xs text-gray-400">{tenant.full_name} · {tenant.tenant_code}</p>
              </div>
            </div>
            <div className="space-y-4">
              <FIELD label="Reason for Termination" id="term-reason" required>
                <textarea id="term-reason" rows={3} value={termReason}
                  onChange={e => setTermReason(e.target.value)}
                  placeholder="e.g. Non-payment of rent for 2 months"
                  className={`${inputCls} resize-none`} />
              </FIELD>
              <FIELD label="Vacate Date" id="term-date" required>
                <input id="term-date" type="date" value={termDate}
                  onChange={e => setTermDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} className={inputCls} />
              </FIELD>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTermModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button id="confirm-terminate" onClick={() => terminateMutation.mutate({ reason: termReason, vacate_date: termDate })}
                disabled={!termReason.trim() || !termDate || terminateMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {terminateMutation.isPending ? 'Terminating…' : 'Terminate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ icon, label, value, valueClass = '', mono = false }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
        {icon} {label}
      </div>
      <div className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono text-xs' : ''} ${valueClass}`}>
        {value || '—'}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

// ─── Main TenantsPage ─────────────────────────────────────────────────────────
export default function TenantsPage() {
  const qc = useQueryClient();
  const { user: clerkUser } = useUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(null);

  const role = clerkUser?.publicMetadata?.role || 'landlord';
  const canAddTenant = ['admin', 'super_admin', 'agent'].includes(role);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants', search, statusFilter],
    queryFn: () => fetchTenants({ search: search || undefined, status: statusFilter || undefined })
  });

  const tenants = data?.data || [];
  const totalActive = tenants.filter(t => t.tenancy_status === 'active').length;
  const totalNotice = tenants.filter(t => t.tenancy_status === 'notice').length;

  if (isLoading) return <TableSkeleton rows={5} cols={6} />;

  if (error) return (
    <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-xl bg-red-50 p-8 text-center">
      <div>
        <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
        <div className="text-red-600 font-semibold">Failed to load tenants</div>
        <p className="text-sm text-red-400 mt-1">{error?.error?.message || error?.message}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Users2 className="text-green-600" size={24} /> Tenant Registry
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data?.pagination?.total ?? tenants.length} tenants ·{' '}
            <span className="text-emerald-600 font-medium">{totalActive} active</span>
            {totalNotice > 0 && <span className="text-amber-600 font-medium"> · {totalNotice} on notice</span>}
          </p>
        </div>
        {canAddTenant && (
          <button
            id="btn-add-tenant"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition shadow-sm shadow-green-600/20"
          >
            <UserPlus size={16} /> Add Tenant
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="tenant-search"
            type="text"
            placeholder="Search name, phone, ID number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
          />
        </div>
        <select
          id="tenant-status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 bg-white text-gray-600"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="notice">Notice Given</option>
          <option value="terminated">Terminated</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Tenant</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Contact</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Property / Unit</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Lease</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Rent (KES)</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <Users2 size={36} className="mx-auto mb-2 text-gray-200" />
                    <div className="font-medium">No tenants found</div>
                    <button onClick={() => setShowAddModal(true)}
                      className="mt-3 text-xs text-green-600 font-semibold hover:underline flex items-center gap-1 mx-auto">
                      <UserPlus size={13} /> Register first tenant
                    </button>
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const statusCfg = STATUS_CONFIG[tenant.tenancy_status] || STATUS_CONFIG.pending;
                  const leaseEnd = tenant.lease_end ? new Date(tenant.lease_end) : null;
                  const daysLeft = leaseEnd ? Math.ceil((leaseEnd - new Date()) / 86400000) : null;
                  const lastPayment = tenant.payment_history?.at(-1);

                  return (
                    <tr key={tenant._id} className="hover:bg-gray-50/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedTenantId(tenant._id)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {tenant.full_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{tenant.full_name}</div>
                            <div className="text-[11px] text-gray-400 font-mono">{tenant.tenant_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Phone size={11} className="text-gray-400" /> {tenant.phone}
                          </span>
                          {tenant.email && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Mail size={11} /> {tenant.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Home size={13} className="text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-gray-700">{tenant.current_property_id?.name || '—'}</div>
                            <div className="text-[11px] text-gray-400">{tenant.current_property_id?.property_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          {leaseEnd && (
                            <span className="flex items-center gap-1 text-xs text-gray-600">
                              <Calendar size={11} className="text-gray-400" />
                              Ends {leaseEnd.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                          {daysLeft !== null && (
                            <span className={`text-[11px] font-medium ${daysLeft < 30 ? 'text-red-500' : daysLeft < 90 ? 'text-amber-500' : 'text-gray-400'}`}>
                              {daysLeft > 0 ? `${daysLeft}d remaining` : 'Expired'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800 text-sm">{tenant.rent_amount_kes?.toLocaleString()}</div>
                        {lastPayment && (
                          <div className={`text-[11px] font-medium flex items-center gap-0.5 ${lastPayment.status === 'paid' ? 'text-emerald-500' : 'text-red-400'}`}>
                            {lastPayment.status === 'paid' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            {lastPayment.month}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <ChevronRight size={15} className="text-gray-300 group-hover:text-green-500 transition-colors" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddTenantModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => qc.invalidateQueries(['tenants'])}
        />
      )}

      {selectedTenantId && (
        <TenantDetailDrawer
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onChanged={() => qc.invalidateQueries(['tenants'])}
        />
      )}
    </div>
  );
}
