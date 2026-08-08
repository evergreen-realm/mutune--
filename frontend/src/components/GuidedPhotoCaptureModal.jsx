import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, UploadCloud, AlertTriangle, CheckCircle2, Navigation, Compass, ShieldAlert, Zap } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';
import { useCameraMotion } from '../hooks/useCameraMotion';
import { analyzeFrameQuality } from '../utils/frameQualityAnalyzer';

// Helper to convert base64 data URL to File
const dataURLtoFile = (dataurl, filename) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Web Audio API chime synthesizer for target lock
const playChimeSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15); // A6
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Ignore audio context autoplay restrictions
  }
};

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const webcamRef = useRef(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [activeSectorIndex, setActiveSectorIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoLockProgress, setAutoLockProgress] = useState(0); // 0..100% lock timer
  const [frameQuality, setFrameQuality] = useState({ isQualityOK: true, message: 'Calibrating...' });

  const TOTAL_SECTORS = 16;
  const SECTOR_ANGLE_STEP = 360 / TOTAL_SECTORS; // 22.5 degrees per sector

  // Integrated Sensor & Optical Motion Tracker Hook
  const {
    angle,
    pitch,
    roll,
    isSensorAvailable,
    motionSpeed,
    requestSensorPermission
  } = useCameraMotion(isOpen, webcamRef);

  // Target angle for current active sector
  const targetAngle = activeSectorIndex * SECTOR_ANGLE_STEP;

  // Calculate shortest angular distance between current angle and target sector
  const rawAngleDiff = Math.abs(angle - targetAngle) % 360;
  const angleDelta = rawAngleDiff > 180 ? 360 - rawAngleDiff : rawAngleDiff;
  const levelDelta = Math.abs(pitch) + Math.abs(roll);

  // Sector alignment check (within ±7.5° of target and camera held level)
  const isAligned = angleDelta <= 8.5 && levelDelta <= 15 && motionSpeed < 35;

  // Real-time Frame Quality Analysis Loop (Runs at ~15fps for high responsiveness)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      if (webcamRef.current?.video) {
        const quality = analyzeFrameQuality(webcamRef.current.video);
        setFrameQuality(quality);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Request Mobile Sensor Permissions on Modal Mount
  useEffect(() => {
    if (isOpen) {
      requestSensorPermission();
    }
  }, [isOpen, requestSensorPermission]);

  // Handle Snapshot Capture Action
  const handleCapture = useCallback(async () => {
    if (capturedPhotos.length >= TOTAL_SECTORS) {
      toast.error(`All ${TOTAL_SECTORS} sectors captured!`);
      return;
    }

    if (!webcamRef.current) return;

    setIsCapturing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error('Could not capture frame from webcam');

      const file = dataURLtoFile(imageSrc, `sector_${activeSectorIndex + 1}_${Date.now()}.jpg`);
      
      // Upload frame
      const res = await uploadDoc(file);
      if (res?.success && res.url) {
        setCapturedPhotos(prev => [
          ...prev, 
          { 
            url: res.url, 
            sectorIndex: activeSectorIndex, 
            angle: Math.round(angle),
            pitch: Math.round(pitch),
            roll: Math.round(roll)
          }
        ]);
        
        playChimeSound();
        if (navigator.vibrate) navigator.vibrate(100);

        toast.success(`Sector ${activeSectorIndex + 1}/${TOTAL_SECTORS} Captured!`);

        // Advance to next target sector automatically
        if (activeSectorIndex < TOTAL_SECTORS - 1) {
          setActiveSectorIndex(prev => prev + 1);
        }
      }
    } catch (err) {
      toast.error('Failed to capture sector: ' + err.message);
    } finally {
      setIsCapturing(false);
      setAutoLockProgress(0);
    }
  }, [activeSectorIndex, angle, capturedPhotos.length, pitch, roll]);

  // Auto-Snap Lock Timer Effect when Target Sector is Aligned & Level
  useEffect(() => {
    if (!isOpen || isCapturing || capturedPhotos.length >= TOTAL_SECTORS) {
      setAutoLockProgress(0);
      return;
    }

    let timer = null;
    if (isAligned && frameQuality.isQualityOK) {
      timer = setInterval(() => {
        setAutoLockProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            handleCapture();
            return 0;
          }
          return prev + 25; // 400ms lock duration
        });
      }, 100);
    } else {
      setAutoLockProgress(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAligned, frameQuality.isQualityOK, isOpen, isCapturing, capturedPhotos.length, handleCapture]);

  // Finalize Submission
  const handleFinish = async () => {
    if (capturedPhotos.length < TOTAL_SECTORS) {
      toast.error(`Please capture all ${TOTAL_SECTORS} sectors for an accurate 3D scan.`);
      return;
    }
    setIsProcessing(true);
    try {
      await onComplete(capturedPhotos.map(p => p.url));
      toast.success('🎉 360° Scan complete! Model processing initiated.');
      onClose();
    } catch (error) {
      toast.error('Failed to submit scan: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Guidance status text calculation
  let guidanceMessage = `Pan to Target Sector ${activeSectorIndex + 1} (${Math.round(targetAngle)}°)`;
  let statusBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  if (motionSpeed > 40) {
    guidanceMessage = '⚠️ Moving too fast — hold steady!';
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (!frameQuality.isQualityOK) {
    guidanceMessage = `⚠️ ${frameQuality.message}`;
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (levelDelta > 15) {
    guidanceMessage = '📐 Tilt camera to level the horizon';
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (isAligned) {
    guidanceMessage = `🎯 TARGET LOCKED! Auto-snapping in ${Math.ceil((100 - autoLockProgress) / 33)}s...`;
    statusBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse';
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-lg" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[92vh] lg:h-[640px]">
        
        {/* Left Pane: Live Camera Viewfinder & Dynamic Horizon HUD */}
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
          
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Top Info Bar */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-black/70 backdrop-blur-md rounded-full border border-white/10">
              <Camera size={15} className="text-emerald-400 animate-pulse" />
              <span className="text-white text-xs font-black tracking-wider uppercase">
                {capturedPhotos.length} / {TOTAL_SECTORS} SECTORS CAPTURED
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-3.5 py-1.5 backdrop-blur-md rounded-full border text-xs font-extrabold uppercase tracking-wider ${statusBadgeColor}`}>
                {guidanceMessage}
              </div>

              <button 
                onClick={onClose}
                className="pointer-events-auto p-2 bg-black/70 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-white/20 transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Dynamic Pitch/Roll Artificial Horizon Reticle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            
            {/* Viewfinder Target Frame */}
            <div 
              className={`w-64 h-64 sm:w-72 sm:h-72 border-2 rounded-3xl relative flex flex-col items-center justify-center transition-all duration-200 ${
                isAligned 
                  ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105' 
                  : 'border-white/30'
              }`}
            >
              {/* Corner Brackets */}
              <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
              <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
              <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
              <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />

              {/* Dynamic Artificial Horizon Pitch/Roll Bar */}
              <div 
                className="absolute inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent transition-transform duration-100 ease-out"
                style={{
                  transform: `translateY(${Math.max(-80, Math.min(80, pitch * 2))}px) rotate(${-roll}deg)`
                }}
              />
              
              {/* Vertical Crosshair Axis */}
              <div className="absolute inset-y-4 w-[1px] bg-emerald-400/40" />

              {/* Central Target Node */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${isAligned ? 'bg-emerald-400 border-white scale-125 shadow-[0_0_15px_rgba(16,185,129,0.9)]' : 'bg-blue-500/50 border-blue-400'}`} />
              </div>

              {/* Auto-Lock Progress Ring Overlay */}
              {autoLockProgress > 0 && (
                <div className="absolute inset-0 rounded-3xl border-4 border-emerald-400/80 animate-ping pointer-events-none" />
              )}
            </div>
          </div>

          {/* Bottom Live Stats Overlay */}
          <div className="absolute bottom-20 left-4 right-4 z-20 flex justify-between items-center text-[11px] font-bold text-slate-300 pointer-events-none">
            <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5">
              <Compass size={13} className="text-blue-400" />
              <span>Angle: <strong className="text-white">{Math.round(angle)}°</strong> (Target: {Math.round(targetAngle)}°)</span>
            </div>
            <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5">
              <Zap size={13} className="text-emerald-400" />
              <span>Blur Score: <strong className="text-white">{frameQuality.blurScore}</strong></span>
            </div>
          </div>

          {/* Shutter Button & Manual Capture Action */}
          <div className="absolute bottom-5 left-0 right-0 z-30 flex items-center justify-center gap-4 pointer-events-auto">
            <button
              type="button"
              onClick={handleCapture}
              disabled={isCapturing || capturedPhotos.length >= TOTAL_SECTORS}
              className={`w-16 h-16 rounded-full border-4 backdrop-blur flex items-center justify-center transition-all duration-300 active:scale-95 ${
                isAligned 
                  ? 'bg-emerald-500/80 border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.8)]' 
                  : 'bg-white/20 border-white/80 hover:bg-white/40'
              } disabled:opacity-50`}
            >
              {isCapturing ? (
                <RefreshCw className="animate-spin text-white" size={24} />
              ) : (
                <div className={`w-10 h-10 rounded-full transition-all ${isAligned ? 'bg-white scale-110' : 'bg-white'}`} />
              )}
            </button>
          </div>
        </div>

        {/* Right Pane: Radar & Guided Sector Progression */}
        <div className="w-full lg:w-88 bg-slate-900 p-6 flex flex-col justify-between overflow-y-auto">
          
          <div>
            <div className="text-center mb-6">
              <h3 className="text-white font-black text-lg mb-1 flex items-center justify-center gap-2">
                <Navigation size={18} className="text-blue-400" /> Live 360° Spatial Radar
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Follow guided target sectors. Keep horizon level until target locks automatically.
              </p>
            </div>

            {/* Radar Circular Visualizer */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
              <div className="absolute inset-4 rounded-full border border-slate-800/60" />
              <div className="absolute inset-8 rounded-full bg-slate-800/20" />
              
              {/* Center Spatial Node */}
              <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10" />

              {/* Dynamic Camera Field of View Sweep Cone */}
              <div 
                className="absolute top-1/2 left-1/2 w-48 h-48 -mt-24 -ml-24 origin-center transition-transform duration-100 ease-out"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                 <div 
                    className="absolute bottom-1/2 left-1/2 w-24 h-24 origin-bottom-left"
                    style={{
                      background: 'conic-gradient(from -22.5deg at bottom left, rgba(59,130,246,0.4) 0deg, rgba(59,130,246,0.4) 45deg, transparent 45deg)',
                    }}
                 />
              </div>

              {/* Active Target Sector Highlight Indicator */}
              <div 
                className="absolute top-1/2 left-1/2 w-48 h-48 -mt-24 -ml-24 origin-center pointer-events-none"
                style={{ transform: `rotate(${targetAngle}deg)` }}
              >
                <div className="absolute top-0 left-1/2 -ml-3 w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-400/20 animate-ping" />
              </div>

              {/* Sector Target Nodes (16 Nodes around Perimeter) */}
              {Array.from({ length: TOTAL_SECTORS }).map((_, idx) => {
                const nodeAngle = idx * SECTOR_ANGLE_STEP;
                const rad = (nodeAngle - 90) * (Math.PI / 180);
                const r = 92; // Radius
                const x = 96 + r * Math.cos(rad);
                const y = 96 + r * Math.sin(rad);

                const isCaptured = capturedPhotos.some(p => p.sectorIndex === idx);
                const isActiveTarget = idx === activeSectorIndex;

                return (
                  <div
                    key={idx}
                    onClick={() => setActiveSectorIndex(idx)}
                    title={`Sector ${idx + 1} (${nodeAngle}°)`}
                    className={`absolute w-4 h-4 -mt-2 -ml-2 rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-[8px] font-black z-20 ${
                      isCaptured
                        ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.9)] scale-110'
                        : isActiveTarget
                          ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/30 scale-125 shadow-[0_0_15px_rgba(251,191,36,0.9)]'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                    style={{ left: x, top: y }}
                  >
                    {isCaptured ? '✓' : idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector Completion Progress */}
          <div className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span className="text-slate-400 uppercase tracking-wider">Sector Completion</span>
                <span className="text-emerald-400 font-extrabold">{Math.round((capturedPhotos.length / TOTAL_SECTORS) * 100)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${(capturedPhotos.length / TOTAL_SECTORS) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleFinish}
              disabled={isProcessing || capturedPhotos.length < TOTAL_SECTORS}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 ${
                capturedPhotos.length >= TOTAL_SECTORS
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <><RefreshCw size={16} className="animate-spin" /> Processing Gaussian Splat...</>
              ) : (
                <><UploadCloud size={16} /> Generate 3D Model</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
