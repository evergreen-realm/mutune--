import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import { useThemeStore } from '../store/themeStore';
import {
  fetchAgentPerformance, fetchAllTasks, fetchMyTasks, fetchUsers, createTask, deleteTask, updateTaskStatus,
  fetchProperties, fetchPropertyTiers, submitAgentReview
} from '../lib/api';
import {
  Trophy, TrendingUp, CheckCircle2, AlertTriangle, Clock,
  Target, Wallet, Wrench, Plus, Trash2, X, Users2, BarChart3, Medal,
  ClipboardList, Check, Eye
} from 'lucide-react';

const FMT_KES = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
};

const MEDAL_COLORS = ['#fbbf24', '#9ca3af', '#b45309'];
const MEDAL_LABELS = ['🥇', '🥈', '🥉'];

const taskTypeIcon = (t) => ({ check_in: '🏠', payment_followup: '💰', inspection: '🔍', maintenance: '🔧' }[t] || '📋');

const taskStatusBadge = (s) => {
  switch (s) {
    case 'completed': return 'bg-green-500/10 border-green-500/20 text-green-400';
    case 'in_progress': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    case 'overdue': return 'bg-red-500/10 border-red-500/20 text-red-400';
    default: return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
  }
};

export default function AgentPerformancePage({ dbUser }) {
  const { user: clerkUser } = useUser();
  const { theme } = useThemeStore();

  const [agents,   setAgents]   = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [agentList, setAgentList] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('30');
  const [tab,      setTab]      = useState('leaderboard');
  const [taskModal, setTaskModal] = useState({ open: false });
  const [taskForm, setTaskForm] = useState({ assigned_to: '', title: '', description: '', type: 'payment_followup', due_date: '', related_property_id: '' });
  const [submitting, setSubmitting] = useState(false);

  // Agent Property Review Queue states
  const [reviewProperties, setReviewProperties] = useState([]);
  const [activeTiers, setActiveTiers] = useState([]);
  const [selectedProposedTiers, setSelectedProposedTiers] = useState({});
  const [reviewingId, setReviewingId] = useState(null);
  const [viewPropertyModal, setViewPropertyModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date(Date.now() - Number(period) * 86400000).toISOString().split('T')[0];
    try {
      const [perf, t, users, props, tiers] = await Promise.allSettled([
        fetchAgentPerformance({ from }),
        dbUser?.role === 'agent' ? fetchMyTasks() : fetchAllTasks({ limit: 200 }),
        fetchUsers({ role: 'agent', is_active: true }),
        fetchProperties({ review_status: 'pending_agent' }),
        fetchPropertyTiers()
      ]);
      if (perf.status === 'fulfilled') setAgents(Array.isArray(perf.value?.data) ? perf.value.data : []);
      if (t.status === 'fulfilled') setTasks(Array.isArray(t.value?.data) ? t.value.data : []);
      if (users.status === 'fulfilled') setAgentList(Array.isArray(users.value?.data) ? users.value.data : []);
      if (props.status === 'fulfilled') setReviewProperties(Array.isArray(props.value?.data) ? props.value.data : []);
      if (tiers.status === 'fulfilled') setActiveTiers(Array.isArray(tiers.value?.data) ? tiers.value.data : []);
    } finally {
      setLoading(false);
    }
  }, [period, dbUser]);

  useEffect(() => { load(); }, [load]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.assigned_to || !taskForm.title || !taskForm.due_date) {
      toast.error('Assigned agent, title, and due date are required');
      return;
    }
    setSubmitting(true);
    try {
      await createTask(taskForm);
      toast.success('Task created successfully ✓');
      setTaskModal({ open: false });
      setTaskForm({ assigned_to: '', title: '', description: '', type: 'payment_followup', due_date: '', related_property_id: '' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteTask(id);
      toast.success('Task deleted ✓');
      setTasks(prev => prev.filter(t => t._id !== id));
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to delete task');
    }
  };

  // Performance computations
  const totalCollected = agents.reduce((s, a) => s + (a.rent_collected_kes || 0), 0);
  const tasksCompleted = agents.reduce((s, a) => s + (a.completed_tasks || 0), 0);
  const tasksTotal     = agents.reduce((s, a) => s + (a.total_tasks || 0), 0);
  const avgCompletion  = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-3 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-muted text-xs font-semibold">Loading agent performance…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden pb-12">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-emerald-950/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-2 sm:px-4 pt-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 border-b border-border/40 pb-5">
          <div>
            <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest block mb-1">
              {dbUser?.role === 'agent' ? `Agent ID: ${dbUser.user_code || 'Pending'}` : 'Performance'}
            </span>
            <h1 className="text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl font-black tracking-tight mb-1">
              {dbUser?.role === 'agent' ? `Welcome, ${dbUser.full_name}` : 'Agent Performance Portal'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {dbUser?.role === 'agent' 
                ? 'Manage assigned properties, check-ins, tasks, and inventory details.'
                : 'Monitor active tasks, commission rates, and review queues.'}
            </p>
          </div>

          <div className="flex gap-2.5 items-center flex-wrap">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-surface/60 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none transition cursor-pointer font-bold"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>

            {dbUser?.role !== 'agent' && (
              <button
                onClick={() => setTaskModal({ open: true })}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-lg uppercase tracking-wider cursor-pointer active:scale-95"
              >
                <Plus size={14} /> Assign Task
              </button>
            )}
          </div>
        </div>

        {/* Executive summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-surface/30 backdrop-blur-md border border-primary/20 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Total Rent Collected</span>
              <Trophy size={18} className="text-amber-400" />
            </div>
            <p className="text-2xl font-black text-foreground font-mono">{FMT_KES(totalCollected)}</p>
            <p className="text-[10px] text-muted font-semibold mt-1">Confirmed payments across agents</p>
          </div>

          <div className="bg-surface/30 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Average Completion Rate</span>
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-foreground font-mono">{avgCompletion}%</p>
            <p className="text-[10px] text-muted font-semibold mt-1">{tasksCompleted} of {tasksTotal} tasks completed</p>
          </div>

          <div className="bg-surface/30 backdrop-blur-md border border-blue-500/20 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                {dbUser?.role === 'agent' ? 'My Agent ID' : 'Active Agent Count'}
              </span>
              <Users2 size={18} className="text-blue-400" />
            </div>
            <p className="text-2xl font-black text-foreground font-mono">
              {dbUser?.role === 'agent' ? (dbUser.user_code || 'Pending') : agents.length}
            </p>
            <p className="text-[10px] text-muted font-semibold mt-1">
              {dbUser?.role === 'agent' ? 'Your permanent system identifier' : 'Verified active managers'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border/40 pb-4">
          {[
            { key: 'leaderboard', label: '🏆 Leaderboard' },
            { key: 'tasks', label: `📋 Tasks (${tasks.length})` },
            { key: 'reviews', label: `🔍 Review Queue (${reviewProperties.length})` }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition tracking-wider uppercase cursor-pointer ${
                tab === t.key
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-transparent border border-transparent text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── LEADERBOARD TAB ────────────────────────────────────────────────── */}
        {tab === 'leaderboard' && (
          <div className="space-y-4">
            {agents.length === 0 ? (
              <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-12 text-center shadow-md">
                <Users2 size={36} className="text-muted mx-auto mb-3" />
                <p className="text-muted text-xs">No agent performance data for this period</p>
              </div>
            ) : (
              agents.map((agent, i) => (
                <div
                  key={agent.agent_id}
                  className={`bg-surface/30 backdrop-blur-md border rounded-2xl p-5 flex items-center gap-5 flex-wrap transition duration-300 hover:border-border ${
                    i === 0 ? 'border-amber-400/40 shadow-md shadow-amber-500/5' : 'border-border'
                  }`}
                >
                  <div className="text-xl sm:text-2xl w-10 text-center flex-shrink-0 font-extrabold text-foreground">
                    {i < 3 ? MEDAL_LABELS[i] : `#${i + 1}`}
                  </div>

                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0 shadow-md">
                    {agent.name?.charAt(0) || 'A'}
                  </div>

                  <div className="min-w-[150px] flex-1">
                    <p className="text-foreground text-xs font-bold">{agent.name}</p>
                    <p className="text-muted text-[10px] font-medium truncate">{agent.email}</p>
                  </div>

                  <div className="flex gap-6 flex-wrap justify-between sm:justify-start">
                    {[
                      { label: 'Completion', value: `${agent.task_completion_rate_pct}%`, color: agent.task_completion_rate_pct >= 80 ? 'text-emerald-400' : 'text-amber-400' },
                      { label: 'Tasks', value: `${agent.completed_tasks}/${agent.total_tasks}`, color: 'text-blue-450' },
                      { label: 'Collected', value: FMT_KES(agent.rent_collected_kes), color: 'text-emerald-400' },
                      { label: 'Tickets Resolved', value: agent.tickets_resolved, color: 'text-sky-400' }
                    ].map((kpi, j) => (
                      <div key={j} className="text-center min-w-[70px]">
                        <p className={`text-sm font-black ${kpi.color}`}>{kpi.value}</p>
                        <p className="text-muted text-[9px] font-bold uppercase tracking-wider mt-0.5">{kpi.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="w-24 flex-shrink-0 ml-auto hidden sm:block">
                    <div className="h-1.5 bg-background border border-border rounded-full overflow-hidden">
                      <div
                        className={`h-full ${agent.task_completion_rate_pct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full`}
                        style={{ width: `${agent.task_completion_rate_pct}%` }}
                      />
                    </div>
                    <p className="text-muted text-[10px] mt-1 text-right font-bold">{agent.task_completion_rate_pct}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TASKS TAB ──────────────────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-md">
            {tasks.length === 0 ? (
              <div className="p-12 text-center text-muted">
                <CheckCircle2 size={36} className="mx-auto mb-3" />
                <p className="text-xs">No tasks active currently</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {tasks.map(task => (
                  <div key={task._id} className="p-4 flex items-center justify-between gap-4 flex-wrap text-foreground hover:bg-background/20 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{taskTypeIcon(task.type)}</span>
                      <div>
                        <p className="text-xs font-bold">{task.title}</p>
                        <p className="text-muted text-[10px] mt-0.5">
                          Assigned to: <strong className="text-foreground">{task.assigned_to?.full_name || '—'}</strong> · Due: {FMT_DATE(task.due_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {dbUser?.role === 'agent' ? (
                        <select
                          value={task.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            try {
                              await updateTaskStatus(task._id, newStatus);
                              toast.success(`Task status updated to ${newStatus.replace('_', ' ')} ✓`);
                              setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
                            } catch (err) {
                              toast.error(err?.error?.message || 'Failed to update task status');
                            }
                          }}
                          className={`px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-wider focus:outline-none cursor-pointer ${taskStatusBadge(task.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 border rounded-full text-[9px] font-black uppercase tracking-wider ${taskStatusBadge(task.status)}`}>
                          {task.status}
                        </span>
                      )}

                      {dbUser?.role !== 'agent' && (
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1.5 bg-background/50 hover:bg-red-500/10 border border-border hover:border-red-500/30 text-muted hover:text-red-400 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS TAB ────────────────────────────────────────────────────── */}
        {tab === 'reviews' && (
          <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-md space-y-4">
            <div>
              <h3 className="text-foreground text-xs font-bold uppercase tracking-wider mb-1">Property Classification Queue</h3>
              <p className="text-[10px] text-muted mb-4">Select the calculated market tier for newly registered properties</p>
            </div>

            {reviewProperties.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <CheckCircle2 size={36} className="mx-auto mb-2" />
                <p className="text-xs">No properties currently waiting for tier assignment</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {reviewProperties.map(prop => (
                  <div key={prop._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-xs font-bold text-foreground">{prop.name}</p>
                      <p className="text-[10px] text-muted mt-0.5">{prop.address?.area} · {prop.units?.length || 0} Units</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        value={selectedProposedTiers[prop._id] || ''}
                        onChange={(e) => setSelectedProposedTiers(prev => ({ ...prev, [prop._id]: e.target.value }))}
                        className="bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none transition cursor-pointer font-bold"
                      >
                        <option value="">Select Tier...</option>
                        {activeTiers.map(t => (
                          <option key={t._id} value={t._id}>{t.name} ({FMT_KES(t.base_rent_kes)} base)</option>
                        ))}
                      </select>

                      <button
                        onClick={async () => {
                          const tierId = selectedProposedTiers[prop._id];
                          if (!tierId) {
                            toast.error('Please select a tier');
                            return;
                          }
                          setReviewingId(prop._id);
                          try {
                            await submitAgentReview(prop._id, tierId);
                            toast.success('Property tier updated and approved ✓');
                            setReviewProperties(prev => prev.filter(p => p._id !== prop._id));
                          } catch (err) {
                            toast.error(err?.error?.message || 'Failed to submit review');
                          } finally {
                            setReviewingId(null);
                          }
                        }}
                        disabled={reviewingId === prop._id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={12} /> {reviewingId === prop._id ? 'Saving...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Assign Task Modal ──────────────────────────────────────────────── */}
      {taskModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setTaskModal({ open: false })}
              className="absolute top-4 right-4 p-1.5 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border pb-3 mb-4">
              Assign Task
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Inspect water meters"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  placeholder="Add specific details for the agent..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full h-20 bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Assign Agent</label>
                <select
                  value={taskForm.assigned_to}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary transition font-bold"
                  required
                >
                  <option value="">Select Agent...</option>
                  {agentList.map(a => (
                    <option key={a._id} value={a._id}>{a.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Task Category</label>
                  <select
                    value={taskForm.type}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary transition font-bold"
                  >
                    <option value="payment_followup">Rent Collection</option>
                    <option value="inspection">Property Inspection</option>
                    <option value="maintenance">Maintenance Setup</option>
                    <option value="check_in">Tenant Onboarding</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider shadow-md active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Assigning...' : 'Assign Task'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
