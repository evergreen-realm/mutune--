import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, UploadCloud, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';

// Helper to convert data URL to File
const dataURLtoFile = (dataurl, filename) => {
    var arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
        
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, {type:mime});
};

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const webcamRef = useRef(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentAngle, setCurrentAngle] = useState(0); // Simulate device orientation
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const TOTAL_PHOTOS = 16;
  const ANGLE_STEP = 360 / TOTAL_PHOTOS;
  const FOV = 45; // Simulated FOV angle

  // Simulate gyro rotation for demo purposes (if actual device orientation is not available on desktop)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      // In a real mobile app, this would be hooked to DeviceOrientationEvent
      setCurrentAngle(prev => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleCapture = async () => {
    if (capturedPhotos.length >= TOTAL_PHOTOS) {
      toast.error(`Maximum ${TOTAL_PHOTOS} photos allowed.`);
      return;
    }

    if (!webcamRef.current) return;

    setIsCapturing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Could not capture image from webcam");

      const file = dataURLtoFile(imageSrc, `scan_${Date.now()}.jpg`);
      
      // Zero-latency upload
      const res = await uploadDoc(file);
      if (res?.success && res.url) {
        setCapturedPhotos(prev => [...prev, { url: res.url, angle: currentAngle }]);
        toast.success("Snapshot captured!");
      }
    } catch (err) {
      toast.error('Failed to capture snapshot: ' + err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFinish = async () => {
    if (capturedPhotos.length < TOTAL_PHOTOS) {
      toast.error(`Please capture all ${TOTAL_PHOTOS} photos for a complete 360° scan.`);
      return;
    }
    setIsProcessing(true);
    try {
      // Pass just the urls array to onComplete
      await onComplete(capturedPhotos.map(p => p.url));
      toast.success('360° Scan captured successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to process scan: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Calculate FOV coverage gaps (naive check if we have photos roughly every 45 degrees)
  const coverageSectors = Array.from({ length: 8 }, (_, i) => i * 45); // 0, 45, 90...
  const missingSectors = coverageSectors.filter(sector => 
    !capturedPhotos.some(p => Math.abs(p.angle - sector) < 30 || Math.abs(p.angle - sector - 360) < 30 || Math.abs(p.angle - sector + 360) < 30)
  );
  
  const hasGaps = capturedPhotos.length > 0 && missingSectors.length > 0 && capturedPhotos.length >= (TOTAL_PHOTOS / 2);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[600px]">
        
        {/* Left Side: Live Webcam Feed */}
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 overflow-hidden">
          
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }} // Use back camera if on mobile
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur rounded-full border border-white/10">
            <Camera size={16} className="text-emerald-400" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">
              {capturedPhotos.length} / {TOTAL_PHOTOS} Captured
            </span>
          </div>

          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={onClose}
              className="p-2 bg-black/50 backdrop-blur rounded-full border border-white/10 text-white hover:bg-white/10 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Viewfinder Reticle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative flex flex-col items-center justify-center">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-3xl" />
              
              {/* Pitch/Roll level indicator (simulated) */}
              <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-emerald-400/50" />
              <div className="absolute left-1/2 top-4 bottom-4 w-[1px] bg-emerald-400/50" />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-1 opacity-50">
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            </div>
          </div>
          
          {/* Capture Action */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
             <button
                onClick={handleCapture}
                disabled={isCapturing || capturedPhotos.length >= TOTAL_PHOTOS}
                className="w-16 h-16 rounded-full bg-white/20 border-4 border-white backdrop-blur flex items-center justify-center hover:bg-white/40 active:scale-95 transition disabled:opacity-50"
             >
                {isCapturing ? <RefreshCw className="animate-spin text-white" /> : <div className="w-12 h-12 bg-white rounded-full" />}
             </button>
          </div>
        </div>

        {/* Right Side: Radar & Progress */}
        <div className="w-full md:w-80 bg-slate-900 p-6 flex flex-col">
          
          <div className="mb-8 text-center">
            <h3 className="text-white font-black text-xl mb-2">Live 360° Scan</h3>
            <p className="text-slate-400 text-xs">
              Slowly pan around the room and capture {TOTAL_PHOTOS} frames to build the Gaussian Splat.
            </p>
          </div>

          {/* Radar Visualization */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
            <div className="absolute inset-4 rounded-full border border-slate-800/50" />
            <div className="absolute inset-8 rounded-full bg-slate-800/20" />
            
            {/* Center Node */}
            <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] z-10" />

            {/* Simulated Live FOV Cone */}
            <div 
              className="absolute top-1/2 left-1/2 w-48 h-48 -mt-24 -ml-24 origin-center"
              style={{ 
                transform: `rotate(${currentAngle}deg)`,
              }}
            >
               <div 
                  className="absolute bottom-1/2 left-1/2 w-24 h-24 origin-bottom-left"
                  style={{
                    background: 'conic-gradient(from -22.5deg at bottom left, rgba(59,130,246,0.5) 0deg, rgba(59,130,246,0.5) 45deg, transparent 45deg)',
                  }}
               />
            </div>

            {/* Radar Sweep Line */}
            <div 
              className="absolute top-1/2 left-1/2 w-24 h-1 origin-left bg-gradient-to-r from-blue-500/0 to-blue-500/80"
              style={{ transform: `rotate(${currentAngle}deg)` }}
            />

            {/* Captured Angles */}
            {capturedPhotos.map((p, idx) => {
              const rad = (p.angle) * (Math.PI / 180);
              const r = 96; // radius
              const x = 96 + r * Math.cos(rad);
              const y = 96 + r * Math.sin(rad);
              
              return (
                <div 
                  key={idx}
                  className="absolute w-3 h-3 -mt-1.5 -ml-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-20"
                  style={{ left: x, top: y }}
                />
              );
            })}
          </div>
          
          {hasGaps && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="text-amber-500 flex-shrink-0" size={16} />
                <p className="text-amber-400 text-[10px] uppercase font-bold tracking-wider leading-tight">
                    Coverage Gaps Detected! Capture photos in the empty radar sectors.
                </p>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-auto">
            <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-wider">
              <span className="text-slate-400">Progress</span>
              <span className="text-emerald-400">{Math.round((capturedPhotos.length / TOTAL_PHOTOS) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(capturedPhotos.length / TOTAL_PHOTOS) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleFinish}
            disabled={isProcessing || capturedPhotos.length < TOTAL_PHOTOS}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition flex items-center justify-center gap-2 ${
              capturedPhotos.length >= TOTAL_PHOTOS
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <><RefreshCw size={18} className="animate-spin" /> Processing...</>
            ) : (
              <><UploadCloud size={18} /> Generate 3D Model</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
