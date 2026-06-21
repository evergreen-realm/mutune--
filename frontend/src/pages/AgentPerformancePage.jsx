import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
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
const taskStatusColor = s => ({ pending: 'rgba(245,158,11,0.12)', in_progress: 'rgba(37,99,235,0.12)', completed: 'rgba(16,185,129,0.12)', overdue: 'rgba(239,68,68,0.12)' }[s] || 'rgba(156,163,175,0.1)');
const taskStatusText  = s => ({ pending: '#d97706', in_progress: '#2563EB', completed: '#059669', overdue: '#dc2626' }[s] || 'currentColor');


export default function AgentPerformancePage({ dbUser }) {
  const { user: clerkUser } = useUser();

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
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleCreateTask = async () => {
    if (!taskForm.assigned_to || !taskForm.title.trim() || !taskForm.description.trim() || !taskForm.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await createTask({
        ...taskForm,
        due_date: new Date(taskForm.due_date).toISOString()
      });
      toast.success('Task assigned!');
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
      toast.success('Task deleted');
      setTasks(prev => prev.filter(t => t._id !== id));
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handleSubmitReview = async (propertyId) => {
    const proposed_tier_id = selectedProposedTiers[propertyId];
    if (!proposed_tier_id) {
      toast.error('Please select a proposed tier first.');
      return;
    }
    setReviewingId(propertyId);
    try {
      await submitAgentReview(propertyId, proposed_tier_id);
      toast.success('Property tier proposed successfully!');
      // Remove from queue
      setReviewProperties(prev => prev.filter(p => p._id !== propertyId));
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to submit review');
    } finally {
      setReviewingId(null);
    }
  };

  const totalRevenue = agents.reduce((s, a) => s + Number(a.rent_collected_kes || 0), 0);
  const avgCompletion = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.task_completion_rate_pct, 0) / agents.length) : 0;

  const tabStyle = (t) => ({
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
    background: tab === t ? '#2563EB' : 'rgba(156,163,175,0.15)',
    color: tab === t ? '#fff' : 'inherit'
  });

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(37,99,235,0.3)', borderTop: '3px solid #2563EB', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p className="text-slate-500 dark:text-slate-400 text-xs">Loading agent data…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 p-7 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -right-[5%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[40px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-7 flex-wrap gap-3">
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl font-black tracking-tight mb-1">Agent Performance</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">KPIs, leaderboards & task management</p>
          </div>
          <div className="flex gap-2.5 items-center flex-wrap">
            <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-slate-100 text-xs outline-none">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            {dbUser?.role !== 'agent' && (
              <button onClick={() => setTaskModal({ open: true })} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(37,99,235,0.4)'
              }}>
                <Plus size={14} /> Assign Task
              </button>
            )}
          </div>
        </div>

        {/* Agent ID Banner */}
        {dbUser?.user_code && dbUser.role === 'agent' && (
          <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-5 mb-6 flex-wrap">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <Medal size={22} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-slate-100 text-sm font-extrabold mb-0.5">{dbUser.full_name}</p>
              <div className="flex gap-4 flex-wrap mt-1">
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">ID: {dbUser.user_code}</span>
                {dbUser.earb_license && <span className="text-slate-500 dark:text-slate-400 text-xs">EARB: <strong className="text-blue-600 dark:text-blue-450">{dbUser.earb_license}</strong></span>}
                {dbUser.phone && <span className="text-slate-500 dark:text-slate-400 text-xs">📞 {dbUser.phone}</span>}
                {dbUser.assigned_areas?.length > 0 && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs">📍 {dbUser.assigned_areas.join(', ')}</span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-3 py-1">
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase">✓ Approved</span>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          {(dbUser?.role === 'agent'
            ? [
                { label: 'Tasks Completed', value: (agents.find(a => a.agent_id?.toString() === dbUser._id?.toString()) || agents[0])?.completed_tasks ?? 0, icon: <CheckCircle2 size={18} />, color: '#10b981' },
                { label: 'Avg Response Time', value: (() => { const me = agents.find(a => a.agent_id?.toString() === dbUser._id?.toString()) || agents[0]; const hrs = me?.avg_task_completion_hours ?? me?.avg_task_completion_time_hrs; return hrs ? `${hrs.toFixed(1)} hrs` : '—'; })(), icon: <Target size={18} />, color: '#2563EB' },
                { label: 'Collections This Month', value: FMT_KES((agents.find(a => a.agent_id?.toString() === dbUser._id?.toString()) || agents[0])?.rent_collected_kes), icon: <Wallet size={18} />, color: '#f59e0b' },
                { label: 'Active Tasks', value: tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length, icon: <Clock size={18} />, color: '#ec4899' }
              ]
            : [
                { label: 'Total Agents', value: agents.length, icon: <Users2 size={18} />, color: '#2563EB' },
                { label: 'Avg Completion', value: `${avgCompletion}%`, icon: <Target size={18} />, color: '#10b981' },
                { label: 'Revenue Collected', value: FMT_KES(totalRevenue), icon: <Wallet size={18} />, color: '#f59e0b' },
                { label: 'Active Tasks', value: tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length, icon: <Clock size={18} />, color: '#ec4899' }
              ]
          ).map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}22`, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">{s.label}</p>
              <p className="text-slate-900 dark:text-slate-100 text-xl font-black">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button style={tabStyle('leaderboard')} onClick={() => setTab('leaderboard')}>🏆 Leaderboard</button>
          <button style={tabStyle('tasks')} onClick={() => setTab('tasks')}>📋 Tasks ({tasks.length})</button>
          <button style={tabStyle('reviews')} onClick={() => setTab('reviews')}>🔍 Review Queue ({reviewProperties.length})</button>
        </div>

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div className="flex flex-col gap-3">
            {agents.length === 0 ? (
              <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                <Users2 size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-xs">No agent data for this period</p>
              </div>
            ) : agents.map((agent, i) => (
              <div key={agent.agent_id} className={`bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-5 sm:px-6 flex items-center gap-5 flex-wrap ${i === 0 ? 'border-amber-400/40 shadow-amber-500/5' : 'border-slate-200 dark:border-slate-800'}`}>
                {/* Rank */}
                <div className="text-xl sm:text-2xl w-10 text-center flex-shrink-0">
                  {i < 3 ? MEDAL_LABELS[i] : <span className="text-slate-400 dark:text-slate-600 text-sm font-extrabold">#{i + 1}</span>}
                </div>

                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${MEDAL_COLORS[i] || '#2563EB'}, #1D4ED8)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 900, flexShrink: 0 }}>
                  {agent.name?.charAt(0) || 'A'}
                </div>

                {/* Name */}
                <div className="min-w-[150px]">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-extrabold mb-0.5">{agent.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{agent.email}</p>
                </div>

                {/* KPIs */}
                <div className="flex-1 flex gap-6 flex-wrap justify-between sm:justify-start">
                  {[
                    { label: 'Completion', value: `${agent.task_completion_rate_pct}%`, color: agent.task_completion_rate_pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : agent.task_completion_rate_pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-650' },
                    { label: 'Tasks', value: `${agent.completed_tasks}/${agent.total_tasks}`, color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Collected', value: FMT_KES(agent.rent_collected_kes), color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Tickets Resolved', value: agent.tickets_resolved, color: 'text-sky-600 dark:text-sky-400' },
                    { label: 'Overdue', value: agent.overdue_tasks, color: agent.overdue_tasks > 0 ? 'text-red-650' : 'text-emerald-600 dark:text-emerald-400' }
                  ].map((kpi, j) => (
                    <div key={j} className="text-center min-w-[70px]">
                      <p className={`text-base font-black ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="w-24 flex-shrink-0 ml-auto">
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${agent.task_completion_rate_pct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full`} style={{ width: `${agent.task_completion_rate_pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 text-right font-medium">{agent.task_completion_rate_pct}%</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TASKS LIST */}
        {tab === 'tasks' && (
          <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {tasks.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-xs">No tasks found</p>
              </div>
            ) : tasks.map(task => (
              <div key={task._id} className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800/60 last:border-b-0 flex items-center gap-4 flex-wrap text-slate-900 dark:text-slate-100">
                <span className="text-xl">{taskTypeIcon(task.type)}</span>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-extrabold mb-0.5">{task.title}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Assigned to: {task.assigned_to?.full_name || '—'} · Due: {FMT_DATE(task.due_date)}
                  </p>
                </div>
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
                    style={{
                      background: taskStatusColor(task.status),
                      color: taskStatusText(task.status),
                      border: `1px solid ${taskStatusText(task.status)}55`,
                      borderRadius: 100,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="pending" style={{ color: '#d97706' }}>Pending</option>
                    <option value="in_progress" style={{ color: '#2563EB' }}>In Progress</option>
                    <option value="completed" style={{ color: '#059669' }}>Completed</option>
                    <option value="overdue" style={{ color: '#dc2626' }}>Overdue</option>
                  </select>
                ) : (
                  <span className="text-xs font-bold py-1 px-3 rounded-full text-center border capitalize" style={{ background: taskStatusColor(task.status), color: taskStatusText(task.status), borderColor: `${taskStatusText(task.status)}33` }}>
                    {task.status?.replace('_', ' ')}
                  </span>
                )}
                {dbUser?.role !== 'agent' && (
                  <button onClick={() => handleDeleteTask(task._id)} className="bg-red-100 dark:bg-red-950/40 hover:bg-red-200 border-none text-red-650 rounded-lg p-2 cursor-pointer transition">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REVIEW QUEUE */}
        {tab === 'reviews' && (
          <div className="flex flex-col gap-3">
            {reviewProperties.length === 0 ? (
              <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
                <ClipboardList size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-xs">No properties pending agent review</p>
              </div>
            ) : reviewProperties.map(property => (
              <div key={property._id} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:px-6 flex items-center gap-4 flex-wrap text-slate-900 dark:text-slate-100">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-slate-900 dark:text-slate-100 text-sm font-extrabold mb-0.5">{property.name}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Code: {property.property_code} · Type: {property.type} · Area: {property.address?.area || '—'}, {property.address?.city || '—'}
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                    Units: {property.units?.length || 0} units · Base Rent: {FMT_KES(property.units?.[0]?.rent_kes || 0)}
                  </p>
                </div>

                <div className="flex gap-2 items-center flex-wrap ml-auto">
                  {/* Details Button */}
                  <button
                    onClick={() => setViewPropertyModal(property)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs font-bold cursor-pointer transition"
                  >
                    <Eye size={14} /> Details
                  </button>

                  {/* Proposed Tier Selection */}
                  <select
                    value={selectedProposedTiers[property._id] || ''}
                    onChange={e => setSelectedProposedTiers(prev => ({ ...prev, [property._id]: e.target.value }))}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 text-xs outline-none"
                  >
                    <option value="">Select Proposed Tier…</option>
                    {activeTiers.map(tier => (
                      <option key={tier._id} value={tier._id}>
                        {tier.name} ({FMT_KES(tier.min_rent_kes)} - {FMT_KES(tier.max_rent_kes)})
                      </option>
                    ))}
                  </select>

                  {/* Submit Review Button */}
                  <button
                    onClick={() => handleSubmitReview(property._id)}
                    disabled={reviewingId === property._id || !selectedProposedTiers[property._id]}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                      background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                      border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      cursor: (reviewingId === property._id || !selectedProposedTiers[property._id]) ? 'not-allowed' : 'pointer',
                      opacity: (reviewingId === property._id || !selectedProposedTiers[property._id]) ? 0.5 : 1,
                      boxShadow: selectedProposedTiers[property._id] ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
                    }}
                  >
                    <Check size={14} /> {reviewingId === property._id ? 'Submitting…' : 'Submit Review'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task assignment modal */}
      {taskModal.open && (
        <>
          <div onClick={() => setTaskModal({ open: false })} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold">Assign Task to Agent</h3>
              <button onClick={() => setTaskModal({ open: false })} className="background-none border-none text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer p-1.5 transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Agent *', key: 'assigned_to', type: 'select', options: agentList.map(a => ({ value: a._id, label: a.full_name })) },
                { label: 'Task Type *', key: 'type', type: 'select', options: [{ value: 'check_in', label: '🏠 Check-In' }, { value: 'payment_followup', label: '💰 Payment Follow-Up' }, { value: 'inspection', label: '🔍 Inspection' }, { value: 'maintenance', label: '🔧 Maintenance' }] },
                { label: 'Title *', key: 'title', type: 'text', placeholder: 'e.g. Follow up on arrears for Unit 3A' },
                { label: 'Description *', key: 'description', type: 'textarea', placeholder: 'Detailed instructions for the agent...' },
                { label: 'Due Date *', key: 'due_date', type: 'datetime-local' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={taskForm[field.key]} onChange={e => setTaskForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none">
                      <option value="">Select…</option>
                      {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={taskForm[field.key]} onChange={e => setTaskForm(f => ({ ...f, [field.key]: e.target.value }))} rows={3} placeholder={field.placeholder}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none resize-vertical fontFamily-inherit" />
                  ) : (
                    <input type={field.type} value={taskForm[field.key]} onChange={e => setTaskForm(f => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs outline-none colorScheme-dark" />
                  )}
                </div>
              ))}
              <button onClick={handleCreateTask} disabled={submitting} style={{
                padding: '13px', background: submitting ? 'rgba(37,99,235,0.4)' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 4
              }}>
                {submitting ? 'Assigning…' : '✓ Assign Task'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Property Details Modal */}
      {viewPropertyModal && (
        <>
          <div onClick={() => setViewPropertyModal(null)} className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl max-h-[85vh] overflow-y-auto z-[201] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 dark:text-slate-100 text-lg font-extrabold">Property Review: {viewPropertyModal.name}</h3>
              <button onClick={() => setViewPropertyModal(null)} className="background-none border-none text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer p-1.5 transition">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 text-slate-700 dark:text-slate-350">
              {/* Photo Carousel or Grid */}
              {viewPropertyModal.photos && viewPropertyModal.photos.length > 0 ? (
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-2">Photos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {viewPropertyModal.photos.map((photoUrl, idx) => (
                      <img key={idx} src={photoUrl} alt={`Property ${idx + 1}`} className="w-full h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-800" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-xl text-center text-xs text-slate-400 dark:text-slate-650">
                  No photos uploaded for this property
                </div>
              )}

              {/* Main Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1.5">General Info</p>
                  <p className="text-xs"><strong>Code:</strong> {viewPropertyModal.property_code}</p>
                  <p className="text-xs"><strong>Type:</strong> {viewPropertyModal.type}</p>
                  <p className="text-xs"><strong>Floors:</strong> {viewPropertyModal.num_floors || 1}</p>
                  <p className="text-xs"><strong>Year Built:</strong> {viewPropertyModal.year_built || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1.5">Address</p>
                  <p className="text-xs"><strong>Street:</strong> {viewPropertyModal.address?.street || '—'}</p>
                  <p className="text-xs"><strong>Area:</strong> {viewPropertyModal.address?.area}</p>
                  <p className="text-xs"><strong>City:</strong> {viewPropertyModal.address?.city}</p>
                  <p className="text-xs"><strong>County:</strong> {viewPropertyModal.address?.county}</p>
                </div>
              </div>

              {/* Description */}
              {viewPropertyModal.description && (
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-1.5">Description</p>
                  <p className="text-xs leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">{viewPropertyModal.description}</p>
                </div>
              )}

              {/* Units List */}
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mb-2">Units Configured</p>
                <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  {viewPropertyModal.units && viewPropertyModal.units.map((unit, idx) => (
                    <div key={idx} className="flex justify-between p-2.5 px-4 border-b border-slate-100 dark:border-slate-900/60 last:border-b-0 items-center">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Unit {unit.unit_number} ({unit.type})</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-450 font-bold">{FMT_KES(unit.rent_kes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
