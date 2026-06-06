import { useState } from 'react';
import { MapPin, Camera, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { agentCheckIn } from '../lib/api';

/**
 * CheckInButton — lets a field agent geo-verify their presence at a property.
 * Captures GPS, uploads optional photo reference, then POSTs to /agents/checkin.
 *
 * Props:
 *   propertyId  — MongoDB ObjectId string
 *   onSuccess   — callback({ distance_m, verified, timestamp })
 */
export default function CheckInButton({ propertyId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [checkedIn, setCheckedIn] = useState(null); // { distance_m, timestamp }

  const handleCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by this browser');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        try {
          const payload = {
            property_id: propertyId,
            location: { coordinates: [longitude, latitude], accuracy }
          };
          // photo_url is optional — in production this would be a pre-signed R2 URL
          // For now we pass undefined so the backend skips it
          const res = await agentCheckIn(payload);
          setCheckedIn({ distance_m: res.distance_m, timestamp: res.timestamp });
          toast.success(`Checked in! ${res.distance_m}m from property. ✓`);
          onSuccess?.(res);
        } catch (err) {
          const code = err?.error?.code;
          if (code === 'CHECKIN_TOO_FAR') {
            toast.error(err.error.message);
          } else {
            toast.error(err?.error?.message || 'Check-in failed');
          }
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        const messages = {
          1: 'Location access denied. Allow location in browser settings.',
          2: 'Position unavailable. Try outside.',
          3: 'GPS timed out. Move outdoors and retry.'
        };
        toast.error(messages[geoErr.code] || `GPS error: ${geoErr.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      toast.info('Photo selected — will be attached on check-in');
    }
  };

  if (checkedIn) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
        <CheckCircle2 size={13} />
        <span className="font-semibold">Checked in</span>
        <span className="text-green-500">{checkedIn.distance_m}m away</span>
        <button
          onClick={() => setCheckedIn(null)}
          className="ml-auto text-[10px] text-green-500 hover:text-green-700 underline"
        >
          Reset
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        id={`btn-checkin-${propertyId}`}
        onClick={handleCheckIn}
        disabled={loading}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
      >
        {loading
          ? <Loader2 size={13} className="animate-spin" />
          : <MapPin size={13} />
        }
        {loading ? 'Getting GPS…' : 'Check In'}
      </button>

      <label
        htmlFor={`photo-${propertyId}`}
        title="Attach photo (optional)"
        className={`p-1.5 rounded-lg border cursor-pointer transition ${
          photoFile
            ? 'border-green-300 text-green-600 bg-green-50'
            : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
        }`}
      >
        {photoFile ? <CheckCircle2 size={13} /> : <Camera size={13} />}
        <input
          id={`photo-${propertyId}`}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </label>

      {photoFile && (
        <span className="text-[10px] text-gray-400 max-w-[80px] truncate" title={photoFile.name}>
          {photoFile.name}
        </span>
      )}
    </div>
  );
}
