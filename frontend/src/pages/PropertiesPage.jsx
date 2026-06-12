import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, AlertCircle } from 'lucide-react';
import { fetchProperties } from '../lib/api';
import PropertyList from '../components/PropertyList';
import { TableSkeleton } from '../components/SkeletonLoader';
import { useUser } from '@clerk/clerk-react';

export default function PropertiesPage() {
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();
  const { data, isLoading, error } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties
  });

  const role = clerkUser?.publicMetadata?.role || 'landlord';
  const canAdd = ['admin', 'super_admin', 'agent'].includes(role);

  const properties = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-xl bg-red-50 p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="text-red-500 w-8 h-8" />
          <div className="text-red-600 font-semibold">Failed to retrieve properties directory</div>
          <p className="text-sm text-red-500 font-mono">{error.error?.message || error.message || 'Connection refused.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Building2 className="text-green-600" size={24} /> Properties Directory
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage real estate assets, view locations and review occupancy metrics.
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => navigate('/properties/add')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition duration-200 shadow-lg shadow-green-900/10"
          >
            <Plus size={16} /> Add Property
          </button>
        )}
      </div>

      <PropertyList properties={properties} />
    </div>
  );
}
