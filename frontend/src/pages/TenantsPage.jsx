import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  RefreshCw, Eye, Shield, Loader2
} from 'lucide-react';

const STATUS_CONFIG = {
  active:     { label: 'Active',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  terminated: { label: 'Terminated',   color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  notice:     { label: 'Notice Given', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  pending:    { label: 'Pending',      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
};

const FIELD = ({ label, id, children, required }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full text-xs bg-slate-950/50 border border-slate-800 focus:border-green-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none transition font-medium';

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

    let sanitizedPhone = form.phone.trim().replace(/\D/g, '');
    if (sanitizedPhone.startsWith('0')) {
      sanitizedPhone = '254' + sanitizedPhone.slice(1);
    } else if (sanitizedPhone.startsWith('7')) {
      sanitizedPhone = '254' + sanitizedPhone;
    } else if (sanitizedPhone.startsWith('2540')) {
      sanitizedPhone = '254' + sanitizedPhone.slice(4);
    }

    if (!/^254\d{9}$/.test(sanitizedPhone)) {
      toast.error('Phone number must be valid Kenyan format (e.g. 2547XXXXXXXX or 07XXXXXXXX)');
      return;
    }

    const payload = { 
      ...form, 
      phone: sanitizedPhone,
      rent_amount_kes: parseInt(form.rent_amount_kes, 10) 
    };
    if (form.deposit_paid_kes) payload.deposit_paid_kes = parseInt(form.deposit_paid_kes, 10);
    if (!form.user_id) delete payload.user_id;
    if (!form.email) delete payload.email;
    if (!form.notes) delete payload.notes;
    if (!form.deposit_paid_kes) delete payload.deposit_paid_kes;
    mutation.mutate(payload);
  };

  const availableUnits = (selectedProperty?.units || []).filter(u => u.status === 'vacant');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl border border-slate-800 flex flex-col max-h-[90vh] text-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
            <UserPlus size={20} className="text-green-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Register New Tenant</h2>
            <p className="text-xs text-slate-400">Create a lease record for Mutune Estate Agency</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-lg transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Personal Details */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Personal Details</div>
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
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Property & Lease</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FIELD label="Property" id="tf-property" required>
                <select id="tf-property" value={form.current_property_id}
                  onChange={e => handlePropChange(e.target.value)} className={inputCls}>
                  <option value="" className="bg-slate-950 text-white">Select property…</option>
                  {properties.map(p => (
                    <option key={p._id} value={p._id} className="bg-slate-950 text-white">{p.name} ({p.property_code})</option>
                  ))}
                </select>
              </FIELD>
              <FIELD label="Unit" id="tf-unit" required>
                <select id="tf-unit" value={form.current_unit_id}
                  onChange={e => setForm(f => ({ ...f, current_unit_id: e.target.value }))}
                  className={inputCls} disabled={!selectedProperty}>
                  <option value="" className="bg-slate-950 text-white">Select unit…</option>
                  {availableUnits.map(u => (
                    <option key={u._id} value={u._id} className="bg-slate-950 text-white">{u.unit_number} — {u.type || 'Unit'}</option>
                  ))}
                </select>
                {selectedProperty && availableUnits.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">No vacant units in this property</p>
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
          <div className="bg-slate-950/30 border border-slate-800 p-4 rounded-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Link2 size={11} className="text-slate-450" /> Link to Registered User Account (Optional)
            </div>
            <FIELD label="System User (if tenant already has a login)" id="tf-user-id">
              <select id="tf-user-id" value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} className={inputCls}>
                <option value="" className="bg-slate-950 text-white">Not linked — tenant has no account yet</option>
                {users.map(u => (
                  <option key={u._id} value={u._id} className="bg-slate-950 text-white">{u.full_name} ({u.email}) — {u.role}</option>
                ))}
              </select>
            </FIELD>
            <p className="text-xs text-slate-400 mt-1.5">
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
        <div className="flex gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/20 rounded-b-[32px]">
          <button onClick={onClose} type="button"
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer"
          >
            Cancel
          </button>
          <button onClick={handleSubmit} id="btn-create-tenant" disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            {mutation.isPending ? <><RefreshCw size={14} className="animate-spin" /> Registering…</> : <><UserPlus size={14} /> Register Tenant</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Detail Drawer ─────────────────────────────────────────────────────
function TenantDetailDrawer({ tenantId, onClose, onChanged, initialEditMode = false }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(initialEditMode);
  const [editForm, setEditForm] = useState({});
  const [showLinkUser, setShowLinkUser] = useState(false);
  const [linkUserId, setLinkUserId] = useState('');
  const [showTermModal, setShowTermModal] = useState(false);
  const [termReason, setTermReason] = useState('');
  const [termDate, setTermDate] = useState('');

  useEffect(() => {
    setEditing(initialEditMode);
    setEditForm({});
  }, [initialEditMode, tenantId]);

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

  useEffect(() => {
    if (editing && tenant && !editForm.full_name) {
      setEditForm({
        full_name: tenant.full_name,
        phone: tenant.phone,
        email: tenant.email || '',
        rent_amount_kes: tenant.rent_amount_kes,
        lease_end: tenant.lease_end ? tenant.lease_end.split('T')[0] : '',
        tenancy_status: tenant.tenancy_status,
        notes: tenant.notes || ''
      });
    }
  }, [editing, tenant, editForm.full_name]);

  const updateMutation = useMutation({
    mutationFn: (d) => updateTenant(tenantId, d),
    onSuccess: () => {
      qc.invalidateQueries(['tenant', tenantId]);
      qc.invalidateQueries(['tenants']);
      toast.success('Tenant lease updated successfully');
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
      toast.success('Tenancy terminated successfully');
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
    let sanitizedPhone = editForm.phone ? editForm.phone.trim().replace(/\D/g, '') : '';
    if (sanitizedPhone.startsWith('0')) {
      sanitizedPhone = '254' + sanitizedPhone.slice(1);
    } else if (sanitizedPhone.startsWith('7')) {
      sanitizedPhone = '254' + sanitizedPhone;
    } else if (sanitizedPhone.startsWith('2540')) {
      sanitizedPhone = '254' + sanitizedPhone.slice(4);
    }

    if (!/^254\d{9}$/.test(sanitizedPhone)) {
      toast.error('Phone number must be valid Kenyan format (e.g. 2547XXXXXXXX or 07XXXXXXXX)');
      return;
    }

    const payload = { 
      ...editForm, 
      phone: sanitizedPhone,
      rent_amount_kes: parseInt(editForm.rent_amount_kes, 10) 
    };
    if (!editForm.email) delete payload.email;
    if (!editForm.notes) delete payload.notes;
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end bg-slate-950/40 backdrop-blur-sm">
        <div className="w-full sm:w-[480px] h-full bg-slate-900 shadow-2xl flex items-center justify-center border-l border-slate-800">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  const statusCfg = STATUS_CONFIG[tenant.tenancy_status] || STATUS_CONFIG.pending;
  const leaseEnd = tenant.lease_end ? new Date(tenant.lease_end) : null;
  const daysLeft = leaseEnd ? Math.ceil((leaseEnd - new Date()) / 86400000) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-955/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="w-full sm:w-[500px] h-full bg-slate-900 shadow-2xl flex flex-col overflow-hidden border-l border-slate-800 text-white" 
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex items-center gap-3.5 px-6 py-5 border-b border-slate-800 bg-slate-950/40">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm">
            {tenant.full_name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-white truncate text-xs sm:text-sm">{tenant.full_name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 font-bold font-mono">{tenant.tenant_code}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black border ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!editing && ['active', 'pending', 'notice'].includes(tenant.tenancy_status) && (
              <button 
                id={`btn-edit-tenant-${tenantId}`} 
                onClick={startEdit}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer" 
                title="Edit tenant details"
              >
                <Edit2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {editing ? (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FIELD label="Full Name" id="de-name" required>
                    <input id="de-name" type="text" value={editForm.full_name}
                      onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
                  </FIELD>
                </div>
                <FIELD label="Phone Number" id="de-phone">
                  <input id="de-phone" type="text" value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Email Address" id="de-email">
                  <input id="de-email" type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Rent (KES)" id="de-rent">
                  <input id="de-rent" type="number" min="1" value={editForm.rent_amount_kes}
                    onChange={e => setEditForm(f => ({ ...f, rent_amount_kes: e.target.value }))} className={inputCls} />
                </FIELD>
                <FIELD label="Lease End Date" id="de-lease-end">
                  <input id="de-lease-end" type="date" value={editForm.lease_end}
                    onChange={e => setEditForm(f => ({ ...f, lease_end: e.target.value }))} className={inputCls} />
                </FIELD>
                <div className="col-span-2">
                  <FIELD label="Tenancy Status" id="de-status">
                    <select id="de-status" value={editForm.tenancy_status}
                      onChange={e => setEditForm(f => ({ ...f, tenancy_status: e.target.value }))} className={inputCls}>
                      <option value="active" className="bg-slate-900">Active</option>
                      <option value="notice" className="bg-slate-900">Notice Given</option>
                      <option value="pending" className="bg-slate-900">Pending</option>
                    </select>
                  </FIELD>
                </div>
              </div>
              <FIELD label="Special Lease Terms / Notes" id="de-notes">
                <textarea id="de-notes" rows={3} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-none`} />
              </FIELD>
              <div className="flex gap-3 pt-3">
                <button onClick={() => setEditing(false)} type="button"
                  className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-350 rounded-xl text-xs font-bold transition cursor-pointer">
                  Cancel
                </button>
                <button id="btn-save-tenant" onClick={handleSave} disabled={updateMutation.isPending}
                  className="flex-1 px-3 py-2.5 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-500 transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider">
                  {updateMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <InfoBox icon={<Phone size={12} className="text-slate-500" />} label="Phone" value={tenant.phone} />
                <InfoBox icon={<Mail size={12} className="text-slate-500" />} label="Email" value={tenant.email || '—'} />
                <InfoBox icon={<FileText size={12} className="text-slate-500" />} label="National ID" value={tenant.id_number} />
                <InfoBox icon={<Shield size={12} className="text-slate-500" />} label="KYC Document" value={tenant.kyc_verified ? 'Verified ✓' : 'Unverified'} valueClass={tenant.kyc_verified ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'} />
              </div>

              <Section title="Property & Lease Terms">
                <div className="grid grid-cols-2 gap-3">
                  <InfoBox icon={<Building2 size={12} className="text-slate-500" />} label="Property Name" value={tenant.current_property_id?.name || '—'} />
                  <InfoBox icon={<Home size={12} className="text-slate-500" />} label="Leased Unit" value={tenant.current_unit_id} mono />
                  <InfoBox icon={<Calendar size={12} className="text-slate-500" />} label="Lease Ends" value={leaseEnd ? leaseEnd.toLocaleDateString('en-KE') : '—'} />
                  <InfoBox label="Remaining Days" value={daysLeft !== null ? `${daysLeft > 0 ? daysLeft : 0} Days` : '—'} valueClass={daysLeft < 30 ? 'text-red-400 font-black' : daysLeft < 90 ? 'text-amber-400 font-black' : 'text-slate-205 font-bold'} />
                  <InfoBox label="Rent Amount" value={FMT_KES(tenant.rent_amount_kes)} />
                  <InfoBox label="Security Deposit" value={tenant.deposit_paid_kes ? FMT_KES(tenant.deposit_paid_kes) : '—'} />
                </div>
              </Section>

              <Section title="Client Account Details">
                {tenant.user_id ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-550/20 rounded-2xl">
                    <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-black text-emerald-350">Tenant Account Synced</div>
                      <div className="text-xs text-emerald-400 font-mono mt-0.5">{typeof tenant.user_id === 'object' ? tenant.user_id.email || tenant.user_id._id : tenant.user_id}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                    <div className="text-xs text-slate-400 leading-relaxed">No registered system login has been linked to this tenant record yet.</div>
                    {!showLinkUser ? (
                      <button onClick={() => setShowLinkUser(true)} id={`btn-link-user-${tenantId}`}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl transition cursor-pointer">
                        <Link2 size={13} /> Link User Account
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <select value={linkUserId} onChange={e => setLinkUserId(e.target.value)}
                          className="flex-1 text-xs border border-slate-800 rounded-lg px-2.5 py-1.5 bg-slate-950 text-white focus:outline-none focus:border-green-500/50">
                          <option value="" className="bg-slate-900">Select account…</option>
                          {users.map(u => (
                            <option key={u._id} value={u._id} className="bg-slate-900">{u.full_name} ({u.email})</option>
                          ))}
                        </select>
                        <button onClick={() => linkMutation.mutate(linkUserId)} disabled={!linkUserId || linkMutation.isPending}
                          className="px-3.5 py-1.5 bg-green-600 text-white text-xs font-black rounded-lg hover:bg-green-700 disabled:opacity-50 transition cursor-pointer">
                          {linkMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : 'Link'}
                        </button>
                        <button onClick={() => setShowLinkUser(false)} className="p-1.5 text-slate-400 hover:text-white cursor-pointer">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              <Section title={`Payment History Ledger (${history.length} records)`}>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No bills/receipts logged in ledger.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-800 rounded-2xl p-3 bg-slate-950/20">
                    {history.slice().reverse().map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          {p.status === 'paid'
                            ? <CheckCircle2 size={13} className="text-emerald-400" />
                            : <XCircle size={13} className="text-red-400" />}
                          <span className="font-bold text-slate-300">{p.month}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-white">KES {p.amount_kes?.toLocaleString()}</span>
                          <span className={`capitalize text-xs font-black ${p.status === 'paid' ? 'text-emerald-450' : p.status === 'overdue' ? 'text-red-450' : 'text-amber-450'}`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {tenant.notes && (
                <Section title="Lease Notes">
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {tenant.notes}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Drawer footer actions */}
        {!editing && ['active', 'pending', 'notice'].includes(tenant.tenancy_status) && (
          <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/30">
            {tenant.tenancy_status === 'pending' && (
              <button 
                id={`btn-approve-tenancy-${tenantId}`} 
                onClick={() => updateMutation.mutate({ tenancy_status: 'active' })}
                disabled={updateMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black transition cursor-pointer uppercase tracking-wider mb-2"
              >
                {updateMutation.isPending ? <><RefreshCw size={14} className="animate-spin" /> Approving…</> : <><CheckCircle2 size={14} /> Approve Tenancy</>}
              </button>
            )}
            <button id={`btn-terminate-drawer-${tenantId}`} onClick={() => setShowTermModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-900/30 hover:border-red-600/50 text-red-400 hover:bg-red-950/10 rounded-xl text-xs font-black transition cursor-pointer uppercase tracking-wider">
              <UserX size={14} /> Terminate Tenancy Lease
            </button>
          </div>
        )}
      </motion.div>

      {/* Terminate confirm modal inside drawer */}
      <AnimatePresence>
        {showTermModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-white relative"
            >
              <button 
                onClick={() => setShowTermModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400"><UserX size={20} /></div>
                <div>
                  <h2 className="text-sm font-black text-white">Terminate Tenancy</h2>
                  <p className="text-xs text-slate-450">{tenant.full_name} · {tenant.tenant_code}</p>
                </div>
              </div>
              <div className="space-y-4">
                <FIELD label="Reason for Termination" id="term-reason" required>
                  <textarea id="term-reason" rows={3} value={termReason}
                    onChange={e => setTermReason(e.target.value)}
                    placeholder="Specify the reason for evicting or ending lease..."
                    className="w-full text-xs bg-slate-950/50 border border-slate-850 focus:border-red-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none transition resize-none font-sans" />
                </FIELD>
                <FIELD label="Vacate Date" id="term-date" required>
                  <input id="term-date" type="date" value={termDate}
                    onChange={e => setTermDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className="w-full text-xs bg-slate-950/50 border border-slate-850 focus:border-green-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none transition" />
                </FIELD>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowTermModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer">
                  Cancel
                </button>
                <button id="confirm-terminate" onClick={() => terminateMutation.mutate({ reason: termReason, vacate_date: termDate })}
                  disabled={!termReason.trim() || !termDate || terminateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-red-650 hover:bg-red-500 text-white rounded-xl text-xs font-black transition cursor-pointer uppercase tracking-wider">
                  {terminateMutation.isPending ? 'Terminating…' : 'Terminate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoBox({ icon, label, value, valueClass = '', mono = false }) {
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {icon} {label}
      </div>
      <div className={`text-xs font-bold text-slate-200 truncate ${mono ? 'font-mono text-xs' : ''} ${valueClass}`}>
        {value || '—'}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2 px-6">
      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-1">{title}</div>
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
  const [propertyFilter, setPropertyFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [initialEditMode, setInitialEditMode] = useState(false);
  const [evictingTenant, setEvictingTenant] = useState(null);
  const [evictReason, setEvictReason] = useState('');
  const [evictDate, setEvictDate] = useState('');

  const role = clerkUser?.publicMetadata?.role || 'landlord';
  const canAddTenant = ['admin', 'super_admin', 'agent'].includes(role);
  const isStaff = ['admin', 'super_admin', 'agent'].includes(role);

  const { data: propsData } = useQuery({
    queryKey: ['properties-filter'],
    queryFn: () => fetchProperties({ limit: 100 })
  });
  const properties = propsData?.data || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants', search, statusFilter, propertyFilter],
    queryFn: () => fetchTenants({
      search: search || undefined,
      status: statusFilter || undefined,
      property_id: propertyFilter || undefined
    })
  });

  const evictMutation = useMutation({
    mutationFn: ({ id, reason, vacate_date }) => terminateTenancy(id, { reason, vacate_date }),
    onSuccess: () => {
      qc.invalidateQueries(['tenants']);
      toast.success('Tenancy terminated successfully');
      setEvictingTenant(null);
      setEvictReason('');
      setEvictDate('');
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to terminate tenancy');
    }
  });

  const tenants = data?.data || [];
  const totalActive = tenants.filter(t => t.tenancy_status === 'active').length;
  const totalNotice = tenants.filter(t => t.tenancy_status === 'notice').length;

  const handleOpenDetails = (id) => {
    setSelectedTenantId(id);
    setInitialEditMode(false);
  };

  const handleOpenEdit = (id) => {
    setSelectedTenantId(id);
    setInitialEditMode(true);
  };

  const handleExportCSV = () => {
    if (!tenants || tenants.length === 0) {
      toast.warning('No tenants to export');
      return;
    }

    const headers = ['Code', 'Full Name', 'Phone', 'Email', 'National ID', 'Property', 'Unit', 'Rent (KES)', 'Status', 'Lease Start', 'Lease End'];
    
    const rows = tenants.map(t => [
      t.tenant_code || '',
      t.full_name || '',
      t.phone || '',
      t.email || '',
      t.id_number || '',
      t.current_property_id?.name || '',
      t.current_unit_id || '',
      t.rent_amount_kes || '',
      t.tenancy_status || '',
      t.lease_start ? new Date(t.lease_start).toLocaleDateString('en-KE') : '',
      t.lease_end ? new Date(t.lease_end).toLocaleDateString('en-KE') : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tenants_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <TableSkeleton rows={5} cols={isStaff ? 8 : 7} />;

  if (error) return (
    <div className="flex h-96 items-center justify-center border border-dashed border-red-500 rounded-2xl bg-red-500/10 p-8 text-center text-white">
      <div>
        <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
        <div className="text-red-450 font-bold text-sm">Failed to load tenants registry</div>
        <p className="text-xs text-slate-400 mt-1">{error?.error?.message || error?.message}</p>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 text-white"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users2 className="text-green-600" size={24} /> Tenant Registry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{data?.pagination?.total ?? tenants.length} tenants registered</span>
            <span>·</span>
            <span className="text-emerald-450 font-bold bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 rounded-full">{totalActive} active leases</span>
            {totalNotice > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-450 font-bold bg-amber-500/10 px-2.5 py-0.5 border border-amber-500/20 rounded-full">{totalNotice} on notice</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-805 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer uppercase tracking-wider"
          >
            <FileText size={14} /> Export CSV
          </button>
          {canAddTenant && (
            <button
              id="btn-add-tenant"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-green-950/15 uppercase tracking-wider"
            >
              <UserPlus size={14} /> Register Tenant
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="tenant-search"
            type="text"
            placeholder="Search name, phone, ID number code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950/50 border border-slate-800 focus:border-green-500/50 rounded-xl text-white focus:outline-none transition"
          />
        </div>
        
        <select
          id="tenant-property-filter"
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="text-xs bg-slate-950/50 border border-slate-800 focus:border-green-500/50 rounded-xl px-3 py-2.5 focus:outline-none text-white font-bold cursor-pointer"
        >
          <option value="" className="bg-slate-950 text-white font-sans">All Properties</option>
          {properties.map(p => (
            <option key={p._id} value={p._id} className="bg-slate-950 text-white font-sans">{p.name}</option>
          ))}
        </select>
        
        <select
          id="tenant-status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-xs bg-slate-950/50 border border-slate-800 focus:border-green-500/50 rounded-xl px-3 py-2.5 focus:outline-none text-white font-bold cursor-pointer"
        >
          <option value="" className="bg-slate-950 text-white font-sans">All Statuses</option>
          <option value="active" className="bg-slate-950 text-white font-sans">Active</option>
          <option value="notice" className="bg-slate-950 text-white font-sans">Notice Given</option>
          <option value="terminated" className="bg-slate-950 text-white font-sans">Terminated</option>
          <option value="pending" className="bg-slate-950 text-white font-sans">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950/40 border-b border-slate-800">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Tenant Info</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Contact Details</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Property / Unit</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Lease Dates</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Rent (KES)</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-5 py-4 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <AnimatePresence>
                {tenants.length === 0 ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={7} className="text-center py-16 text-slate-505">
                      <Users2 size={36} className="mx-auto mb-2 text-slate-700" />
                      <div className="font-bold">No tenant leases registered</div>
                    </td>
                  </motion.tr>
                ) : (
                  tenants.map((t, index) => {
                    const statusCfg = STATUS_CONFIG[t.tenancy_status] || STATUS_CONFIG.pending;
                    return (
                      <motion.tr 
                        key={t._id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-100 text-xs sm:text-sm">{t.full_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono font-bold tracking-wider">{t.tenant_code}</div>
                        </td>
                        <td className="px-5 py-4 space-y-0.5">
                          <div className="flex items-center gap-1 text-xs text-slate-355 font-mono font-medium">
                            <Phone size={10} className="text-slate-505" /> {t.phone}
                          </div>
                          {t.email && (
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Mail size={10} className="text-slate-505" /> {t.email}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-300">{t.current_property_id?.name || '—'}</div>
                          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Unit {t.current_unit_id || '—'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-300">
                            {new Date(t.lease_start).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </div>
                          <div className="text-xs text-slate-500 font-semibold mt-0.5">
                            to {new Date(t.lease_end).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-white text-xs sm:text-sm">
                            {t.rent_amount_kes?.toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500 font-bold uppercase">KES / MO</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDetails(t._id)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer border border-slate-700"
                              title="View Details"
                            >
                              <Eye size={12} /> <span className="hidden xl:inline">Details</span>
                            </button>
                            {canAddTenant && ['active', 'pending', 'notice'].includes(t.tenancy_status) && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(t._id)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer border border-slate-700"
                                  title="Edit Lease"
                                >
                                  <Edit2 size={12} /> <span className="hidden xl:inline">Edit</span>
                                </button>
                                <button
                                  onClick={() => { setEvictingTenant(t); setEvictReason(''); setEvictDate(''); }}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-red-650 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition cursor-pointer border border-transparent"
                                  title="Evict Tenant"
                                >
                                  <UserX size={12} /> <span className="hidden xl:inline">Evict</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer Details Overlay */}
      <AnimatePresence>
        {selectedTenantId && (
          <TenantDetailDrawer
            tenantId={selectedTenantId}
            initialEditMode={initialEditMode}
            onClose={() => { setSelectedTenantId(null); setInitialEditMode(false); }}
            onChanged={() => qc.invalidateQueries(['tenants'])}
          />
        )}
      </AnimatePresence>

      {/* Evict Tenant Modal */}
      <AnimatePresence>
        {evictingTenant && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setEvictingTenant(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 rounded-3xl shadow-2xl p-6 w-full max-w-md border border-slate-800 space-y-4 relative text-white"
            >
              <button 
                onClick={() => setEvictingTenant(null)}
                className="absolute top-4 right-4 p-1.5 bg-slate-955 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400"><UserX size={20} /></div>
                <div>
                  <h2 className="text-sm font-black text-white">Evict / Terminate Tenancy</h2>
                  <p className="text-xs text-slate-400">{evictingTenant.full_name} · {evictingTenant.tenant_code}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="evict-reason" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Reason for Eviction / Termination <span className="text-red-550">*</span>
                  </label>
                  <textarea 
                    id="evict-reason" 
                    rows={3} 
                    value={evictReason}
                    onChange={e => setEvictReason(e.target.value)}
                    placeholder="Specify the reason for evicting or ending lease..."
                    className="w-full text-xs bg-slate-955/50 border border-slate-800 focus:border-red-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none transition resize-none font-sans"
                    required 
                  />
                </div>
                <div>
                  <label htmlFor="evict-date" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Vacate Date <span className="text-red-550">*</span>
                  </label>
                  <input 
                    id="evict-date" 
                    type="date" 
                    value={evictDate}
                    onChange={e => setEvictDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} 
                    className="w-full text-xs bg-slate-955/50 border border-slate-800 focus:border-green-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none transition"
                    required 
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEvictingTenant(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition border border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => evictMutation.mutate({ id: evictingTenant._id, reason: evictReason, vacate_date: evictDate })}
                  disabled={!evictReason.trim() || !evictDate || evictMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-red-650 text-white rounded-xl text-xs font-black hover:bg-red-500 disabled:opacity-50 transition cursor-pointer uppercase tracking-wider"
                >
                  {evictMutation.isPending ? 'Evicting…' : 'Evict Tenant'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Register Tenant Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddTenantModal
            onClose={() => setShowAddModal(false)}
            onCreated={() => qc.invalidateQueries(['tenants'])}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
