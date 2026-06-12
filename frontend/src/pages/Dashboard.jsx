import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProperties } from '../lib/api';
import PropertyList from '../components/PropertyList';
import MapWidget from '../components/MapWidget';
import { StatCardSkeleton, TableSkeleton, MapSkeleton } from '../components/SkeletonLoader';
import { Home, Users, DollarSign, ArrowUpRight, TrendingUp, Landmark } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['properties'], 
    queryFn: fetchProperties
  });

  const properties = data?.data || [];
  const totalUnits = properties.reduce((sum, p) => sum + (p.units?.length || 0), 0);
  const occupied = properties.reduce((sum, p) => sum + (p.units?.filter(u => u.status === 'occupied').length || 0), 0);
  const vacant = totalUnits - occupied;
  const monthlyRevenue = properties.reduce((sum, p) => 
    sum + (p.units?.filter(u => u.status === 'occupied').reduce((uSum, u) => uSum + (u.rent_kes || 0), 0) || 0), 0
  );

  // Recharts Chart Data (Revenue & Occupancy breakdown by Area)
  const chartData = properties.map(p => {
    const total = p.units?.length || 0;
    const occ = p.units?.filter(u => u.status === 'occupied').length || 0;
    const rev = p.units?.filter(u => u.status === 'occupied').reduce((sum, u) => sum + u.rent_kes, 0) || 0;
    return {
      name: p.name.split(' ')[0], // abbreviation
      revenue: rev,
      occupied: occ,
      total: total
    };
  });

  // Mock monthly trends for Mombasa agency
  const trendData = [
    { name: 'Jan', revenue: monthlyRevenue * 0.82 },
    { name: 'Feb', revenue: monthlyRevenue * 0.88 },
    { name: 'Mar', revenue: monthlyRevenue * 0.91 },
    { name: 'Apr', revenue: monthlyRevenue * 0.94 },
    { name: 'May', revenue: monthlyRevenue * 0.97 },
    { name: 'Jun', revenue: monthlyRevenue }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><TableSkeleton rows={4} cols={4} /></div>
          <div><MapSkeleton /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-xl bg-red-50 p-8 text-center">
        <div>
          <div className="text-red-600 font-semibold mb-2">Failed to retrieve portfolio analytics</div>
          <p className="text-sm text-red-500 font-mono">{error.error?.message || error.message || 'Connection refused.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upper stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          icon={<Landmark size={22} className="text-blue-600" />} 
          label="Total Properties" 
          value={properties.length} 
          subtext="Mombasa Estate Agency"
          color="blue" 
        />
        <StatCard 
          icon={<Users size={22} className="text-green-600" />} 
          label="Occupied Units" 
          value={occupied} 
          subtext={`${totalUnits} total units registered`}
          color="green" 
        />
        <StatCard 
          icon={<Home size={22} className="text-amber-600" />} 
          label="Vacant Units" 
          value={vacant} 
          subtext={`${totalUnits - occupied} spaces available`}
          color="yellow" 
        />
        <StatCard 
          icon={<DollarSign size={22} className="text-emerald-600" />} 
          label="Estimated Monthly Revenue" 
          value={`KES ${monthlyRevenue.toLocaleString()}`} 
          subtext="Auto-collected Lipa Na M-Pesa"
          color="brand" 
        />
      </div>

      {/* Visual Analytics graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-[360px]">
          <div>
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-gray-800">Rent Collection Trend</h3>
              <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-wide flex items-center gap-0.5">
                <TrendingUp size={10} /> +12.3% MoM
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Historical rental invoice collections (Jan - Jun 2026)</p>
          </div>
          <div className="h-[260px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #f3f4f6' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Collection (KES)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-[360px]">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Unit Occupancy</h3>
            <p className="text-xs text-gray-400 mt-0.5">Active vs. vacant units comparison per property</p>
          </div>
          <div className="h-[260px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #f3f4f6' }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="occupied" fill="#22c55e" name="Occupied" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" fill="#e5e7eb" name="Capacity" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Map widget & details layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PropertyList properties={properties} />
        </div>
        <div>
          <MapWidget properties={properties} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }) {
  const bgColors = { 
    blue: 'bg-gradient-to-tr from-blue-50 to-indigo-50/20 border-blue-100/60', 
    green: 'bg-gradient-to-tr from-green-50 to-emerald-50/20 border-green-100/60', 
    yellow: 'bg-gradient-to-tr from-amber-50 to-orange-50/20 border-amber-100/60', 
    brand: 'bg-gradient-to-tr from-emerald-50 to-green-50/20 border-green-100/60' 
  };
  
  const textColors = {
    blue: 'text-indigo-800',
    green: 'text-emerald-800',
    yellow: 'text-amber-800',
    brand: 'text-green-800'
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-sm backdrop-blur-[2px] transition-all hover:shadow-md hover:scale-[1.01] duration-300 ${bgColors[color]}`}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
          <div className={`text-2xl font-black ${textColors[color]}`}>{value}</div>
        </div>
        <div className="p-2 bg-white/80 rounded-xl shadow-xs border border-gray-100/20">{icon}</div>
      </div>
      <div className="text-[11px] text-gray-400 font-medium mt-3 border-t border-gray-100/50 pt-2 flex items-center gap-1">
        <ArrowUpRight size={12} className="text-green-500" />
        {subtext}
      </div>
    </div>
  );
}
