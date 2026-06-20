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
const taskStatusColor = s => ({ pending: 'rgba(251,191,36,0.15)', in_progress: 'rgba(99,102,241,0.15)', completed: 'rgba(16,185,129,0.15)', overdue: 'rgba(239,68,68,0.15)' }[s] || 'rgba(255,255,255,0.1)');
const taskStatusText  = s => ({ pending: '#fbbf24', in_progress: '#a78bfa', completed: '#34d399', overdue: '#f87171' }[s] || '#fff');

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
    background: tab === t ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
    color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)'
  });

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #24243e)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading agent data…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', padding: '28px' }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Agent Performance</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>KPIs, leaderboards & task management</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, outline: 'none' }}>
              <option value="7" style={{ background: '#1a1a3e' }}>Last 7 days</option>
              <option value="30" style={{ background: '#1a1a3e' }}>Last 30 days</option>
              <option value="90" style={{ background: '#1a1a3e' }}>Last 90 days</option>
            </select>
            {dbUser?.role !== 'agent' && (
              <button onClick={() => setTaskModal({ open: true })} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(99,102,241,0.4)'
              }}>
                <Plus size={14} /> Assign Task
              </button>
            )}
          </div>
        </div>

        {/* Agent ID Banner — shown only for agent users when they have an approved user_code */}
        {dbUser?.user_code && dbUser.role === 'agent' && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16, padding: '16px 24px',
            display: 'flex', alignItems: 'center', gap: 20,
            marginBottom: 24, flexWrap: 'wrap'
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Medal size={22} style={{ color: '#10b981' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{dbUser.full_name}</p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>ID: {dbUser.user_code}</span>
                {dbUser.earb_license && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>EARB: <strong style={{ color: '#a78bfa' }}>{dbUser.earb_license}</strong></span>}
                {dbUser.phone && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>📞 {dbUser.phone}</span>}
                {dbUser.assigned_areas?.length > 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>📍 {dbUser.assigned_areas.join(', ')}</span>
                )}
              </div>
            </div>
            <div style={{ flexShrink: 0, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '4px 12px' }}>
              <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>✓ Approved</span>
            </div>
          </div>
        )}


        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          {(dbUser?.role === 'agent'
            ? [
                { label: 'Tasks Completed', value: (agents.find(a => a.agent_id?.toString() === dbUser._id?.toString()) || agents[0])?.completed_tasks ?? 0, icon: <CheckCircle2 size={18} />, color: '#10b981' },
                { label: 'Avg Response Time', value: (() => { const me = agents.find(a => a.agent_id?.toString() === dbUser._id?.toString()) || agents[0]; const hrs = me?.avg_task_completion_hours ?? me?.avg_task_completion_time_hrs; return hrs ? `${hrs.toFixed(1)} hrs` : '—'; })(), icon: <Target size={18} />, color: '#6366f1' },
                { label: 'Collections This Month', value: FMT_KES((agents.find(a => a.agent_id?.toString() === dbUser._id?.toString()) || agents[0])?.rent_collected_kes), icon: <Wallet size={18} />, color: '#f59e0b' },
                { label: 'Active Tasks', value: tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length, icon: <Clock size={18} />, color: '#ec4899' }
              ]
            : [
                { label: 'Total Agents', value: agents.length, icon: <Users2 size={18} />, color: '#6366f1' },
                { label: 'Avg Completion', value: `${avgCompletion}%`, icon: <Target size={18} />, color: '#10b981' },
                { label: 'Revenue Collected', value: FMT_KES(totalRevenue), icon: <Wallet size={18} />, color: '#f59e0b' },
                { label: 'Active Tasks', value: tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length, icon: <Clock size={18} />, color: '#ec4899' }
              ]
          ).map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 20 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.color}22`, border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</p>
              <p style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button style={tabStyle('leaderboard')} onClick={() => setTab('leaderboard')}>🏆 Leaderboard</button>
          <button style={tabStyle('tasks')} onClick={() => setTab('tasks')}>📋 Tasks ({tasks.length})</button>
          <button style={tabStyle('reviews')} onClick={() => setTab('reviews')}>🔍 Review Queue ({reviewProperties.length})</button>
        </div>

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agents.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <Users2 size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No agent data for this period</p>
              </div>
            ) : agents.map((agent, i) => (
              <div key={agent.agent_id} style={{
                background: i === 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 20, padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                boxShadow: i === 0 ? '0 8px 32px rgba(251,191,36,0.1)' : 'none'
              }}>
                {/* Rank */}
                <div style={{ fontSize: 24, width: 40, textAlign: 'center', flexShrink: 0 }}>
                  {i < 3 ? MEDAL_LABELS[i] : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 800 }}>#{i + 1}</span>}
                </div>

                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${MEDAL_COLORS[i] || '#6366f1'}, #8b5cf6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 900, flexShrink: 0 }}>
                  {agent.name?.charAt(0) || 'A'}
                </div>

                {/* Name */}
                <div style={{ minWidth: 150 }}>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{agent.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{agent.email}</p>
                </div>

                {/* KPIs */}
                <div style={{ flex: 1, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Completion', value: `${agent.task_completion_rate_pct}%`, color: agent.task_completion_rate_pct >= 80 ? '#10b981' : agent.task_completion_rate_pct >= 50 ? '#f59e0b' : '#f87171' },
                    { label: 'Tasks', value: `${agent.completed_tasks}/${agent.total_tasks}`, color: '#a78bfa' },
                    { label: 'Collected', value: FMT_KES(agent.rent_collected_kes), color: '#34d399' },
                    { label: 'Tickets Resolved', value: agent.tickets_resolved, color: '#60a5fa' },
                    { label: 'Overdue', value: agent.overdue_tasks, color: agent.overdue_tasks > 0 ? '#f87171' : '#34d399' }
                  ].map((kpi, j) => (
                    <div key={j} style={{ textAlign: 'center' }}>
                      <p style={{ color: kpi.color, fontSize: 17, fontWeight: 900 }}>{kpi.value}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div style={{ width: 100, flexShrink: 0 }}>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${agent.task_completion_rate_pct}%`, background: agent.task_completion_rate_pct >= 80 ? '#10b981' : '#f59e0b', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4, textAlign: 'right' }}>{agent.task_completion_rate_pct}%</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TASKS LIST */}
        {tab === 'tasks' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
            {tasks.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <CheckCircle2 size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No tasks found</p>
              </div>
            ) : tasks.map(task => (
              <div key={task._id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20 }}>{taskTypeIcon(task.type)}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{task.title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
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
                      fontSize: 11,
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="pending" style={{ background: '#1a1a3e', color: '#fbbf24' }}>Pending</option>
                    <option value="in_progress" style={{ background: '#1a1a3e', color: '#a78bfa' }}>In Progress</option>
                    <option value="completed" style={{ background: '#1a1a3e', color: '#34d399' }}>Completed</option>
                    <option value="overdue" style={{ background: '#1a1a3e', color: '#f87171' }}>Overdue</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: taskStatusColor(task.status), color: taskStatusText(task.status), textTransform: 'capitalize', border: `1px solid ${taskStatusText(task.status)}33` }}>
                    {task.status?.replace('_', ' ')}
                  </span>
                )}
                {dbUser?.role !== 'agent' && (
                  <button onClick={() => handleDeleteTask(task._id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REVIEW QUEUE */}
        {tab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviewProperties.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <ClipboardList size={40} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No properties pending agent review</p>
              </div>
            ) : reviewProperties.map(property => (
              <div key={property._id} style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{property.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    Code: {property.property_code} · Type: {property.type} · Area: {property.address?.area || '—'}, {property.address?.city || '—'}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 }}>
                    Units: {property.units?.length || 0} units · Base Rent: {FMT_KES(property.units?.[0]?.rent_kes || 0)}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Details Button */}
                  <button
                    onClick={() => setViewPropertyModal(property)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, color: '#fff', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <Eye size={14} /> Details
                  </button>

                  {/* Proposed Tier Selection */}
                  <select
                    value={selectedProposedTiers[property._id] || ''}
                    onChange={e => setSelectedProposedTiers(prev => ({ ...prev, [property._id]: e.target.value }))}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 13, outline: 'none'
                    }}
                  >
                    <option value="" style={{ background: '#1a1a3e' }}>Select Proposed Tier…</option>
                    {activeTiers.map(tier => (
                      <option key={tier._id} value={tier._id} style={{ background: '#1a1a3e' }}>
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
          <div onClick={() => setTaskModal({ open: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '90%', maxWidth: 500, zIndex: 201,
            background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32,
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Assign Task to Agent</h3>
              <button onClick={() => setTaskModal({ open: false })} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Agent *', key: 'assigned_to', type: 'select', options: agentList.map(a => ({ value: a._id, label: a.full_name })) },
                { label: 'Task Type *', key: 'type', type: 'select', options: [{ value: 'check_in', label: '🏠 Check-In' }, { value: 'payment_followup', label: '💰 Payment Follow-Up' }, { value: 'inspection', label: '🔍 Inspection' }, { value: 'maintenance', label: '🔧 Maintenance' }] },
                { label: 'Title *', key: 'title', type: 'text', placeholder: 'e.g. Follow up on arrears for Unit 3A' },
                { label: 'Description *', key: 'description', type: 'textarea', placeholder: 'Detailed instructions for the agent...' },
                { label: 'Due Date *', key: 'due_date', type: 'datetime-local' }
              ].map(field => (
                <div key={field.key}>
                  <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={taskForm[field.key]} onChange={e => setTaskForm(f => ({ ...f, [field.key]: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}>
                      <option value="" style={{ background: '#1a1a3e' }}>Select…</option>
                      {field.options.map(o => <option key={o.value} value={o.value} style={{ background: '#1a1a3e' }}>{o.label}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={taskForm[field.key]} onChange={e => setTaskForm(f => ({ ...f, [field.key]: e.target.value }))} rows={3} placeholder={field.placeholder}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  ) : (
                    <input type={field.type} value={taskForm[field.key]} onChange={e => setTaskForm(f => ({ ...f, [field.key]: e.target.value }))} placeholder={field.placeholder}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} />
                  )}
                </div>
              ))}
              <button onClick={handleCreateTask} disabled={submitting} style={{
                padding: '13px', background: submitting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
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
          <div onClick={() => setViewPropertyModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '90%', maxWidth: 700, maxHeight: '85vh', overflowY: 'auto', zIndex: 201,
            background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32,
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Property Review: {viewPropertyModal.name}</h3>
              <button onClick={() => setViewPropertyModal(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: 'rgba(255,255,255,0.8)' }}>
              {/* Photo Carousel or Grid */}
              {viewPropertyModal.photos && viewPropertyModal.photos.length > 0 ? (
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Photos</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {viewPropertyModal.photos.map((photoUrl, idx) => (
                      <img key={idx} src={photoUrl} alt={`Property ${idx + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  No photos uploaded for this property
                </div>
              )}

              {/* Main Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>General Info</p>
                  <p style={{ fontSize: 13 }}><strong>Code:</strong> {viewPropertyModal.property_code}</p>
                  <p style={{ fontSize: 13 }}><strong>Type:</strong> {viewPropertyModal.type}</p>
                  <p style={{ fontSize: 13 }}><strong>Floors:</strong> {viewPropertyModal.num_floors || 1}</p>
                  <p style={{ fontSize: 13 }}><strong>Year Built:</strong> {viewPropertyModal.year_built || '—'}</p>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Address</p>
                  <p style={{ fontSize: 13 }}><strong>Street:</strong> {viewPropertyModal.address?.street || '—'}</p>
                  <p style={{ fontSize: 13 }}><strong>Area:</strong> {viewPropertyModal.address?.area}</p>
                  <p style={{ fontSize: 13 }}><strong>City:</strong> {viewPropertyModal.address?.city}</p>
                  <p style={{ fontSize: 13 }}><strong>County:</strong> {viewPropertyModal.address?.county}</p>
                </div>
              </div>

              {/* Description */}
              {viewPropertyModal.description && (
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Description</p>
                  <p style={{ fontSize: 13, lineHeight: '1.6', background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>{viewPropertyModal.description}</p>
                </div>
              )}

              {/* Units List */}
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Units Configured</p>
                <div style={{ maxHeight: 200, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  {viewPropertyModal.units && viewPropertyModal.units.map((unit, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: idx < viewPropertyModal.units.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Unit {unit.unit_number} ({unit.type})</span>
                      <span style={{ fontSize: 13, color: '#34d399', fontWeight: 700 }}>{FMT_KES(unit.rent_kes)}</span>
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
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        select option { background: #1a1a3e; }
      `}</style>
    </div>
  );
}
