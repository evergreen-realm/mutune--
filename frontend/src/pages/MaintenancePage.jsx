import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import { 
  Wrench, Plus, CheckCircle, AlertTriangle, Clock, 
  MessageSquare, User, Building, ShieldAlert, CheckSquare, Trash2, X, Calendar, Filter
} from 'lucide-react';
import { 
  fetchMaintenanceTickets, createMaintenanceTicket, 
  updateMaintenanceTicket, deleteMaintenanceTicket, fetchProperties,
  fetchMyProfile
} from '../lib/api';

const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'structural', label: 'Structural' },
  { value: 'security', label: 'Security' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-500/10 text-slate-400 border border-slate-700/50' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  { value: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-500/10 text-red-400 border border-red-500/20' }
];

const STATUS_BADGES = {
  open: { label: 'Open', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  assigned: { label: 'Assigned', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  pending_parts: { label: 'Pending Parts', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  closed: { label: 'Closed', color: 'bg-green-500/10 text-green-400 border border-green-500/20' }
};

export default function MaintenancePage({ dbUser }) {
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();

  const role = dbUser?.role || clerkUser?.publicMetadata?.role || 'landlord';
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const isAgent = role === 'agent';
  const isTenant = role === 'tenant';

  // Filters State
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modals Toggles & Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState('plumbing');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  // Update Ticket State
  const [updatingTicket, setUpdatingTicket] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [editCategory, setEditCategory] = useState('plumbing');
  const [editPriority, setEditPriority] = useState('medium');
  const [editDescription, setEditDescription] = useState('');

  // Delete/Cancel Confirmation State
  const [deletingTicket, setDeletingTicket] = useState(null);

  // Fetch Tenant Profile (to extract property/unit)
  const { data: myProfileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
    enabled: isTenant
  });
  const myProfile = myProfileData?.data;

  // Fetch Tickets
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['maintenance-tickets'],
    queryFn: () => fetchMaintenanceTickets()
  });

  // Fetch Properties (for non-tenants logging tickets)
  const { data: propertiesData, isLoading: propertiesLoading } = useQuery({
    queryKey: ['properties-for-tickets'],
    queryFn: () => fetchProperties({ limit: 200 }),
    enabled: !isTenant
  });

  const tickets = ticketsData?.data || [];
  const properties = propertiesData?.data || [];

  // Mutations
  const createTicketMutation = useMutation({
    mutationFn: createMaintenanceTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] });
      toast.success('Maintenance ticket logged successfully ✓');
      setDescription('');
      setSelectedPropertyId('');
      setSelectedUnitId('');
      setShowAddModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to log ticket');
    }
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, payload }) => updateMaintenanceTicket(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] });
      toast.success('Ticket updated successfully ✓');
      setUpdatingTicket(null);
      setAgentNotes('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update ticket');
    }
  });

  const deleteTicketMutation = useMutation({
    mutationFn: deleteMaintenanceTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] });
      toast.success('Ticket deleted/cancelled successfully ✓');
      setDeletingTicket(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete ticket');
    }
  });

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    let targetPropId = selectedPropertyId;
    let targetUnitId = selectedUnitId;

    if (isTenant) {
      targetPropId = myProfile?.current_property_id?._id || myProfile?.current_property_id;
      targetUnitId = myProfile?.current_unit_id?._id || myProfile?.current_unit_id;
      if (!targetPropId || !targetUnitId) {
        toast.error('Your tenancy profile lacks unit/property assignment. Contact administration.');
        return;
      }
    } else {
      if (!targetPropId || !targetUnitId) {
        toast.error('Property and Unit selection are required');
        return;
      }
    }

    createTicketMutation.mutate({
      property_id: targetPropId,
      unit_id: targetUnitId,
      category,
      priority,
      description: description.trim()
    });
  };

  const handleUpdateTicket = (e) => {
    e.preventDefault();
    if (!editDescription.trim()) {
      toast.error('Description cannot be empty');
      return;
    }
    updateTicketMutation.mutate({
      id: updatingTicket._id,
      payload: {
        status: statusUpdate,
        agent_notes: agentNotes.trim(),
        category: editCategory,
        priority: editPriority,
        description: editDescription.trim()
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingTicket) return;
    deleteTicketMutation.mutate(deletingTicket._id);
  };

  // Filter Logic
  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    
    const propId = t.property_id?._id || t.property_id;
    if (filterProperty !== 'all' && propId !== filterProperty) return false;
    
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      const ticketDate = new Date(t.created_at);
      if (ticketDate < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      const ticketDate = new Date(t.created_at);
      if (ticketDate > end) return false;
    }
    return true;
  });

  const selectedProperty = properties.find(p => p._id === selectedPropertyId);
  const unitsOfSelectedProperty = selectedProperty?.units || [];

  if (ticketsLoading || (propertiesLoading && !isTenant)) {
    return (
      <div className="space-y-6 text-white">
        <div className="flex justify-between items-center animate-pulse">
          <div className="space-y-2">
            <div className="h-7 bg-slate-900 rounded-xl w-48"></div>
            <div className="h-4 bg-slate-900 rounded-xl w-64"></div>
          </div>
          <div className="h-10 bg-slate-900 rounded-xl w-32"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-32 bg-slate-900 rounded-2xl"></div>
            <div className="h-32 bg-slate-900 rounded-2xl"></div>
            <div className="h-32 bg-slate-900 rounded-2xl"></div>
          </div>
          <div className="h-64 bg-slate-900 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wrench className="text-blue-600 animate-spin-slow" size={24} /> Maintenance Desk
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Log tickets, assign agents, and monitor repair status.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition duration-150 shadow-lg cursor-pointer"
        >
          <Plus size={16} /> Log Ticket
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-md">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter size={14} className="text-blue-500" /> Filters:
        </div>
        
        {/* Status Filter */}
        <div className="flex flex-col min-w-[120px]">
          <label className="text-xs text-slate-500 mb-1 font-medium">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-blue-500/50 rounded-xl text-white text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_parts">Pending Parts</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Property Filter (Admins/Agents/Landlords) */}
        {!isTenant && (
          <div className="flex flex-col min-w-[150px]">
            <label className="text-xs text-slate-500 mb-1 font-medium">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-blue-500/50 rounded-xl text-white text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date range filters */}
        <div className="flex flex-col min-w-[120px]">
          <label className="text-xs text-slate-500 mb-1 font-medium">Start Date</label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-blue-500/50 rounded-xl text-white text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col min-w-[120px]">
          <label className="text-xs text-slate-500 mb-1 font-medium">End Date</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-blue-500/50 rounded-xl text-white text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          />
        </div>

        {/* Clear Filters Button */}
        {(filterStatus !== 'all' || filterProperty !== 'all' || filterStartDate || filterEndDate) && (
          <button
            onClick={() => {
              setFilterStatus('all');
              setFilterProperty('all');
              setFilterStartDate('');
              setFilterEndDate('');
            }}
            className="mt-4 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-lg">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-200">Service Tickets ({filteredTickets.length})</h2>
            </div>
            
            <div className="space-y-4">
              {filteredTickets.map((t) => {
                const isEmergency = t.priority === 'emergency' || t.priority === 'high';
                const isResolved = t.status === 'resolved' || t.status === 'closed';
                const badge = STATUS_BADGES[t.status] || { label: t.status, color: 'bg-slate-800 text-slate-400' };

                return (
                  <div 
                    key={t._id} 
                    className={`border rounded-2xl p-4 transition duration-150 bg-slate-950/40 ${
                      isEmergency && !isResolved
                        ? 'border-red-500/20 bg-red-950/5'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">
                            {t.ticket_code}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                            PRIORITIES.find(p => p.value === t.priority)?.color || 'bg-slate-800 text-slate-400'
                          }`}>
                            {t.priority}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-200 capitalize">{t.category?.replace(/_/g, ' ')} Repair</h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">{t.description}</p>
                      </div>
                      
                      {/* Cancel option for open tickets */}
                      {(isAdmin || (isTenant && t.status === 'open')) && (
                        <button
                          onClick={() => setDeletingTicket(t)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete/Cancel ticket"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-900/80 flex flex-wrap items-center justify-between text-xs text-slate-500 font-semibold gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Building size={13} className="text-blue-600" /> {t.property_id?.name || 'Assigned Property'} (Unit {t.unit_id})
                        </span>
                        {t.tenant_id?.full_name && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <User size={13} className="text-blue-600" /> {t.tenant_id.full_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar size={13} className="text-blue-600" /> {new Date(t.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                        </span>
                        
                        {/* Manage/Edit Actions for Agents/Admins/Landlords */}
                        {(isAdmin || isAgent || role === 'landlord') && (
                          <button
                            onClick={() => {
                              setUpdatingTicket(t);
                              setStatusUpdate(t.status);
                              setAgentNotes(t.agent_notes || '');
                              setEditCategory(t.category || 'plumbing');
                              setEditPriority(t.priority || 'medium');
                              setEditDescription(t.description || '');
                            }}
                            className="text-blue-400 hover:text-blue-300 font-bold transition duration-150 cursor-pointer"
                          >
                            Update &amp; Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Agent Notes display */}
                    {t.agent_notes && (
                      <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-2 text-xs text-slate-300">
                        <MessageSquare size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-200">Notes / Resolution Details:</p>
                          <p className="mt-0.5 text-slate-400">{t.agent_notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!filteredTickets.length && (
                <div className="text-center py-12 text-slate-500 text-xs italic">
                  No maintenance tickets match the selected filters.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info block */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl p-5 space-y-4 shadow-lg">
            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={15} /> Help &amp; Guidelines
            </h3>
            <div className="space-y-3 text-xs leading-relaxed text-slate-400">
              <div className="flex gap-2">
                <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Emergencies:</strong> For serious active hazards like electrical sparks or major flooding, choose <strong>Emergency</strong> priority immediately.
                </p>
              </div>
              <div className="flex gap-2">
                <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Resolution:</strong> Service staff will log action reports. Tenants will see updates instantly on their web portal dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Ticket Modal ────────────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in text-white relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-800">
              <Wrench size={18} className="text-blue-500" />
              <h3 className="text-base font-bold text-white">Log Maintenance Ticket</h3>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4">
              {!isTenant ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Select Property <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => {
                        setSelectedPropertyId(e.target.value);
                        setSelectedUnitId('');
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                      required
                    >
                      <option value="">-- Choose Property --</option>
                      {properties.map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.property_code})</option>
                      ))}
                    </select>
                  </div>

                  {selectedPropertyId && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Select Unit <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                        required
                      >
                        <option value="">-- Choose Unit --</option>
                        {unitsOfSelectedProperty.map(u => (
                          <option key={u._id} value={u._id}>{u.unit_number} ({u.status})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-slate-200">Reporting Location:</p>
                  <p>{myProfile?.current_property_id?.name || 'Your Property'} — Unit {myProfile?.current_unit_id?.unit_number || 'Your Unit'}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Describe the Issue <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the location and severity of the issue..."
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 resize-none transition duration-150"
                  required
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition border border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  {createTicketMutation.isPending ? 'Logging...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Update Ticket Modal ─────────────────────────────────────────────── */}
      {updatingTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setUpdatingTicket(null); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in text-white relative">
            <button
              onClick={() => setUpdatingTicket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-800">
              <CheckSquare size={18} className="text-blue-500" />
              <h3 className="text-base font-bold text-white">Update Maintenance Ticket: {updatingTicket.ticket_code}</h3>
            </div>

            <form onSubmit={handleUpdateTicket} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Issue Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 resize-none"
                  required
                />
              </div>

              <div className="border-t border-slate-800/80 pt-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Update Status</label>
                    <select
                      value={statusUpdate}
                      onChange={(e) => setStatusUpdate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_parts">Pending Parts</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {statusUpdate === 'resolved' || statusUpdate === 'closed' ? 'Resolution Notes' : 'Agent / Action Notes'}
                    </label>
                    <input
                      type="text"
                      value={agentNotes}
                      onChange={(e) => setAgentNotes(e.target.value)}
                      placeholder="Explain work performed..."
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUpdatingTicket(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition border border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTicketMutation.isPending}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  {updateTicketMutation.isPending ? 'Updating...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Cancel/Delete Confirmation Modal ─────────────────────────────────── */}
      {deletingTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingTicket(null); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in text-white relative">
            <button
              onClick={() => setDeletingTicket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-800">
              <Trash2 size={18} className="text-red-500" />
              <h3 className="text-base font-bold text-white">Cancel / Delete Ticket</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300">
                Are you sure you want to permanently cancel and delete the following maintenance ticket?
              </p>
              
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <p className="text-xs font-mono text-slate-400">Code: <span className="text-slate-200">{deletingTicket.ticket_code}</span></p>
                <p className="text-xs text-slate-400">Category: <span className="text-slate-200 capitalize">{deletingTicket.category} Repair</span></p>
                <p className="text-xs text-slate-400">Description: <span className="text-slate-300 italic">"{deletingTicket.description}"</span></p>
              </div>

              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={14} /> This action is destructive and cannot be undone.
              </p>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeletingTicket(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition border border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteTicketMutation.isPending}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  {deleteTicketMutation.isPending ? 'Deleting...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
