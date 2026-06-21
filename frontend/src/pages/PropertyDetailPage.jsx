import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { toast } from 'react-toastify';
import { 
  Building2, MapPin, Plus, Trash2, Lock, Unlock, 
  UserCheck, Key, Compass, Navigation, Loader2, ArrowLeft,
  Users, CheckCircle2, AlertTriangle, Shield
} from 'lucide-react';
import { 
  fetchProperty, addUnit, deletePropertyUnit, 
  lockPropertyUnit, checkInAgent 
} from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();

  const role = clerkUser?.publicMetadata?.role || 'landlord';
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const isAgent = role === 'agent';
  const canManage = isAdmin || (isAgent && property?.agent_ids?.some(a => a.email === clerkUser?.primaryEmailAddress?.emailAddress));

  // Local state for unit creation form
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitNumber, setUnitNumber] = useState('');
  const [rentKes, setRentKes] = useState('');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  
  // Geolocation check-in state
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkinExpiry, setCheckinExpiry] = useState(null);

  // Fetch single property details
  const { data, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: () => fetchProperty(id)
  });

  const property = data?.data || null;

  // Mutation to add unit
  const addUnitMutation = useMutation({
    mutationFn: (newUnit) => addUnit(id, newUnit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success('Unit added successfully ✓');
      setUnitNumber('');
      setRentKes('');
      setShowAddUnit(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add unit');
    }
  });

  // Mutation to delete unit
  const deleteUnitMutation = useMutation({
    mutationFn: (unitId) => deletePropertyUnit(id, unitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success('Unit deleted successfully ✓');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete unit');
    }
  });

  // Mutation to toggle unit lock status
  const lockUnitMutation = useMutation({
    mutationFn: ({ unitId, action }) => lockPropertyUnit(id, unitId, action),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      toast.success(`Unit digital lock ${variables.action === 'lock' ? 'locked 🔒' : 'unlocked 🔓'} ✓`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Operation failed. Check geolocation requirements.');
    }
  });

  const handleAddUnit = (e) => {
    e.preventDefault();
    if (!unitNumber.trim()) {
      toast.error('Unit number required');
      return;
    }
    if (!rentKes || Number(rentKes) <= 0) {
      toast.error('Valid monthly rent required');
      return;
    }
    addUnitMutation.mutate({
      unit_number: unitNumber.trim(),
      rent_kes: Number(rentKes),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms)
    });
  };

  const handleCheckin = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setCheckinLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const res = await checkInAgent({
            property_id: id,
            location: {
              coordinates: [longitude, latitude],
              accuracy
            }
          });
          
          if (res.success) {
            setIsCheckedIn(true);
            // Expire in 30 minutes
            setCheckinExpiry(new Date(Date.now() + 30 * 60 * 1000));
            toast.success(`Verified check-in! Location within ${res.distance_m}m of entrance ✓`);
          }
        } catch (err) {
          toast.error(err.response?.data?.error?.message || err.message || 'Check-in failed');
        } finally {
          setCheckinLoading(false);
        }
      },
      (err) => {
        toast.error(`GPS capture failed: ${err.message}. Move outdoors for better accuracy.`);
        setCheckinLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleLockToggle = (unitId, currentStatus) => {
    const action = currentStatus === 'locked' ? 'unlock' : 'lock';
    
    // For agents, prompt checkin if they haven't verified or session expired
    if (isAgent && (!isCheckedIn || new Date() > checkinExpiry)) {
      toast.warning('Agent check-in verification required. Tap "Check In to Property" first.');
      return;
    }
    
    lockUnitMutation.mutate({ unitId, action });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-xl bg-red-50 p-8 text-center">
        <div>
          <AlertTriangle className="text-red-500 w-8 h-8 mx-auto mb-2" />
          <div className="text-red-600 font-semibold mb-1">Failed to retrieve property details</div>
          <p className="text-sm text-red-500 font-mono">{error?.error?.message || error?.message || 'Access Denied.'}</p>
          <button onClick={() => navigate('/properties')} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Back link */}
      <button 
        onClick={() => navigate('/properties')}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors font-semibold"
      >
        <ArrowLeft size={14} /> Back to Directory
      </button>

      {/* Property Details Banner */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded">
              {property.property_code}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded capitalize">
              {property.type.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">{property.name}</h1>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={13} className="text-red-500" />
            {property.address.street}, {property.address.area}, {property.address.city}
            {property.address.plus_code && (
              <span className="font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded text-xs">
                Plus Code: {property.address.plus_code}
              </span>
            )}
          </p>
        </div>

        {/* Check-in Actions for Agent/Admin */}
        {(isAgent || isAdmin) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {isCheckedIn && new Date() < checkinExpiry ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <div>
                  <p>Verified On-Site Check-in</p>
                  <p className="text-xs text-emerald-600 font-normal">
                    Expires: {checkinExpiry.toLocaleTimeString()} ({Math.round((checkinExpiry - Date.now()) / 60000)}m left)
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleCheckin}
                disabled={checkinLoading}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition duration-200 disabled:opacity-50 shadow-sm shadow-green-200"
              >
                {checkinLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Compass size={14} />
                )}
                Check In to Property
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid: Units List and Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Assigned Units</h3>
                <p className="text-xs text-gray-400">Lock, occupancy, and lease actions for units.</p>
              </div>
              {canManage && (
                <button
                  onClick={() => setShowAddUnit(!showAddUnit)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold transition hover:bg-slate-800"
                >
                  <Plus size={14} /> Add Unit
                </button>
              )}
            </div>

            {/* Units Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-gray-50/50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="p-4 pl-6">Unit #</th>
                    <th className="p-4">Rent</th>
                    <th className="p-4">Rooms</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Digital Lock</th>
                    {canManage && <th className="p-4 text-center pr-6">Delete</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {property.units?.map((u) => {
                    const isLocked = u.lock_status === 'locked';
                    return (
                      <tr key={u._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 pl-6 font-bold text-slate-800">{u.unit_number}</td>
                        <td className="p-4 font-semibold text-slate-700">KES {u.rent_kes.toLocaleString()}</td>
                        <td className="p-4 text-xs text-slate-400 font-medium">
                          {u.bedrooms} Bed / {u.bathrooms} Bath
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            u.status === 'occupied' 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {(isAdmin || (isAgent && isCheckedIn && checkinExpiry && new Date() < checkinExpiry)) ? (
                            <button
                              onClick={() => handleLockToggle(u._id, u.lock_status)}
                              disabled={lockUnitMutation.isPending}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                                isLocked
                                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100/50'
                              }`}
                            >
                              {isLocked ? (
                                <><Lock size={12} className="text-red-400" /> Locked</>
                              ) : (
                                <><Unlock size={12} className="text-green-500" /> Unlocked</>
                              )}
                            </button>
                          ) : isAgent ? (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 uppercase">
                              Check-in Required
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">—</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="p-4 text-center pr-6">
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete Unit ${u.unit_number}?`)) {
                                  deleteUnitMutation.mutate(u._id);
                                }
                              }}
                              disabled={u.status === 'occupied'}
                              title={u.status === 'occupied' ? 'Cannot delete occupied unit' : 'Delete unit'}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:hover:text-slate-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!property.units?.length && (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="p-8 text-center text-gray-400 text-xs">
                        No units added to this property yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar panels */}
        <div className="space-y-6">
          {/* Add Unit Panel */}
          {showAddUnit && canManage && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={16} className="text-green-600" /> Add New Unit
              </h3>
              <form onSubmit={handleAddUnit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Number</label>
                  <input
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    placeholder="e.g. 2B"
                    className="w-full bg-slate-50 border border-gray-100 focus:border-green-500 focus:ring-1 focus:ring-green-500 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Monthly Rent (KES)</label>
                  <input
                    type="number"
                    min="1"
                    value={rentKes}
                    onChange={(e) => setRentKes(e.target.value)}
                    placeholder="e.g. 22000"
                    className="w-full bg-slate-50 border border-gray-100 focus:border-green-500 focus:ring-1 focus:ring-green-500 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none transition"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Bedrooms</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-100 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Bathrooms</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-100 text-slate-800 rounded-lg px-3 py-2.5 text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUnit(false)}
                    className="w-1/2 py-2.5 border border-gray-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addUnitMutation.isPending}
                    className="w-1/2 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                  >
                    Create Unit
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Property Info Block */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider">Property Information</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-slate-400">Owner / Landlord</p>
                <p className="font-semibold text-slate-200">{property.landlord_id?.full_name || 'Agency Managed'}</p>
                <p className="text-slate-500 text-xs">{property.landlord_id?.phone || 'No phone'}</p>
              </div>

              <div>
                <p className="text-slate-400">GPS Coordinates</p>
                <p className="font-mono text-slate-300">
                  {property.location?.coordinates[1].toFixed(6)}, {property.location?.coordinates[0].toFixed(6)}
                </p>
                {property.gps_accuracy_m && (
                  <p className="text-slate-500 text-xs">Capture accuracy: {property.gps_accuracy_m.toFixed(1)}m</p>
                )}
              </div>

              <div>
                <p className="text-slate-400">Assigned Agents</p>
                {property.agent_ids?.map((a) => (
                  <div key={a._id} className="font-semibold text-slate-200 mt-1">
                    • {a.full_name} ({a.phone})
                  </div>
                ))}
                {!property.agent_ids?.length && (
                  <p className="text-slate-500 italic">No agents assigned yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
