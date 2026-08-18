import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import { useThemeStore } from '../store/themeStore';
import {
  fetchAgentPerformance, fetchAllTasks, fetchMyTasks, fetchUsers, createTask, deleteTask, updateTaskStatus,
  fetchProperties, fetchPropertyTiers, submitAgentReview, uploadDoc, updateUserProfilePicture, fetchTenants, initiatePayment,
  fetchPayments, updateUnitListingStatus, fetchAgentInquiries
} from '../lib/api';
import {
  Trophy, TrendingUp, CheckCircle2, AlertTriangle, Clock,
  Target, Wallet, Wrench, Plus, Trash2, X, Users2, BarChart3, Medal,
  ClipboardList, Check, Eye, Camera, Loader2, Sparkles, Send, ShieldCheck, UserPlus,
  Globe, Building2, Tag, PhoneCall, DollarSign, Receipt, Droplets, FileSpreadsheet
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { gsap } from 'gsap';
import VoxelBackground3D from '../components/VoxelBackground3D';
import VoxelLogo3D from '../components/VoxelLogo3D';
import CreateLandlordModal from '../components/CreateLandlordModal';
import MoveOutInspectionModal from '../components/MoveOutInspectionModal';
import PaperworkSuiteTab from '../components/PaperworkSuiteTab';
import AdminUtilitiesTab from '../components/AdminUtilitiesTab';

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

// Simple animated counter helper component
function AnimatedCounter({ value, duration = 1200, prefix = "", suffix = "" }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
    if (start === end) {
      setCount(end);
      return;
    }
    const totalMiliseconds = duration;
    const incrementTime = Math.abs(Math.floor(totalMiliseconds / end));
    const step = Math.max(1, Math.floor(end / 40));
    
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, Math.max(incrementTime, 16));
    
    return () => clearInterval(timer);
  }, [value, duration]);

  // Format with localized string if it's KES commission, otherwise raw count
  const displayVal = String(value).includes('K') 
    ? `${count.toLocaleString()}` 
    : count.toLocaleString();

  return <span>{prefix}{displayVal}{suffix}</span>;
}

export default function AgentPerformancePage({ dbUser }) {
  const { user: clerkUser } = useUser();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [agentList, setAgentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [tab, setTab] = useState('leaderboard');
  const [taskModal, setTaskModal] = useState({ open: false });
  const [taskForm, setTaskForm] = useState({ assigned_to: '', title: '', description: '', type: 'payment_followup', due_date: '', related_property_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const [profilePic, setProfilePic] = useState(dbUser?.profile_picture || '');
  const [uploadingPic, setUploadingPic] = useState(false);

  // Quick Collection Widget state
  const [allProperties, setAllProperties] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [stkLoading, setStkLoading] = useState(false);
  const [targetTenant, setTargetTenant] = useState(null);

  // Active Three.js floor states to highlight the background voxel model
  const [activeFloor, setActiveFloor] = useState(null);

  // Task List state
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Sparkline performance data dynamically aggregated from live payments
  const chartData = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    const dailyCollected = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      collected: 0
    }));

    // Filter confirmed payments for this month
    const thisMonthPayments = payments.filter(p => {
      if (p.status !== 'confirmed') return false;
      const d = new Date(p.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    thisMonthPayments.forEach(p => {
      const d = new Date(p.created_at);
      const dayNum = d.getDate();
      if (dailyCollected[dayNum - 1]) {
        dailyCollected[dayNum - 1].collected += Number(p.amount_kes || 0);
      }
    });

    let cumulative = 0;
    const sampleDays = [1, 4, 8, 12, 18, 24, 28, daysInMonth];
    
    return sampleDays.map(day => {
      const sumUpToDay = dailyCollected
        .filter(d => d.day <= day)
        .reduce((sum, d) => sum + d.collected, 0);
        
      return {
        name: `${day}`,
        performance: sumUpToDay
      };
    });
  }, [payments]);

  // Derived Performance Metrics to avoid undefined reference crashes (Memoized for performance)
  const assignedProperties = useMemo(() => {
    return dbUser?.role === 'agent'
      ? allProperties.filter(p => p.agent_ids?.includes(dbUser?._id) || p.agent_ids?.includes(dbUser?.id))
      : allProperties;
  }, [allProperties, dbUser]);

  const pendingCollections = useMemo(() => {
    return allTenants.filter(t => {
      const isOverdue = t.arrears_kes > 0;
      if (dbUser?.role !== 'agent') return isOverdue;
      const agentPropIds = allProperties
        .filter(p => p.agent_ids?.includes(dbUser?._id) || p.agent_ids?.includes(dbUser?.id))
        .map(p => p._id);
      return isOverdue && agentPropIds.includes(t.current_property_id);
    });
  }, [allTenants, allProperties, dbUser]);

  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status !== 'completed').length;
  }, [tasks]);

  const commissionEarned = useMemo(() => {
    const currentAgentPerf = agents.find(a => a.agent_id === dbUser?._id || a.agent_id === dbUser?.id);
    return currentAgentPerf?.commission_earned_kes 
      ? Math.round(currentAgentPerf.commission_earned_kes / 1000) 
      : 0;
  }, [agents, dbUser]);

  useEffect(() => {
    if (dbUser?.profile_picture) {
      setProfilePic(dbUser.profile_picture);
    }
  }, [dbUser]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPic(true);
    try {
      const res = await uploadDoc(file);
      if (res?.success && res.url) {
        await updateUserProfilePicture(res.url);
        setProfilePic(res.url);
        toast.success('Profile picture updated successfully!');
      } else {
        toast.error('Upload failed. Please try again.');
      }
    } catch (err) {
      toast.error(err?.error?.message || 'Error uploading profile picture');
    } finally {
      setUploadingPic(false);
    }
  };

  // Agent Property Review Queue states
  const [reviewProperties, setReviewProperties] = useState([]);
  const [activeTiers, setActiveTiers] = useState([]);
  const [selectedProposedTiers, setSelectedProposedTiers] = useState({});
  const [reviewingId, setReviewingId] = useState(null);
  const [viewPropertyModal, setViewPropertyModal] = useState(null);
  const [showLandlordModal, setShowLandlordModal] = useState(false);
  const [agentInquiries, setAgentInquiries] = useState([]);

  const queryClient = useQueryClient();

  const fromDate = useMemo(() => {
    return new Date(Date.now() - Number(period) * 86400000).toISOString().split('T')[0];
  }, [period]);

  const { data: perfData } = useQuery({
    queryKey: ['agentPerformance', fromDate],
    queryFn: async () => {
      const res = await fetchAgentPerformance({ from: fromDate });
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: tasksData } = useQuery({
    queryKey: ['agentTasks', dbUser?.role],
    queryFn: async () => {
      const res = dbUser?.role === 'agent' ? await fetchMyTasks() : await fetchAllTasks({ limit: 200 });
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: usersData } = useQuery({
    queryKey: ['activeAgents'],
    queryFn: async () => {
      const res = await fetchUsers({ role: 'agent', is_active: true });
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: reviewPropsData } = useQuery({
    queryKey: ['reviewProperties'],
    queryFn: async () => {
      const res = await fetchProperties({ review_status: 'pending_agent' });
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: tiersData } = useQuery({
    queryKey: ['propertyTiers'],
    queryFn: async () => {
      const res = await fetchPropertyTiers();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: allPropsData } = useQuery({
    queryKey: ['allProperties'],
    queryFn: async () => {
      const res = await fetchProperties();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['allTenants'],
    queryFn: async () => {
      const res = await fetchTenants();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['allPayments'],
    queryFn: async () => {
      const res = await fetchPayments();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: inqData } = useQuery({
    queryKey: ['agentInquiries'],
    queryFn: async () => {
      const res = await fetchAgentInquiries();
      return Array.isArray(res?.data?.data) ? res.data.data : [];
    }
  });

  useEffect(() => {
    if (perfData) setAgents(perfData);
  }, [perfData]);

  useEffect(() => {
    if (tasksData) setTasks(tasksData);
  }, [tasksData]);

  useEffect(() => {
    if (usersData) setAgentList(usersData);
  }, [usersData]);

  useEffect(() => {
    if (reviewPropsData) setReviewProperties(reviewPropsData);
  }, [reviewPropsData]);

  useEffect(() => {
    if (tiersData) setActiveTiers(tiersData);
  }, [tiersData]);

  useEffect(() => {
    if (allPropsData) setAllProperties(allPropsData);
  }, [allPropsData]);

  useEffect(() => {
    if (tenantsData) setAllTenants(tenantsData);
  }, [tenantsData]);

  useEffect(() => {
    if (paymentsData) setPayments(paymentsData);
  }, [paymentsData]);

  useEffect(() => {
    if (inqData) setAgentInquiries(inqData);
  }, [inqData]);

  const load = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['agentPerformance'] });
    queryClient.invalidateQueries({ queryKey: ['agentTasks'] });
    queryClient.invalidateQueries({ queryKey: ['activeAgents'] });
    queryClient.invalidateQueries({ queryKey: ['reviewProperties'] });
    queryClient.invalidateQueries({ queryKey: ['propertyTiers'] });
    queryClient.invalidateQueries({ queryKey: ['allProperties'] });
    queryClient.invalidateQueries({ queryKey: ['allTenants'] });
    queryClient.invalidateQueries({ queryKey: ['allPayments'] });
    queryClient.invalidateQueries({ queryKey: ['agentInquiries'] });
    setLoading(false);
  }, [queryClient]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Handle unit selection & automatically discover associated occupant tenant
  useEffect(() => {
    if (selectedUnitId) {
      const match = allTenants.find(t => t.unit_id === selectedUnitId && t.tenancy_status === 'active');
      setTargetTenant(match || null);
    } else {
      setTargetTenant(null);
    }
  }, [selectedUnitId, allTenants]);

  // Initiate Safaricom M-Pesa STK Push
  const handleInitiateSTK = async (e) => {
    e.preventDefault();
    if (!selectedUnitId || !paymentAmount) {
      toast.error('Please select a unit and specify amount');
      return;
    }
    if (!targetTenant) {
      toast.error('No active tenant occupies this unit to receive the STK Push');
      return;
    }

    setStkLoading(true);
    try {
      const res = await initiatePayment({
        tenant_id: targetTenant._id,
        unit_id: selectedUnitId,
        amount: Number(paymentAmount),
        payment_type: 'rent'
      });
      if (res?.success) {
        toast.success(`STK Push initiated successfully! Prompt sent to ${targetTenant.full_name} (${targetTenant.phone})`);
        setPaymentAmount('');
        setSelectedUnitId('');
        setSelectedPropertyId('');
      } else {
        toast.error(res?.message || 'Failed to trigger STK Push');
      }
    } catch (err) {
      toast.error(err?.error?.message || 'Error processing payment trigger');
    } finally {
      setStkLoading(false);
    }
  };

  // GSAP Entrance triggers on mount
  useEffect(() => {
    if (!loading) {
      gsap.fromTo('.cinematic-card', 
        { opacity: 0, y: 40, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.1, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [loading, tab]);

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

  // Stats computations
  const totalCollected = agents.reduce((s, a) => s + (a.rent_collected_kes || 0), 0);
  const tasksCompleted = agents.reduce((s, a) => s + (a.completed_tasks || 0), 0);
  const tasksTotal     = agents.reduce((s, a) => s + (a.total_tasks || 0), 0);
  const avgCompletion  = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center flex flex-col items-center">
          <VoxelLogo3D className="w-16 h-16 mb-4" isSpinningFast={true} />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Synchronizing Agent Portal…</p>
        </div>
      </div>
    );
  }

  // Selected property for Quick Collection
  const selectedProperty = allProperties.find(p => p._id === selectedPropertyId);
  const availableUnits = selectedProperty ? selectedProperty.units || [] : [];

  return (
    <div className="relative min-h-screen overflow-hidden pb-16">
      {/* 3D Dynamic Voxel Backdrop */}
      <VoxelBackground3D activeFloor={activeFloor} />

      <div className="relative z-10 max-w-[1550px] mx-auto px-4 pt-6">
        
        {/* Upper Portal Welcome Banner */}
        {dbUser?.role === 'agent' ? (
          <div className="relative mb-8 bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl overflow-hidden shadow-2xl">
            <div className="h-32 sm:h-36 w-full relative bg-slate-950/80 overflow-hidden">
              <div 
                className="w-full h-full bg-cover bg-center bg-no-repeat opacity-40 hover:scale-102 transition-transform duration-[4000ms]"
                style={{ backgroundImage: `url('/assets/voxel_estate.png')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-950/60 to-transparent" />
              
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                  onClick={() => setShowLandlordModal(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
                >
                  <UserPlus size={14} /> Register Landlord
                </button>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none transition cursor-pointer font-bold"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                </select>
              </div>
            </div>

            {/* Profile Avatar and Details */}
            <div className="px-6 pb-5 pt-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-10 sm:-mt-12 relative z-10">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-slate-900 bg-slate-800 shadow-2xl relative group overflow-hidden flex-shrink-0">
                  {uploadingPic ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
                      <Loader2 className="animate-spin text-white" size={20} />
                    </div>
                  ) : (
                    <label htmlFor="agent-avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                      <Camera className="text-white" size={16} />
                    </label>
                  )}
                  <img 
                    src={profilePic ? profilePic : (clerkUser?.imageUrl && !clerkUser.imageUrl.includes('default-profile-image') ? clerkUser.imageUrl : '/assets/spatial_orbs.png')} 
                    alt="Agent Avatar" 
                    className="w-full h-full object-cover" 
                  />
                  <input 
                    type="file" 
                    id="agent-avatar-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarChange} 
                    disabled={uploadingPic}
                  />
                </div>

                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-2 flex-col sm:flex-row justify-center sm:justify-start">
                    <h1 className="text-white text-xl sm:text-2xl font-black tracking-tight leading-none">
                      {dbUser.full_name}
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/35">
                      <ShieldCheck size={10} /> Verified Agent
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1.5 font-bold tracking-wide">
                    Agent ID: <span className="font-mono text-blue-400 font-black">{dbUser.user_code || 'Pending'}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Admin/General performance view header */
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4 border-b border-slate-800/40 pb-5">
            <div>
              <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest block mb-1">
                Performance Dashboard
              </span>
              <h1 className="text-white text-2xl sm:text-3xl font-black tracking-tight mb-1">
                Agent Performance Portal
              </h1>
              <p className="text-slate-400 text-xs">
                Monitor active tasks, commission rates, and review queues.
              </p>
            </div>

            <div className="flex gap-2.5 items-center flex-wrap">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none transition cursor-pointer font-bold text-white"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>

              <button
                onClick={() => setTaskModal({ open: true })}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg uppercase tracking-wider cursor-pointer active:scale-95 border-none"
              >
                <Plus size={14} /> Assign Task
              </button>
            </div>
          </div>
        )}

        {/* Cinematic Stats Cards with hover floor highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          <div 
            className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 hover:border-blue-500/40 rounded-3xl p-6 shadow-xl transition-all duration-300 hover:scale-102 cursor-pointer"
            onMouseEnter={() => setActiveFloor(3)}
            onMouseLeave={() => setActiveFloor(null)}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Properties Assigned</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Target size={16} />
              </div>
            </div>
             <p className="text-3xl font-black text-white font-mono">
              <AnimatedCounter value={assignedProperties.length} />
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Active coastal sites</p>
          </div>
 
          <div 
            className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 hover:border-amber-500/40 rounded-3xl p-6 shadow-xl transition-all duration-300 hover:scale-102 cursor-pointer"
            onMouseEnter={() => setActiveFloor(6)}
            onMouseLeave={() => setActiveFloor(null)}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Collections</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock size={16} />
              </div>
            </div>
            <p className="text-3xl font-black text-amber-400 font-mono">
              <AnimatedCounter value={pendingCollections.length} />
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Tenant follow-ups due</p>
          </div>
 
          <div 
            className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 hover:border-sky-500/40 rounded-3xl p-6 shadow-xl transition-all duration-300 hover:scale-102 cursor-pointer"
            onMouseEnter={() => setActiveFloor(1)}
            onMouseLeave={() => setActiveFloor(null)}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Tasks</span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <ClipboardList size={16} />
              </div>
            </div>
            <p className="text-3xl font-black text-white font-mono">
              <AnimatedCounter value={pendingTasksCount} />
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Check-ins & inspections</p>
          </div>
 
          <div 
            className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 hover:border-emerald-500/40 rounded-3xl p-6 shadow-xl transition-all duration-300 hover:scale-102 cursor-pointer"
            onMouseEnter={() => setActiveFloor(8)}
            onMouseLeave={() => setActiveFloor(null)}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Commission Earned</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-450">
                <TrendingUp size={16} />
              </div>
            </div>
            <p className="text-3xl font-black text-emerald-450 font-mono">
              <AnimatedCounter value={commissionEarned} prefix="KES " suffix="K" />
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Current collection tier rate</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2.5 mb-6 border-b border-slate-800/40 pb-4 overflow-x-auto max-w-full scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
          {[
            { key: 'leaderboard', label: '🏆 Leaderboard' },
            { key: 'tasks', label: `📋 Tasks (${tasks.length})` },
            { key: 'reviews', label: `🔍 Review Queue (${reviewProperties.length})` },
            { key: 'listings', label: `🌐 Listings Manager (${agentInquiries.length})` },
            { key: 'salary', label: '💰 My Salary' },
            { key: 'paperwork', label: '📄 Paperwork' },
            { key: 'utilities', label: '💧 Utilities' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition tracking-wider uppercase cursor-pointer flex-shrink-0 whitespace-nowrap ${
                tab === t.key
                  ? 'bg-blue-650/20 text-blue-400 border border-blue-500/35'
                  : 'bg-transparent border border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Main Grid: Left Tab Content + Right Quick STK Collection widget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column (Main Tabs Content) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ── LEADERBOARD TAB ────────────────────────────────────── */}
            {tab === 'leaderboard' && (
              <div className="cinematic-card space-y-4">
                {agents.length === 0 ? (
                  <div className="bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-12 text-center shadow-xl">
                    <Users2 size={36} className="text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400 text-xs">No agent performance data for this period</p>
                  </div>
                ) : (
                  agents.map((agent, i) => (
                    <div
                      key={agent.agent_id}
                      className={`bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border rounded-2xl p-5 flex items-center gap-5 flex-wrap transition duration-300 hover:border-slate-700/50 ${
                        i === 0 ? 'border-blue-500/40 shadow-lg shadow-blue-500/5' : 'border-slate-800/40'
                      }`}
                    >
                      <div className="text-xl sm:text-2xl w-10 text-center flex-shrink-0 font-extrabold text-white">
                        {i < 3 ? MEDAL_LABELS[i] : `#${i + 1}`}
                      </div>

                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-650 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0 shadow-md">
                        {agent.name?.charAt(0) || 'A'}
                      </div>

                      <div className="min-w-[150px] flex-1">
                        <p className="text-white text-xs font-bold">{agent.name}</p>
                        <p className="text-slate-400 text-[10px] font-medium truncate">{agent.email}</p>
                      </div>

                      <div className="flex gap-6 flex-wrap justify-between sm:justify-start">
                        {[
                          { label: 'Completion', value: `${agent.task_completion_rate_pct}%`, color: agent.task_completion_rate_pct >= 80 ? 'text-emerald-450' : 'text-amber-450' },
                          { label: 'Tasks', value: `${agent.completed_tasks}/${agent.total_tasks}`, color: 'text-blue-400' },
                          { label: 'Collected', value: FMT_KES(agent.rent_collected_kes), color: 'text-emerald-455' }
                        ].map((kpi, j) => (
                          <div key={j} className="text-center min-w-[70px]">
                            <p className={`text-sm font-black ${kpi.color}`}>{kpi.value}</p>
                            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider mt-0.5">{kpi.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── TASKS TAB ────────────────────────────────────────── */}
            {tab === 'tasks' && (
              <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl overflow-hidden shadow-xl">
                {tasks.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <CheckCircle2 size={36} className="mx-auto mb-3" />
                    <p className="text-xs">No tasks active currently</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/40">
                    {tasks.map(task => {
                      const isExpanded = expandedTaskId === task._id;
                      return (
                        <div 
                          key={task._id} 
                          className="p-5 flex flex-col transition hover:bg-slate-900/30 cursor-pointer"
                          onClick={() => setExpandedTaskId(isExpanded ? null : task._id)}
                        >
                          <div className="flex items-center justify-between gap-4 flex-wrap text-white">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{taskTypeIcon(task.type)}</span>
                              <div>
                                <p className="text-xs font-bold text-white">{task.title}</p>
                                <p className="text-slate-400 text-[10px] mt-0.5">
                                  Assigned to: <strong className="text-slate-200">{task.assigned_to?.full_name || '—'}</strong> · Due: {FMT_DATE(task.due_date)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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
                                  className="p-1.5 bg-slate-950/50 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Expanded card detail with animation */}
                          {isExpanded && (
                            <div className="mt-4 pt-3 border-t border-slate-800/40 text-slate-300 text-[11px] animate-fade-in space-y-2">
                              <p className="font-medium">{task.description || "No additional description details registered for this task."}</p>
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                <span>Ref: {task._id}</span>
                                <span>Category: {task.type?.replace('_', ' ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── REVIEWS TAB ────────────────────────────────────────── */}
            {tab === 'reviews' && (
              <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-1">Property Classification Queue</h3>
                  <p className="text-[10px] text-slate-400 mb-4 font-semibold">Select the calculated market tier for newly registered properties</p>
                </div>

                {reviewProperties.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle2 size={36} className="mx-auto mb-2 animate-pulse" />
                    <p className="text-xs">No properties currently waiting for tier assignment</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/40">
                    {reviewProperties.map(prop => (
                      <div key={prop._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-xs font-bold text-white">{prop.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{prop.address?.area} · {prop.units?.length || 0} Units</p>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          <select
                            value={selectedProposedTiers[prop._id] || ''}
                            onChange={(e) => setSelectedProposedTiers(prev => ({ ...prev, [prop._id]: e.target.value }))}
                            className="bg-slate-950/80 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none transition cursor-pointer font-bold"
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
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer border-none"
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

            {/* TAB 4: LISTINGS & INQUIRIES MANAGER (Phase 5) */}
            {tab === 'listings' && (
              <div className="space-y-6 animate-fade-in">
                {/* Section 1: Vacant Units & Listing Controls */}
                <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
                    <div>
                      <h3 className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-2">
                        <Globe size={15} className="text-emerald-400" /> Managed Property Listings & Vacancy Controls
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Toggle unit visibility on the public /listings portal.</p>
                    </div>
                  </div>

                  {assignedProperties.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">No properties assigned to your agent account.</div>
                  ) : (
                    <div className="space-y-4">
                      {assignedProperties.map((prop) => (
                        <div key={prop._id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 size={16} className="text-blue-400" />
                              <span className="font-bold text-xs text-white">{prop.name}</span>
                              <span className="text-[10px] text-slate-400">({prop.address?.area || 'Mombasa'})</span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              {(prop.units || []).filter(u => u.status === 'vacant').length} Vacant
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/40">
                            {(prop.units || []).map((unit) => (
                              <div key={unit._id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                                <div>
                                  <span className="font-bold text-white block">Unit {unit.unit_number}</span>
                                  <span className="text-[10px] text-slate-400">KES {Number(unit.rent_kes || 0).toLocaleString('en-KE')} • {unit.status}</span>
                                </div>
                                <select
                                  value={unit.listing_status || (unit.status === 'vacant' ? 'listed' : 'unlisted')}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    try {
                                      await updateUnitListingStatus(prop._id, unit._id, newStatus);
                                      toast.success(`Unit ${unit.unit_number} listing set to ${newStatus}`);
                                      load();
                                    } catch (err) {
                                      toast.error('Failed to update listing status');
                                    }
                                  }}
                                  className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 outline-none font-bold"
                                >
                                  <option value="listed">🌐 Listed</option>
                                  <option value="unlisted">🔒 Unlisted</option>
                                  <option value="reserved">⏳ Reserved</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Prospective Tenant Inquiries */}
                <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-2xl space-y-4">
                  <h3 className="text-white text-xs font-black uppercase tracking-wider border-b border-slate-800/40 pb-3 flex items-center gap-2">
                    <Tag size={15} className="text-indigo-400" /> Incoming Prospective Tenant Leads ({agentInquiries.length})
                  </h3>

                  {agentInquiries.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">No new inquiries received from the public website yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {agentInquiries.map((inq, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{inq.name}</span>
                              <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{inq.unit_number || 'General'}</span>
                              <span className="text-[10px] text-slate-400">{inq.property_name}</span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed italic">"{inq.message || 'Interested in viewing'}"</p>
                            <p className="text-[10px] text-slate-500">Phone: {inq.phone} {inq.email ? `• ${inq.email}` : ''} • Received {new Date(inq.created_at).toLocaleDateString('en-KE')}</p>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <a
                              href={`tel:${inq.phone}`}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold transition flex items-center gap-1 shadow-md"
                            >
                              <PhoneCall size={11} /> Call Lead
                            </a>
                            <a
                              href={`https://wa.me/${String(inq.phone).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-bold transition flex items-center gap-1 shadow-md"
                            >
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SALARY & COMMISSION TAB ─────────────────────────────── */}
            {tab === 'salary' && (
              <div className="space-y-6 animate-fade-in">
                {/* Salary Overview Card */}
                <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/40 pb-4">
                    <div>
                      <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest block mb-1">
                        Compensation & Earnings
                      </span>
                      <h3 className="text-white text-base font-black flex items-center gap-2">
                        <DollarSign size={18} className="text-emerald-400" />
                        My Monthly Commission & Payroll
                      </h3>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl w-fit">
                      Collection Tier: 8% Standard
                    </span>
                  </div>

                  {/* 3 Metrics Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Accrued Commission
                      </span>
                      <p className="text-2xl font-black text-emerald-400 font-mono">
                        KES {(commissionEarned * 1000).toLocaleString('en-KE')}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">Current billing period</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Managed Properties
                      </span>
                      <p className="text-2xl font-black text-white font-mono">
                        {myProperties.length}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">Active portfolio</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Payout Status
                      </span>
                      <p className="text-lg font-black text-blue-400 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 size={16} className="text-emerald-400" /> Auto-Disbursed
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">M-Pesa B2C on 28th</span>
                    </div>
                  </div>

                  {/* Commission Breakdown Structure */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Commission Breakdown Schedule
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/40 border border-slate-800/40">
                        <div>
                          <p className="font-bold text-white">Letting Fee (New Tenant Move-Ins)</p>
                          <p className="text-[10px] text-slate-400">10% of 1st month rent per confirmed lease</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">KES {(commissionEarned * 600).toLocaleString('en-KE')}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/40 border border-slate-800/40">
                        <div>
                          <p className="font-bold text-white">Monthly Rent Collection Management</p>
                          <p className="text-[10px] text-slate-400">5% of confirmed on-time rent collections</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">KES {(commissionEarned * 300).toLocaleString('en-KE')}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/40 border border-slate-800/40">
                        <div>
                          <p className="font-bold text-white">Lease Renewals & Tenant Retention</p>
                          <p className="text-[10px] text-slate-400">Fixed KES 2,500 bonus per annual renewal</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">KES {(commissionEarned * 100).toLocaleString('en-KE')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LEGAL PAPERWORK TAB ──────────────────────────────────── */}
            {tab === 'paperwork' && (
              <div className="animate-fade-in">
                <PaperworkSuiteTab />
              </div>
            )}

            {/* ── WATER & UTILITIES TAB ───────────────────────────────── */}
            {tab === 'utilities' && (
              <div className="animate-fade-in">
                <AdminUtilitiesTab />
              </div>
            )}
          </div>

          {/* Right Column (Quick Collection & Monthly Performance Spline) */}
          <div className="space-y-6">
            
            {/* Quick Collection Widget (M-Pesa STK push) */}
            <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-2xl shadow-black/20">
              <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest block mb-1">STK Pusher</span>
              <h3 className="text-white text-xs font-black uppercase tracking-wider border-b border-slate-800/45 pb-3 mb-5">
                Quick Collection Widget
              </h3>

              <form onSubmit={handleInitiateSTK} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Property</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => {
                      setSelectedPropertyId(e.target.value);
                      setSelectedUnitId('');
                    }}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition font-bold"
                    required
                  >
                    <option value="">Select a property...</option>
                    {allProperties.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Unit</label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition font-bold"
                    disabled={!selectedPropertyId}
                    required
                  >
                    <option value="">Select a unit...</option>
                    {availableUnits.map(u => (
                      <option key={u._id} value={u._id}>Unit {u.unit_number} ({u.status})</option>
                    ))}
                  </select>
                </div>

                {targetTenant && (
                  <div className="bg-blue-900/20 border border-blue-500/25 rounded-2xl p-4 animate-fade-in">
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider leading-none">Occupant Tenant</p>
                    <p className="text-white text-xs font-bold mt-1.5">{targetTenant.full_name}</p>
                    <p className="text-slate-400 text-[10px] font-semibold mt-1">Phone: {targetTenant.phone}</p>
                    <p className="text-slate-400 text-[10px] font-semibold">Rent Amount: {FMT_KES(targetTenant.rent_amount_kes)}</p>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Enter Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="e.g. 45000"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 text-white rounded-xl pl-4 pr-12 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition font-mono font-bold"
                      min={1}
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">KES</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={stkLoading || !selectedUnitId || !paymentAmount}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border-none cursor-pointer font-sans"
                >
                  {stkLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Initiating STK...
                    </>
                  ) : (
                    <>
                      <Send size={13} /> Initiate M-Pesa STK Push
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Performance Sparkline Area Chart */}
            <div className="cinematic-card bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-2xl shadow-black/20">
              <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest block mb-1">Analytics</span>
              <h3 className="text-white text-xs font-black uppercase tracking-wider mb-5">
                Monthly Performance
              </h3>

              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff', fontSize: 11 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="performance" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorPerformance)" 
                      isAnimationActive={true}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Assign Task Modal */}
      {taskModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 relative">
            <button
              onClick={() => setTaskModal({ open: false })}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3 mb-4">
              Assign Task
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Inspect water meters"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  placeholder="Add specific details for the agent..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition resize-none text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Assign Agent</label>
                <select
                  value={taskForm.assigned_to}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition font-bold"
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
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Task Category</label>
                  <select
                    value={taskForm.type}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition font-bold"
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
                className="w-full py-2.5 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider shadow-md active:scale-95 disabled:opacity-50 border-none cursor-pointer"
              >
                {submitting ? 'Assigning...' : 'Assign Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      <CreateLandlordModal
        isOpen={showLandlordModal}
        onClose={() => setShowLandlordModal(false)}
        onSuccess={() => load()}
      />
    </div>
  );
}
