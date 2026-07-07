import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import {
  fetchAllTasks, fetchMyTasks, fetchUsers, fetchProperties,
  createTask, updateTaskStatus, deleteTask
} from '../lib/api';
import {
  ClipboardList, Plus, Search, Calendar, User, Building,
  CheckCircle2, Clock, AlertCircle, X, ChevronRight, Edit3, Trash2,
  ListTodo, Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';

const COLUMNS = [
  { id: 'pending', label: 'To Do', color: 'border-slate-500/20 text-slate-500 bg-slate-500/5' },
  { id: 'in_progress', label: 'In Progress', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5' },
  { id: 'completed', label: 'Completed', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' }
];

const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function TasksPage({ dbUser }) {
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const qc = useQueryClient();

  const isAdmin = ['admin', 'super_admin'].includes(dbUser?.role);
  const isAgent = dbUser?.role === 'agent';

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');

  // Modal / Drawer states
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New task form state
  const [form, setForm] = useState({
    assigned_to: '',
    title: '',
    description: '',
    type: 'payment_followup',
    due_date: '',
    related_property_id: '',
    related_unit_id: '',
    related_tenant_id: ''
  });

  // Queries
  const { data: tasksData, isLoading: loadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', dbUser?.role],
    queryFn: () => (isAgent ? fetchMyTasks() : fetchAllTasks({ limit: 1000 })),
    enabled: !!dbUser?.role
  });
  const tasks = tasksData?.data || [];

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchUsers({ role: 'agent', is_active: true }),
    enabled: isAdmin
  });
  const agents = agentsData?.data || [];

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetchProperties({ limit: 500 }),
    enabled: isAdmin
  });
  const properties = propertiesData?.data || [];

  // Mutations
  const invalidateTasks = () => qc.invalidateQueries({ queryKey: ['tasks'] });

  const createMut = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      toast.success('Task created successfully ✓');
      setIsAddModalOpen(false);
      setForm({
        assigned_to: '',
        title: '',
        description: '',
        type: 'payment_followup',
        due_date: '',
        related_property_id: '',
        related_unit_id: '',
        related_tenant_id: ''
      });
      invalidateTasks();
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to create task');
    }
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }) => updateTaskStatus(id, status),
    onSuccess: () => {
      toast.success('Task status updated');
      invalidateTasks();
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to update task');
    }
  });

  const deleteMut = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      toast.success('Task deleted successfully');
      setSelectedTask(null);
      invalidateTasks();
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to delete task');
    }
  });

  // Selected property units logic
  const selectedPropertyObj = properties.find(p => p._id === form.related_property_id);
  const units = selectedPropertyObj?.units || [];

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    // Search
    const matchesSearch = t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Type filter
    const matchesType = filterType === 'all' || t.type === filterType;

    // Agent filter (Only applicable to Admin)
    const matchesAgent = filterAgent === 'all' || t.assigned_to?._id === filterAgent || t.assigned_to === filterAgent;

    return matchesSearch && matchesType && matchesAgent;
  });

  // Drag over / drop simulated logic for ease of use
  const moveTask = (taskId, newStatus) => {
    updateStatusMut.mutate({ id: taskId, status: newStatus });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!form.assigned_to || !form.title || !form.due_date || !form.description) {
      toast.error('All required fields must be filled');
      return;
    }
    createMut.mutate(form);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <ClipboardList size={22} className="text-primary" /> Task Board
          </h1>
          <p className="text-xs text-muted">
            {isAgent ? 'Manage your assigned daily activities' : 'Assign, monitor and review agent field tasks'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={14} /> Add New Task
          </button>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-surface border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search task title/details..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-xl bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border border-border rounded-xl px-3 py-2 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="all">All Types</option>
            <option value="check_in">🏠 Check In</option>
            <option value="payment_followup">💰 Payment Follow-up</option>
            <option value="inspection">🔍 Inspection</option>
            <option value="maintenance">🔧 Maintenance</option>
          </select>

          {/* Agent Filter (Admin only) */}
          {isAdmin && (
            <select
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
              className="border border-border rounded-xl px-3 py-2 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">All Agents</option>
              {agents.map(a => (
                <option key={a._id} value={a._id}>{a.full_name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => refetchTasks()}
          className="p-2 hover:bg-background border border-border rounded-xl text-muted hover:text-foreground transition"
          title="Refresh tasks"
        >
          <Loader2 className={`w-4 h-4 ${loadingTasks ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.id || (col.id === 'pending' && t.status === 'overdue'));
          return (
            <div
              key={col.id}
              className={`border border-border/80 rounded-3xl bg-surface/50 p-4 space-y-4 min-h-[500px] flex flex-col`}
            >
              {/* Column Header */}
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className={`text-xs font-black uppercase tracking-wider ${col.color.split(' ')[1]}`}>
                  {col.label}
                </span>
                <span className="bg-background border border-border text-[10px] font-bold text-muted px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {colTasks.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center border border-dashed border-border/40 rounded-2xl text-muted text-xs italic">
                    No tasks in this status
                  </div>
                ) : (
                  colTasks.map(task => {
                    const isTaskOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';
                    return (
                      <motion.div
                        key={task._id}
                        layoutId={task._id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-4 bg-surface border border-border hover:border-primary/40 rounded-2xl shadow-sm cursor-pointer hover:shadow transition relative overflow-hidden group`}
                      >
                        {isTaskOverdue && (
                          <div className="absolute top-0 right-0 left-0 h-1 bg-red-500 animate-pulse" />
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-md border border-border bg-background text-muted capitalize">
                              {task.type?.replace('_', ' ')}
                            </span>
                            <span className={`text-[9px] font-bold ${isTaskOverdue ? 'text-red-400' : 'text-muted'}`}>
                              {FMT_DATE(task.due_date)}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                            {task.title}
                          </h3>

                          <p className="text-[11px] text-muted line-clamp-2">
                            {task.description}
                          </p>

                          {/* Task footer */}
                          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted">
                            <div className="flex items-center gap-1">
                              <User size={10} />
                              <span className="truncate max-w-[80px]">
                                {task.assigned_to?.full_name || 'Unassigned'}
                              </span>
                            </div>

                            {/* Dropdown status changer / quick actions */}
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <select
                                value={task.status}
                                onChange={e => moveTask(task._id, e.target.value)}
                                className="bg-background border border-border text-[9px] font-medium rounded px-1 py-0.5 text-foreground focus:outline-none"
                              >
                                <option value="pending">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Settings / Details Sidebar Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-surface border-l border-border shadow-2xl z-[201] p-6 flex flex-col space-y-6 text-foreground"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="font-extrabold text-sm tracking-wide uppercase">Task Control Centre</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {/* Status Indicator */}
                <div className="p-4 bg-background/50 border border-border rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-muted">Current Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={e => {
                      moveTask(selectedTask._id, e.target.value);
                      setSelectedTask(prev => ({ ...prev, status: e.target.value }));
                    }}
                    className="bg-surface border border-border text-xs font-bold rounded-xl px-3 py-1.5 text-foreground focus:outline-none"
                  >
                    <option value="pending">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Details Section */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Title</span>
                    <p className="text-sm font-extrabold">{selectedTask.title}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Description</span>
                    <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Due Date</span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Calendar size={13} className="text-primary" />
                        {FMT_DATE(selectedTask.due_date)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Assigned Agent</span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <User size={13} className="text-primary" />
                        {selectedTask.assigned_to?.full_name || 'Unassigned'}
                      </div>
                    </div>
                  </div>

                  {selectedTask.related_property_id && (
                    <div className="border-t border-border/40 pt-4">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Related Property</span>
                      <div className="flex items-center gap-1.5 text-xs text-foreground font-bold">
                        <Building size={13} className="text-primary" />
                        {selectedTask.related_property_id.name}
                        {selectedTask.related_unit_id && (
                          <span className="text-muted font-mono font-medium"> (Unit {selectedTask.related_unit_id})</span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTask.related_tenant_id && (
                    <div className="border-t border-border/40 pt-4">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Tenant Details</span>
                      <p className="text-xs font-bold text-foreground">{selectedTask.related_tenant_id.full_name}</p>
                      <p className="text-[10px] text-muted mt-0.5">{selectedTask.related_tenant_id.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="border-t border-border pt-4 flex gap-3">
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this task?')) {
                        deleteMut.mutate(selectedTask._id);
                      }
                    }}
                    className="flex-1 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} /> Delete Task
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add New Task Modal (Admin Only) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl p-6 relative text-foreground space-y-4"
            >
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
              >
                <X size={14} />
              </button>

              <h3 className="text-sm font-extrabold uppercase tracking-wider border-b border-border pb-3 flex items-center gap-2">
                <Plus size={16} className="text-primary" /> Create New Field Task
              </h3>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                {/* Assigned Agent */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Assign Agent *</label>
                  <select
                    value={form.assigned_to}
                    onChange={e => setForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                    required
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition"
                  >
                    <option value="">Select Field Agent</option>
                    {agents.map(a => (
                      <option key={a._id} value={a._id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Task Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Inspect floor tile cracks in A4"
                    required
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Description *</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide details of what needs to be checked or completed..."
                    rows={3}
                    required
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>

                {/* Type & Due Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Task Type</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition"
                    >
                      <option value="check_in">🏠 Check In</option>
                      <option value="payment_followup">💰 Payment Follow-up</option>
                      <option value="inspection">🔍 Inspection</option>
                      <option value="maintenance">🔧 Maintenance</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Due Date *</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                      required
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition"
                    />
                  </div>
                </div>

                {/* Related Property & Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Related Property</label>
                    <select
                      value={form.related_property_id}
                      onChange={e => setForm(prev => ({ ...prev, related_property_id: e.target.value, related_unit_id: '' }))}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition"
                    >
                      <option value="">Select Property (Optional)</option>
                      {properties.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">Unit Number</label>
                    <select
                      value={form.related_unit_id}
                      onChange={e => setForm(prev => ({ ...prev, related_unit_id: e.target.value }))}
                      disabled={!form.related_property_id}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:border-primary transition disabled:opacity-50"
                    >
                      <option value="">Select Unit (Optional)</option>
                      {units.map(u => (
                        <option key={u._id} value={u.unit_number}>{u.unit_number}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-border hover:bg-background rounded-xl text-muted hover:text-foreground font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="px-5 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition flex items-center gap-1.5"
                  >
                    {createMut.isPending && <Loader2 size={13} className="animate-spin" />}
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
