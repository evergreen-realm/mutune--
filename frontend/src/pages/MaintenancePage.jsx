import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import { 
  Wrench, Plus, CheckCircle, AlertTriangle, Clock, 
  MessageSquare, User, Building, ShieldAlert, CheckSquare, Trash2
} from 'lucide-react';
import { 
  fetchMaintenanceTickets, createMaintenanceTicket, 
  updateMaintenanceTicket, deleteMaintenanceTicket, fetchProperties 
} from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';

const CATEGORIES = ['plumbing', 'electrical', 'structural', 'security', 'appliance', 'pest_control', 'cleaning', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'emergency'];

export default function MaintenancePage() {
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();

  const role = clerkUser?.publicMetadata?.role || 'landlord';
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const isAgent = role === 'agent';
  const isTenant = role === 'tenant';

  // State
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [category, setCategory] = useState('plumbing');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  
  // Note/Update state
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [agentNotes, setAgentNotes] = useState('');

  // Fetch Tickets
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['maintenance-tickets'],
    queryFn: () => fetchMaintenanceTickets()
  });

  // Fetch Properties (to populate property/unit dropdowns when creating tickets)
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-tickets'],
    queryFn: () => fetchProperties(),
    enabled: !isTenant // tenants already have their property assigned
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
      setShowAddTicket(false);
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
      setActiveTicketId(null);
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
      toast.success('Ticket deleted successfully ✓');
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
      // For tenant, we pull their assigned unit/property
      // In a real app we'd retrieve this from their user profile
      // For this system, we fetch current user profile if needed, or get from publicMetadata
      targetPropId = clerkUser?.publicMetadata?.property_id;
      targetUnitId = clerkUser?.publicMetadata?.unit_id;
      if (!targetPropId || !targetUnitId) {
        toast.error('Tenant profile lacks property/unit assignment. Contact admin.');
        return;
      }
    } else {
      if (!targetPropId || !targetUnitId) {
        toast.error('Property and Unit selection required');
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

  const handleUpdateTicket = (ticketId) => {
    updateTicketMutation.mutate({
      id: ticketId,
      payload: {
        status: statusUpdate,
        agent_notes: agentNotes.trim()
      }
    });
  };

  const selectedProperty = properties.find(p => p._id === selectedPropertyId);
  const unitsOfSelectedProperty = selectedProperty?.units || [];

  if (ticketsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Wrench className="text-green-600" size={24} /> Maintenance Desk
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Log tickets, assign agents, and monitor repair status.
          </p>
        </div>
        {/* Tenants, Agents, and Admins can log tickets */}
        <button
          onClick={() => setShowAddTicket(!showAddTicket)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition duration-200 shadow-lg shadow-green-900/10"
        >
          <Plus size={16} /> Log Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">Recent Service Tickets</h2>
            <div className="space-y-3">
              {tickets.map((t) => {
                const isEmergency = t.priority === 'emergency' || t.priority === 'high';
                const isResolved = t.status === 'resolved' || t.status === 'closed';

                return (
                  <div 
                    key={t._id} 
                    className={`border rounded-xl p-4 transition duration-200 hover:shadow-sm ${
                      isEmergency && !isResolved
                        ? 'border-red-100 bg-red-50/20'
                        : 'border-slate-100 bg-slate-50/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            {t.ticket_code}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            t.priority === 'emergency'
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : t.priority === 'high'
                              ? 'bg-orange-50 text-orange-700'
                              : t.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.priority}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            t.status === 'resolved'
                              ? 'bg-green-50 text-green-700 border border-green-100'
                              : t.status === 'open'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-800 capitalize">{t.category} Repair</h3>
                        <p className="text-xs text-slate-500 font-medium">{t.description}</p>
                      </div>
                      
                      {/* Delete option for open tickets */}
                      {(isAdmin || (isTenant && t.status === 'open')) && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this ticket?')) {
                              deleteTicketMutation.mutate(t._id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-medium gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Building size={13} /> {t.property_id?.name || 'Assigned Property'} (Unit {t.unit_id})
                        </span>
                        {t.tenant_id?.full_name && (
                          <span className="flex items-center gap-1">
                            <User size={13} /> {t.tenant_id.full_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock size={13} /> {new Date(t.created_at).toLocaleDateString('en-KE')}
                        </span>
                        
                        {/* Manage/Edit Actions for Agents/Admins */}
                        {(isAdmin || isAgent) && !isResolved && (
                          <button
                            onClick={() => {
                              setActiveTicketId(t._id);
                              setStatusUpdate(t.status);
                              setAgentNotes(t.agent_notes || '');
                            }}
                            className="text-green-600 hover:text-green-500 font-bold"
                          >
                            Update
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Agent Notes display */}
                    {t.agent_notes && (
                      <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-1.5 text-xs text-slate-600">
                        <MessageSquare size={13} className="text-slate-400 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-700">Agent Notes:</p>
                          <p className="mt-0.5">{t.agent_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Update Inline Form */}
                    {activeTicketId === t._id && (
                      <div className="mt-4 p-4 border border-green-100 bg-green-50/10 rounded-xl space-y-3 animate-fadeIn">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Update Ticket Status</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Status</label>
                            <select
                              value={statusUpdate}
                              onChange={(e) => setStatusUpdate(e.target.value)}
                              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-green-500"
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
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Agent Notes</label>
                            <input
                              type="text"
                              value={agentNotes}
                              onChange={(e) => setAgentNotes(e.target.value)}
                              placeholder="Describe actions taken..."
                              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-green-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setActiveTicketId(null)}
                            className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTicket(t._id)}
                            disabled={updateTicketMutation.isPending}
                            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
                          >
                            Save Updates
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!tickets.length && (
                <div className="text-center p-8 text-slate-400 text-xs italic">
                  No maintenance tickets found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logging Panel */}
        <div className="space-y-6">
          {showAddTicket && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={16} className="text-green-600" /> Log Maintenance Ticket
              </h3>
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                {/* For Admin/Agent, select Property and Unit */}
                {!isTenant ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Select Property</label>
                      <select
                        value={selectedPropertyId}
                        onChange={(e) => {
                          setSelectedPropertyId(e.target.value);
                          setSelectedUnitId('');
                        }}
                        className="w-full bg-slate-50 border border-gray-100 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-green-500"
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
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Select Unit</label>
                        <select
                          value={selectedUnitId}
                          onChange={(e) => setSelectedUnitId(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-100 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-green-500"
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
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/60 text-xs text-slate-500 space-y-1">
                    <p className="font-bold text-slate-700">Ticket Location:</p>
                    <p>Your Assigned Rent Unit workspace</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-100 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-green-500 capitalize"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-100 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-green-500 capitalize"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details about the issue..."
                    rows={4}
                    maxLength={2000}
                    className="w-full bg-slate-50 border border-gray-100 focus:border-green-500 focus:ring-1 focus:ring-green-500 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none transition resize-none"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTicket(false)}
                    className="w-1/2 py-2.5 border border-gray-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTicketMutation.isPending}
                    className="w-1/2 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Submit Ticket
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Quick FAQ / Info block */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider">Help &amp; Guidelines</h3>
            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <ShieldAlert size={16} className="text-red-400 flex-shrink-0" />
                <p>
                  <strong>Emergencies:</strong> For leaks flooding a room, bare wires, or blocked structural exits, select <strong>Emergency</strong> priority immediately.
                </p>
              </div>
              <div className="flex gap-2">
                <CheckSquare size={16} className="text-emerald-400 flex-shrink-0" />
                <p>
                  <strong>Verification:</strong> Completed repairs must be verified by the tenant before status is closed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
