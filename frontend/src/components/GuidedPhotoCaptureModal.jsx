import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, AlertTriangle, Navigation, Zap, Film, FileVideo, Settings2, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';
import { useCameraMotion } from '../hooks/useCameraMotion';
import { useCameraDevices } from '../hooks/useCameraDevices';
import { analyzeFrameQuality } from '../utils/frameQualityAnalyzer';
import { extractFramesFromVideo } from '../utils/videoFrameExtractor';
import { generateSphericalTargets, getClosestUncapturedTarget, projectTargetToScreen } from '../utils/sphericalTargets';

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_FRAMES = 16;
const MAX_FRAMES = 36;

// How long camera must hold on an uncaptured sector before auto-capture (ms)
const AUTO_CAPTURE_DWELL_MS = 800;

// ─── Helpers ────────────────────────────────────────────────────────────────

const dataURLtoFile = (dataurl, filename) => {
  if (!dataurl || typeof dataurl !== 'string') {
    throw new Error('No valid image data stream available for capture.');
  }
  const parts = dataurl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64Str = parts[1] || parts[0];
  try {
    const bstr = atob(base64Str);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    throw new Error('Failed to decode image buffer from camera feed.');
  }
};

const playChimeSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) { /* Ignore audio context restrictions */ }
};

// ─── Compass Radar Component ────────────────────────────────────────────────

function CompassRadar({ sectors, currentSector, angle, size = 200 }) {
  const center = size / 2;
  const outerR = (size / 2) - 10;
  const dotR = size < 160 ? 8 : 10;
  const innerR = outerR - dotR - 8;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="drop-shadow-lg">
      {/* Outer ring */}
      <circle cx={center} cy={center} r={outerR} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="1.5" />
      <circle cx={center} cy={center} r={innerR} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" strokeDasharray="4 4" />

      {/* N/S/E/W labels */}
      {['N', 'E', 'S', 'W'].map((label, i) => {
        const labelAngle = i * 90 - 90;
        const labelR = outerR + 12;
        const lx = center + labelR * Math.cos((labelAngle * Math.PI) / 180);
        const ly = center + labelR * Math.sin((labelAngle * Math.PI) / 180);
        return (
          <text key={label} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            className="fill-slate-400 text-[9px] font-black uppercase tracking-wider select-none"
          >
            {label}
          </text>
        );
      })}

      {/* 16 sector dots */}
      {sectors.map((sector, i) => {
        const sectorAngle = i * SECTOR_SIZE - 90; // -90 to start at top (N)
        const cx = center + outerR * Math.cos((sectorAngle * Math.PI) / 180);
        const cy = center + outerR * Math.sin((sectorAngle * Math.PI) / 180);
        const isActive = i === currentSector;
        const isCaptured = sector.captured;

        return (
          <g key={i}>
            {/* Pulse animation on active sector */}
            {isActive && !isCaptured && (
              <circle cx={cx} cy={cy} r={dotR + 4} fill="none" stroke="rgba(34,197,94,0.5)"
                strokeWidth="2" className="animate-ping" style={{ animationDuration: '1.5s' }}
              />
            )}
            <circle
              cx={cx} cy={cy} r={dotR}
              fill={isCaptured ? 'rgba(239,68,68,0.9)' : isActive ? 'rgba(34,197,94,1)' : 'rgba(34,197,94,0.4)'}
              stroke={isActive ? 'white' : isCaptured ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.2)'}
              strokeWidth={isActive ? 2.5 : 1}
              className="transition-all duration-300"
            />
            {/* Checkmark on captured sectors */}
            {isCaptured && (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                className="fill-white text-[8px] font-black select-none pointer-events-none"
              >✓</text>
            )}
            {/* Sector number on uncaptured */}
            {!isCaptured && (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                className="fill-white text-[7px] font-bold select-none pointer-events-none"
              >{i + 1}</text>
            )}
          </g>
        );
      })}

      {/* Direction pointer (current heading) */}
      {(() => {
        const pointerAngle = angle - 90;
        const pointerR = innerR - 10;
        const px = center + pointerR * Math.cos((pointerAngle * Math.PI) / 180);
        const py = center + pointerR * Math.sin((pointerAngle * Math.PI) / 180);
        // Triangle pointer
        const triSize = 8;
        const tipX = center + (pointerR + triSize) * Math.cos((pointerAngle * Math.PI) / 180);
        const tipY = center + (pointerR + triSize) * Math.sin((pointerAngle * Math.PI) / 180);
        const perpAngle = pointerAngle + 90;
        const baseX1 = px + (triSize / 2) * Math.cos((perpAngle * Math.PI) / 180);
        const baseY1 = py + (triSize / 2) * Math.sin((perpAngle * Math.PI) / 180);
        const baseX2 = px - (triSize / 2) * Math.cos((perpAngle * Math.PI) / 180);
        const baseY2 = py - (triSize / 2) * Math.sin((perpAngle * Math.PI) / 180);
        return (
          <>
            {/* Line from center */}
            <line x1={center} y1={center} x2={px} y2={py}
              stroke="rgba(59,130,246,0.6)" strokeWidth="2" strokeLinecap="round" />
            {/* Arrowhead */}
            <polygon points={`${tipX},${tipY} ${baseX1},${baseY1} ${baseX2},${baseY2}`}
              fill="rgba(59,130,246,0.9)" />
            {/* Center dot */}
            <circle cx={center} cy={center} r={4} fill="rgba(59,130,246,1)" stroke="white" strokeWidth="1.5" />
          </>
        );
      })()}
    </svg>
  );
}

// ─── Desktop Sector Selector Component ──────────────────────────────────────

function DesktopSectorSelector({ sectors, onSectorClick }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {sectors.map((sector, i) => (
        <button
          key={i}
          type="button"
          onClick={() => !sector.captured && onSectorClick(i)}
          disabled={sector.captured}
          className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-[9px] font-black transition-all duration-200 ${
            sector.captured
              ? 'border-red-500/40 bg-red-500/10 text-red-400 cursor-default'
              : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400 hover:scale-105 cursor-pointer'
          }`}
        >
          <span className="text-[8px] uppercase tracking-wider opacity-70">{SECTOR_LABELS[i]}</span>
          <span className="text-sm">{sector.captured ? '✓' : i + 1}</span>
          <span className="text-[7px] opacity-50">{Math.round(i * SECTOR_SIZE)}°</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Modal Component ───────────────────────────────────────────────────

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const webcamRef = useRef(null);
  const videoPlayerRef = useRef(null);

  const [inputMode, setInputMode] = useState('camera'); // 'camera' | 'video'
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [frameQuality, setFrameQuality] = useState({ isQualityOK: true, message: 'Calibrating...' });
  const [scanStarted, setScanStarted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [scanDensity, setScanDensity] = useState('Detailed'); // 'Fast' | 'Detailed'

  // Spherical tracking state
  const [targets, setTargets] = useState(() => generateSphericalTargets('Detailed'));

  // Camera WebRTC state
  const [cameraError, setCameraError] = useState(false);
  const [useGenericFallback, setUseGenericFallback] = useState(false);

  // Video File Mode State
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState(null);
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);
  const [videoExtractionProgress, setVideoExtractionProgress] = useState(0);

  // Auto-capture dwell tracking
  const captureInFlightRef = useRef(false);
  const dwellTimerRef = useRef(null);
  const dwellSectorRef = useRef(-1);

  // Camera Devices Hook
  const {
    videoDevices, selectedDeviceId, setSelectedDeviceId, refreshDevices
  } = useCameraDevices(isOpen && inputMode === 'camera');

  const {
    angle, pitch, roll, motionSpeed, isSensorAvailable,
  } = useCameraMotion(isOpen && inputMode === 'camera' && scanStarted, webcamRef);

  // Computed values
  const capturedCount = useMemo(() => targets.filter(t => t.captured).length, [targets]);
  const allCaptured = capturedCount >= targets.length;
  
  // Find closest uncaptured target (dead-zone reticle)
  const currentTarget = useMemo(() => {
    return getClosestUncapturedTarget(angle, pitch, targets, 15);
  }, [angle, pitch, targets]);

  // Guidance text
  const guidanceText = useMemo(() => {
    if (!scanStarted) return 'Tap Start to begin scanning';
    if (cameraError) return 'Camera unavailable — select device or retry';
    if (motionSpeed > 60) return '⚠️ Moving too fast — slow down';
    if (!frameQuality.isQualityOK) return `⚠️ ${frameQuality.message}`;
    if (allCaptured) return `✅ All ${capturedCount} angles captured — ready to generate!`;
    
    if (currentTarget) {
      return `Aim at target (${Math.round(currentTarget.yaw)}°, ${Math.round(currentTarget.pitch)}°) — hold steady to capture (${capturedCount}/${targets.length})`;
    }
    
    // Find next nearest if none is currently targeted
    const nextUncaptured = targets.find(t => !t.captured);
    if (nextUncaptured) {
      return `↻ Move towards (${Math.round(nextUncaptured.yaw)}°, ${Math.round(nextUncaptured.pitch)}°) — this area is done`;
    }
    return `Scanning... (${capturedCount}/${targets.length})`;
  }, [scanStarted, cameraError, motionSpeed, frameQuality, allCaptured, capturedCount, currentTarget, targets]);

  // Video constraints (Rule §14: soft ideal)
  const getVideoConstraints = () => {
    if (useGenericFallback) return true;
    if (selectedDeviceId) return { deviceId: { exact: selectedDeviceId } };
    return { facingMode: { ideal: 'environment' } };
  };

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setCameraError(false);
      setUseGenericFallback(false);
      setScanStarted(false);
      setReviewMode(false);
      setTargets(generateSphericalTargets(scanDensity));
      refreshDevices();
    } else {
      if (videoObjectUrl) { URL.revokeObjectURL(videoObjectUrl); setVideoObjectUrl(null); }
      setSelectedVideoFile(null);
      setIsExtractingVideo(false);
      setScanStarted(false);
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Frame quality analysis loop
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || cameraError || !scanStarted || reviewMode) return;
    const interval = setInterval(() => {
      if (webcamRef.current?.video) {
        setFrameQuality(analyzeFrameQuality(webcamRef.current.video));
      }
    }, 120);
    return () => clearInterval(interval);
  }, [isOpen, inputMode, cameraError, scanStarted, reviewMode]);

  const captureForTarget = useCallback(async (targetId) => {
    if (captureInFlightRef.current) return;
    const target = targets.find(t => t.id === targetId);
    if (!target || target.captured) {
      toast.info(`Target already captured`);
      return;
    }
    if (capturedPhotos.length >= MAX_FRAMES) {
      toast.info(`Maximum ${MAX_FRAMES} frames captured.`);
      return;
    }

    captureInFlightRef.current = true;
    setIsCapturing(true);
    try {
      let imageSrc = webcamRef.current?.getScreenshot?.();
      // Fallback: Direct HTML5 Canvas
      if (!imageSrc && webcamRef.current?.video) {
        const videoEl = webcamRef.current.video;
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          canvas.getContext('2d').drawImage(videoEl, 0, 0);
          imageSrc = canvas.toDataURL('image/jpeg', 0.92);
        }
      }
      if (!imageSrc) throw new Error('Could not capture frame from webcam feed.');

      const file = dataURLtoFile(imageSrc, `scan_target_${targetId}_${Date.now()}.jpg`);
      const res = await uploadDoc(file);

      if (res?.success && res.url) {
        // Mark target as captured
        setTargets(prev => prev.map(t =>
          t.id === targetId ? { ...t, captured: true, photoUrl: res.url } : t
        ));
        setCapturedPhotos(prev => {
          const newPhotos = [
            ...prev,
            {
              url: res.url,
              targetId: targetId,
              angle: Math.round(angle),
              pitch: Math.round(pitch),
              roll: Math.round(roll)
            }
          ];
          if (newPhotos.length >= targets.length) {
             setTimeout(() => setReviewMode(true), 1500);
          }
          return newPhotos;
        });

        playChimeSound();
        if (navigator.vibrate) navigator.vibrate(80);
        toast.success(`${SECTOR_LABELS[sectorIdx]} captured! (${capturedPhotos.length + 1}/${MIN_FRAMES})`, { autoClose: 1200 });
      }
    } catch (err) {
      toast.error('Capture failed: ' + err.message);
    } finally {
      setIsCapturing(false);
      captureInFlightRef.current = false;
    }
  }, [angle, capturedPhotos.length, pitch, roll, sectors]);

  // ─── Auto-Capture: Dwell timer on uncaptured targets ──────────────────────
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || !scanStarted || cameraError) return;
    if (!frameQuality.isQualityOK || motionSpeed > 30) {
      if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
      dwellSectorRef.current = -1;
      return;
    }

    const targetId = currentTarget?.id;
    if (targetId === undefined || currentTarget.captured || capturedPhotos.length >= MAX_FRAMES) {
      if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
      dwellSectorRef.current = -1;
      return;
    }

    if (dwellSectorRef.current === targetId) return;

    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellSectorRef.current = targetId;
    dwellTimerRef.current = setTimeout(() => {
      captureForTarget(targetId);
      dwellSectorRef.current = -1;
      dwellTimerRef.current = null;
    }, AUTO_CAPTURE_DWELL_MS);

    return () => {};
  }, [currentTarget, isOpen, inputMode, scanStarted, cameraError, frameQuality.isQualityOK, motionSpeed, targets, capturedPhotos.length, captureForTarget]);

  // ─── Start Scan (iOS permission from gesture — Rule §17) ──────────────────
  const handleStartScan = useCallback(async () => {
    const granted = await requestSensorPermission();
    if (granted || !isSensorAvailable) {
      resetDisplacement();
      setScanStarted(true);
      setCapturedPhotos([]);
      setTargets(generateSphericalTargets(scanDensity));
    }
  }, [requestSensorPermission, isSensorAvailable, resetDisplacement, scanDensity]);

  // ─── Desktop manual target click ──────────────────────────────────────────
  const handleDesktopSectorClick = useCallback((targetId) => {
    if (scanStarted) {
      captureForTarget(targetId);
    }
  }, [scanStarted, captureForTarget]);

  // ─── Manual shutter (captures current target) ─────────────────────────────
  const handleManualCapture = useCallback(() => {
    if (currentTarget) captureForTarget(currentTarget.id);
  }, [captureForTarget, currentTarget]);

  // ─── Camera error handler ─────────────────────────────────────────────────
  const handleUserMediaError = useCallback((err) => {
    console.warn('Webcam stream error:', err);
    setCameraError(true);
  }, []);

  // ─── Video file handlers ──────────────────────────────────────────────────
  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('video')) {
      toast.error('Please select a valid MP4 or WebM video file.');
      return;
    }
    setSelectedVideoFile(file);
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    setVideoObjectUrl(URL.createObjectURL(file));
  };

  const handleExtractVideoFrames = async () => {
    if (!selectedVideoFile) { toast.error('Please upload a 360° video file first.'); return; }
    setIsExtractingVideo(true);
    setVideoExtractionProgress(0);
    try {
      const frames = await extractFramesFromVideo(selectedVideoFile, (p) => setVideoExtractionProgress(p), targets.length);
      setCapturedPhotos(frames);
      setTargets(prev => prev.map((t, i) => ({ ...t, captured: true, photoUrl: frames[i]?.url || t.photoUrl })));
      playChimeSound();
      toast.success('🎉 Extracted spatial scans from video!');
      setReviewMode(true);
    } catch (err) {
      toast.error('Failed to process video: ' + err.message);
    } finally {
      setIsExtractingVideo(false);
    }
  };

  // ─── Finalize ─────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (capturedPhotos.length < MIN_FRAMES) {
      toast.error(`Please capture at least ${MIN_FRAMES} frames for an accurate 3D scan.`);
      return;
    }
    setIsProcessing(true);
    try {
      await onComplete(capturedPhotos.map(p => p.url));
      toast.success('🎉 360° Scan complete! Processing model...');
      onClose();
    } catch (error) {
      toast.error('Failed to submit scan: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const progressPercent = Math.round((capturedCount / targets.length) * 100);

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto p-1.5 sm:p-3 flex items-center justify-center bg-slate-950/85 backdrop-blur-lg custom-scrollbar">
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[97vh] my-auto z-10">

        {/* ─── Top Header ────────────────────────────────────────────── */}
        <div className="w-full bg-slate-900/90 border-b border-slate-800 px-2.5 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-1.5 z-30 shrink-0 rounded-t-2xl sm:rounded-t-3xl">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Mode Tabs */}
            <div className="bg-black/60 p-0.5 sm:p-1 rounded-full border border-white/10 flex items-center gap-0.5">
              <button type="button" onClick={() => setInputMode('camera')}
                className={`px-2 sm:px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 ${inputMode === 'camera' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                <Camera size={11} /> Live
              </button>
              <button type="button" onClick={() => setInputMode('video')}
                className={`px-2 sm:px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 ${inputMode === 'video' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                <Film size={11} /> Video
              </button>
            </div>

            {/* Camera selector */}
            {inputMode === 'camera' && !cameraError && videoDevices.length > 1 && (
              <div className="bg-black/60 px-2 py-1 rounded-full border border-white/10 flex items-center gap-1">
                <Settings2 size={10} className="text-blue-400" />
                <select value={selectedDeviceId}
                  onChange={(e) => { setSelectedDeviceId(e.target.value); setUseGenericFallback(false); }}
                  className="bg-transparent text-white text-[9px] font-bold focus:outline-none cursor-pointer max-w-[100px]">
                  {videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} className="bg-slate-900 text-white">
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Progress badge */}
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 backdrop-blur-md rounded-full border text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider max-w-[240px] sm:max-w-none truncate ${
              allCaptured ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : currentSectorIsCaptured ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            }`}>
              {guidanceText}
            </div>
            <button onClick={onClose} title="Close modal"
              className="p-1.5 sm:p-2 bg-black/70 hover:bg-white/20 rounded-full border border-white/10 text-white transition">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ─── Main Body ─────────────────────────────────────────────── */}
        {reviewMode ? (
            <div className="flex-1 w-full h-full flex flex-col items-center px-4 pt-12 pb-8 overflow-y-auto custom-scrollbar bg-slate-950">
                <h2 className="text-white text-xl font-bold mb-6">Review 360° Source Frames ({capturedPhotos.length})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 w-full max-w-6xl mb-8">
                    {targets.filter(t => t.captured).map((t, i) => (
                        <div key={i} className="aspect-square bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative group shadow-lg">
                            {t.photoUrl ? (
                                <img src={t.photoUrl} alt={`Target ${t.id}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500"><CheckCircle2 size={32}/></div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-bold uppercase tracking-widest">({Math.round(t.yaw)}°, {Math.round(t.pitch)}°)</span>
                            </div>
                        </div>
                    ))}
                </div>
                
                <button onClick={handleFinish} disabled={isProcessing}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-black uppercase tracking-wider text-xs shadow-lg hover:scale-105 transition flex items-center gap-2 disabled:opacity-50 disabled:scale-100">
                    {isProcessing ? <><RefreshCw size={16} className="animate-spin" /> Stitching Model...</> : 'Confirm & Stitch Model'}
                </button>
            </div>
        ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto custom-scrollbar min-h-0">

          {/* Left: Camera Feed */}
          <div className="flex-1 relative bg-black flex flex-col items-center justify-center min-h-[220px] sm:min-h-[300px] lg:min-h-[400px] border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
            {inputMode === 'camera' ? (
              cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-center space-y-3 z-10">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-extrabold text-sm mb-1">Camera Unavailable</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed max-w-xs mx-auto">Select a device or use generic fallback.</p>
                  </div>
                  {videoDevices.length > 0 && (
                    <select value={selectedDeviceId}
                      onChange={(e) => { setSelectedDeviceId(e.target.value); setUseGenericFallback(false); setCameraError(false); }}
                      className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button type="button" onClick={() => { setUseGenericFallback(true); setCameraError(false); }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl transition shadow">
                      Try Default Camera
                    </button>
                    <button type="button" onClick={() => setInputMode('video')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl transition border border-slate-700">
                      Switch to Video
                    </button>
                  </div>
                </div>
              ) : (
                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                  videoConstraints={getVideoConstraints()} onUserMediaError={handleUserMediaError}
                  className="absolute inset-0 w-full h-full object-cover" />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950">
                {videoObjectUrl ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <video ref={videoPlayerRef} src={videoObjectUrl} controls playsInline
                      className="max-h-[250px] sm:max-h-[320px] w-full rounded-2xl border border-slate-800 object-contain shadow-lg" />
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={handleExtractVideoFrames} disabled={isExtractingVideo}
                        className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-2">
                        {isExtractingVideo ? (<><RefreshCw size={14} className="animate-spin" /> {videoExtractionProgress}%</>) : (<><Film size={14} /> Extract Frames</>)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-300 max-w-sm w-full bg-slate-900/50 hover:bg-slate-900 group">
                    <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />
                    <FileVideo size={32} className="mx-auto text-slate-500 group-hover:text-blue-400 mb-2 transition" />
                    <h4 className="text-white font-extrabold text-xs sm:text-sm mb-1">Upload 360° Room Video</h4>
                    <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed mb-2">MP4 or WebM format. Frames will be extracted automatically.</p>
                    <span className="inline-block px-3 py-1.5 bg-blue-600 text-white font-bold text-[10px] rounded-xl shadow-md group-hover:bg-blue-500 transition">Browse File</span>
                  </label>
                )}
              </div>
            )}

            {/* ─── Reticle & Shutter (camera mode, scan started) ───────── */}
            {inputMode === 'camera' && !cameraError && scanStarted && (
              <>
                {/* Viewfinder reticle (AR Tracker) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                  {/* Bounding Box */}
                  <div className={`relative w-[85%] max-w-xl aspect-[4/3] border-[3px] rounded-3xl transition-all duration-300 ${isCapturing ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.5)] scale-[1.02]' : currentSectorIsCaptured ? 'border-amber-400/50' : 'border-white/50'}`}>
                      {/* Central Reticle */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-[3px] border-white rounded-full shadow-[0_0_15px_rgba(0,0,0,0.8)]"></div>
                  </div>

                  {/* Virtual Green Dots for 3D Targets */}
                  <div className="absolute inset-0 overflow-hidden">
                      {targets.map((target) => {
                          if (target.captured) return null; // Hide captured
                          
                          const proj = projectTargetToScreen(target.yaw, target.pitch, angle, pitch);
                          
                          // Only render if roughly within field of view
                          if (!proj.visible) return null;
                          
                          // We use 10 degrees as threshold for visual feedback
                          const isAligned = proj.distance <= 10;

                          return (
                              <div key={target.id} 
                                   className={`absolute w-12 h-12 -mt-6 -ml-6 rounded-full flex flex-col items-center justify-center transition-transform duration-100 ${isAligned ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-125 z-20' : 'bg-emerald-500/60 shadow-lg z-10'}`}
                                   style={{ left: `${proj.x}%`, top: `${proj.y}%` }}>
                                   <div className="w-4 h-4 bg-white rounded-full shadow-inner mb-0.5"></div>
                                   <span className="text-[8px] font-bold text-white leading-none">({Math.round(target.yaw)}°, {Math.round(target.pitch)}°)</span>
                              </div>
                          );
                      })}
                  </div>

                  {/* Artificial Horizon */}
                  <div className="absolute top-1/2 left-1/2 w-[85%] max-w-xl h-[1px] -translate-x-1/2 -translate-y-1/2 opacity-40">
                      <div className="w-full h-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,1)]" style={{ transform: `translateY(${pitch * 4}px) rotate(${-roll}deg)` }}></div>
                  </div>

                  {/* Target label in viewfinder */}
                  {currentTarget && (
                    <div className="absolute bottom-[20%] left-0 right-0 text-center pointer-events-none z-20">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        currentTarget.captured
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        Target ({Math.round(currentTarget.yaw)}°, {Math.round(currentTarget.pitch)}°)
                        {currentTarget.captured ? ' ✓' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Shutter button */}
                <div className="absolute bottom-3 left-0 right-0 z-30 flex items-center justify-center gap-3 pointer-events-auto">
                  <button type="button" onClick={handleManualCapture}
                    disabled={isCapturing || (currentTarget && currentTarget.captured) || capturedPhotos.length >= MAX_FRAMES}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 backdrop-blur flex items-center justify-center transition-all duration-300 active:scale-95 ${
                      isCapturing ? 'bg-emerald-500/80 border-emerald-300'
                        : (currentTarget && currentTarget.captured) ? 'bg-amber-500/30 border-amber-400/50 cursor-not-allowed'
                        : 'bg-white/20 border-white/80 hover:bg-white/40'
                    } disabled:opacity-50`}>
                    {isCapturing ? (
                      <RefreshCw className="animate-spin text-white" size={20} />
                    ) : (currentTarget && currentTarget.captured) ? (
                      <RotateCcw className="text-amber-400" size={18} />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white transition-all" />
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ─── Start Scanning Overlay ─────────────────────────────── */}
            {inputMode === 'camera' && !cameraError && !scanStarted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="text-center space-y-3 p-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                    <Navigation size={28} className="text-blue-400" />
                  </div>
                  <h3 className="text-white font-black text-sm sm:text-base">360° Room Scanner</h3>
                  <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed max-w-[280px] mx-auto">
                    Stand at the <strong className="text-white">center of the room</strong>. Slowly rotate 360° — the compass will guide you to capture 16 angles.
                    {!isSensorAvailable && ' On desktop, click compass sectors to mark each direction.'}
                  </p>
                  <button type="button" onClick={handleStartScan}
                    className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center gap-2 mx-auto">
                    <Play size={16} /> Start Scanning
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right Pane: Compass + Progress ──────────────────────── */}
          <div className="w-full lg:w-96 bg-slate-900 p-3 sm:p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar shrink-0">
            <div>
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-white font-black text-sm sm:text-base mb-0.5 flex items-center justify-center gap-1.5">
                  <Navigation size={15} className="text-blue-400" /> Compass Guide
                </h3>
                <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed">
                  {inputMode === 'camera'
                    ? isSensorAvailable
                      ? 'Rotate slowly. Green = needed, Red = captured.'
                      : 'Click sectors below or move camera to each angle.'
                    : 'Upload 360° video to extract spatial frames.'}
                </p>
              </div>

              {/* Target Density Selector */}
              {inputMode === 'camera' && !scanStarted && (
                <div className="mb-4">
                  <label className="text-white text-xs font-bold mb-2 block">Scan Density</label>
                  <div className="flex bg-slate-950 p-1 rounded-xl">
                    <button type="button" onClick={() => setScanDensity('Fast')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${scanDensity === 'Fast' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      Fast (16 Points)
                    </button>
                    <button type="button" onClick={() => setScanDensity('Detailed')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${scanDensity === 'Detailed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      Detailed (34 Points)
                    </button>
                  </div>
                </div>
              )}

              {/* Target Grid Tracker */}
              {inputMode === 'camera' && scanStarted && (
                <div className="mb-3">
                  <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                    <span>Upper</span><span>Equator</span><span>Lower</span>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {targets.map((target) => {
                      const isCurrent = currentTarget?.id === target.id;
                      return (
                        <div key={target.id}
                          onClick={() => !isSensorAvailable && handleDesktopSectorClick(target.id)}
                          className={`w-6 h-6 rounded flex items-center justify-center text-[7px] font-black transition-all cursor-pointer ${
                            target.captured
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : isCurrent
                                ? 'bg-amber-500/30 text-amber-300 border border-amber-400 ring-1 ring-amber-400'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'
                          }`}>
                          {target.captured ? '✓' : target.id}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Motion indicator */}
              {scanStarted && inputMode === 'camera' && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3 mb-3">
                  <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
                    <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Zap size={10} className="text-blue-400" /> Motion
                    </span>
                    <span className={`font-extrabold ${motionSpeed > 60 ? 'text-amber-400' : motionSpeed > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {motionSpeed > 60 ? 'Too Fast' : motionSpeed > 0 ? 'Moving' : 'Still'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-200 ${motionSpeed > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, motionSpeed)}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom: Progress + Generate */}
            <div className="space-y-2.5 sm:space-y-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3">
                  <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
                    <span className="text-slate-400 uppercase tracking-wider">Targets Captured</span>
                    <span className={`font-extrabold ${allCaptured ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {capturedCount}/{targets.length}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 rounded-full ${
                      allCaptured ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400'
                    }`} style={{ width: `${Math.min(100, progressPercent)}%` }} />
                  </div>
                </div>

                <button onClick={() => setReviewMode(true)}
                  disabled={isProcessing || capturedCount < MIN_FRAMES}
                  className={`w-full py-2.5 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 ${
                    allCaptured
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}>
                {isProcessing ? (<><RefreshCw size={14} className="animate-spin" /> Processing...</>) : (<><CheckCircle2 size={14} /> Review & Stitch</>)}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
