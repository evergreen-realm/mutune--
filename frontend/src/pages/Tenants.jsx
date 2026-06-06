import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTenants, terminateTenancy } from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';
import {
  Users2, Search, Phone, Mail, Home, Calendar, AlertCircle,
  CheckCircle2, XCircle, ChevronRight, UserX
} from 'lucide-react';

const STATUS_CONFIG = {
  active:      { label: 'Active',      color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  terminated:  { label: 'Terminated',  color: 'text-red-700 bg-red-50 border-red-200' },
  notice:      { label: 'Notice Given', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  pending:     { label: 'Pending',      color: 'text-blue-700 bg-blue-50 border-blue-200' }
};

export default function Tenants() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showTermModal, setShowTermModal] = useState(false);
  const [termReason, setTermReason] = useState('');
  const [termDate, setTermDate] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants', search, statusFilter],
    queryFn: () => fetchTenants({ search, status: statusFilter || undefined }),
    initialData: {
      success: true,
      data: [
        {
          _id: 'tn1',
          tenant_code: 'TNT-MOM-0001',
          full_name: 'Amina Wanjiku',
          phone: '254712345678',
          email: 'amina.w@email.com',
          id_number: '28745678',
          rent_amount_kes: 35000,
          tenancy_status: 'active',
          lease_start: '2025-01-01T00:00:00.000Z',
          lease_end: '2026-12-31T00:00:00.000Z',
          current_property_id: { name: 'Nyali Heights Apartments', property_code: 'MUT-NYA-001' },
          current_unit_id: 'unit_a1',
          payment_history: [
            { month: '2026-05', amount_kes: 35000, status: 'paid' },
            { month: '2026-04', amount_kes: 35000, status: 'paid' }
          ]
        },
        {
          _id: 'tn2',
          tenant_code: 'TNT-MOM-0002',
          full_name: 'Brian Otieno',
          phone: '254723456789',
          email: 'b.otieno@email.com',
          id_number: '39856789',
          rent_amount_kes: 55000,
          tenancy_status: 'active',
          lease_start: '2024-06-01T00:00:00.000Z',
          lease_end: '2025-05-31T00:00:00.000Z',
          current_property_id: { name: 'Tudor Breeze Suites', property_code: 'MUT-TUD-002' },
          current_unit_id: 'unit_b1',
          payment_history: [
            { month: '2026-05', amount_kes: 55000, status: 'paid' },
            { month: '2026-04', amount_kes: 55000, status: 'late' }
          ]
        },
        {
          _id: 'tn3',
          tenant_code: 'TNT-MOM-0003',
          full_name: 'Fatuma Hassan',
          phone: '254734567890',
          email: 'fatuma.h@email.com',
          id_number: '45123456',
          rent_amount_kes: 25000,
          tenancy_status: 'notice',
          lease_start: '2023-03-01T00:00:00.000Z',
          lease_end: '2026-07-31T00:00:00.000Z',
          current_property_id: { name: 'Bamburi Palms Estate', property_code: 'MUT-BAM-003' },
          current_unit_id: 'unit_c3',
          payment_history: [{ month: '2026-05', amount_kes: 25000, status: 'paid' }]
        }
      ],
      pagination: { total: 3, pages: 1 }
    }
  });

  const terminateMutation = useMutation({
    mutationFn: ({ id, data }) => terminateTenancy(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['tenants']);
      setShowTermModal(false);
      setSelectedTenant(null);
      setTermReason('');
      setTermDate('');
    }
  });

  const tenants = data?.data || [];
  const totalActive = tenants.filter(t => t.tenancy_status === 'active').length;
  const totalNotice = tenants.filter(t => t.tenancy_status === 'notice').length;

  const handleTerminate = () => {
    if (!termReason.trim() || !termDate) return;
    terminateMutation.mutate({ id: selectedTenant._id, data: { reason: termReason, vacate_date: termDate } });
  };

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
            {data?.pagination?.total || tenants.length} tenants ·{' '}
            <span className="text-emerald-600 font-medium">{totalActive} active</span>
            {totalNotice > 0 && <span className="text-amber-600 font-medium"> · {totalNotice} on notice</span>}
          </p>
        </div>
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
          />
        </div>
        <select
          id="tenant-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const statusCfg = STATUS_CONFIG[tenant.tenancy_status] || STATUS_CONFIG.pending;
                  const leaseEnd = tenant.lease_end ? new Date(tenant.lease_end) : null;
                  const daysLeft = leaseEnd ? Math.ceil((leaseEnd - new Date()) / 86400000) : null;
                  const lastPayment = tenant.payment_history?.at(-1);

                  return (
                    <tr key={tenant._id} className="hover:bg-gray-50/60 transition-colors group">
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
                            <div className="text-xs font-semibold text-gray-700">
                              {tenant.current_property_id?.name || '—'}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {tenant.current_property_id?.property_code}
                            </div>
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
                            <span className={`text-[11px] font-medium ${
                              daysLeft < 30 ? 'text-red-500' : daysLeft < 90 ? 'text-amber-500' : 'text-gray-400'
                            }`}>
                              {daysLeft > 0 ? `${daysLeft}d remaining` : 'Expired'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800 text-sm">
                          {tenant.rent_amount_kes?.toLocaleString()}
                        </div>
                        {lastPayment && (
                          <div className={`text-[11px] font-medium flex items-center gap-0.5 ${
                            lastPayment.status === 'paid' ? 'text-emerald-500' : 'text-red-400'
                          }`}>
                            {lastPayment.status === 'paid'
                              ? <CheckCircle2 size={10} />
                              : <XCircle size={10} />}
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
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {tenant.tenancy_status === 'active' && (
                            <button
                              id={`terminate-${tenant._id}`}
                              onClick={() => { setSelectedTenant(tenant); setShowTermModal(true); }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Terminate tenancy"
                            >
                              <UserX size={15} />
                            </button>
                          )}
                          <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminate Modal */}
      {showTermModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <UserX size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Terminate Tenancy</h2>
                <p className="text-xs text-gray-400">{selectedTenant.full_name} · {selectedTenant.tenant_code}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="term-reason">
                  Reason for Termination *
                </label>
                <textarea
                  id="term-reason"
                  rows={3}
                  value={termReason}
                  onChange={(e) => setTermReason(e.target.value)}
                  placeholder="e.g. Non-payment of rent for 2 months"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5" htmlFor="term-date">
                  Vacate Date *
                </label>
                <input
                  id="term-date"
                  type="date"
                  value={termDate}
                  onChange={(e) => setTermDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowTermModal(false); setSelectedTenant(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                id="confirm-terminate"
                onClick={handleTerminate}
                disabled={!termReason.trim() || !termDate || terminateMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {terminateMutation.isPending ? 'Terminating…' : 'Terminate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
