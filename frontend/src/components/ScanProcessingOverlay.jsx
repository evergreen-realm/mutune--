import React, { useState, useEffect } from 'react';
import { getPropertyScans } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function ScanProcessingOverlay({ propertyId, onComplete }) {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let interval;
    
    const checkStatus = async () => {
      try {
        const data = await getPropertyScans(propertyId);
        // Find if any scan is processing
        const scans = data.scans || [];
        const isProcessing = scans.some(scan => scan.splat_status === 'processing') || data.splat_status === 'processing';
        
        setProcessing(isProcessing);
        
        if (!isProcessing) {
          if (onComplete) onComplete(scans);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling scan status:', err);
      }
    };

    // Check immediately, then every 15s
    checkStatus();
    interval = setInterval(checkStatus, 15000);
    
    return () => clearInterval(interval);
  }, [propertyId, onComplete]);

  if (!processing) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white backdrop-blur-sm">
      <div className="flex flex-col items-center max-w-md p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl">
        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
        <h2 className="text-2xl font-bold mb-2">Stitching 3D World</h2>
        <p className="text-slate-400 text-center mb-6">
          Our AI is processing your photos into a Gaussian Splat. This usually takes 2-3 minutes.
        </p>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
           <div className="absolute top-0 left-0 h-full bg-blue-500 w-1/3 animate-pulse"></div>
        </div>
        <p className="text-sm text-slate-500 mt-4 text-center">You can safely leave this page.<br/>The scan will appear in the 3D Scans section once complete.</p>
      </div>
    </div>
  );
}
