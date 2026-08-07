import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, Check, RefreshCw, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import ImageUpload from './ImageUpload';

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const TOTAL_PHOTOS = 16;
  const ANGLE_STEP = 360 / TOTAL_PHOTOS;

  const handleCapture = (urls) => {
    if (urls && urls.length > 0) {
      if (capturedPhotos.length + urls.length <= TOTAL_PHOTOS) {
        setCapturedPhotos(prev => [...prev, ...urls]);
        setCurrentAngle(prev => Math.min(prev + (urls.length * ANGLE_STEP), 360));
      } else {
        toast.error(`Maximum ${TOTAL_PHOTOS} photos allowed.`);
      }
    }
  };

  const handleFinish = async () => {
    if (capturedPhotos.length < TOTAL_PHOTOS) {
      toast.error(`Please capture all ${TOTAL_PHOTOS} photos for a complete 360° scan.`);
      return;
    }
    setIsProcessing(true);
    try {
      await onComplete(capturedPhotos);
      toast.success('360° Scan captured successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to process scan: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[600px]">
        
        {/* Left Side: Viewfinder HUD / Image Upload */}
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center p-6 border-b md:border-b-0 md:border-r border-slate-800">
          
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
            <div className="w-64 h-64 border-2 border-white/20 rounded-3xl relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-3xl" />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-1 opacity-50">
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Upload Component */}
          <div className="z-10 w-full max-w-sm">
            <ImageUpload 
              value={[]}
              onChange={handleCapture}
              multiple={true}
              label={capturedPhotos.length === 0 ? "Start 360° Capture" : "Capture Next Angle"}
            />
          </div>

        </div>

        {/* Right Side: Radar & Progress */}
        <div className="w-full md:w-80 bg-slate-900 p-6 flex flex-col">
          
          <div className="mb-8 text-center">
            <h3 className="text-white font-black text-xl mb-2">360° Scan</h3>
            <p className="text-slate-400 text-xs">
              Take {TOTAL_PHOTOS} overlapping photos circling the room to generate a 3D Gaussian Splat model.
            </p>
          </div>

          {/* Radar Visualization */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
            <div className="absolute inset-4 rounded-full border border-slate-800/50" />
            <div className="absolute inset-8 rounded-full bg-slate-800/20" />
            
            {/* Center Node */}
            <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />

            {/* Radar Sweep */}
            <div 
              className="absolute top-1/2 left-1/2 w-24 h-1 origin-left bg-gradient-to-r from-blue-500/0 to-blue-500/50"
              style={{ transform: `rotate(${currentAngle}deg)`, transition: 'transform 0.5s ease-out' }}
            />

            {/* Angle Dots */}
            {Array.from({ length: TOTAL_PHOTOS }).map((_, i) => {
              const angle = i * ANGLE_STEP;
              const rad = (angle - 90) * (Math.PI / 180);
              const r = 96; // radius
              const x = 96 + r * Math.cos(rad);
              const y = 96 + r * Math.sin(rad);
              const isCaptured = i < capturedPhotos.length;
              
              return (
                <div 
                  key={i}
                  className={`absolute w-3 h-3 -mt-1.5 -ml-1.5 rounded-full transition-all duration-300 ${
                    isCaptured ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-emerald-400/30'
                  }`}
                  style={{ left: x, top: y }}
                />
              );
            })}
          </div>

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
