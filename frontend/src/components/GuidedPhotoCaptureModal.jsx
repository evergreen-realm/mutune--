import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, AlertTriangle, Navigation, Zap, Film, FileVideo, Settings2, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';
import { useCameraMotion } from '../hooks/useCameraMotion';
import { useCameraDevices } from '../hooks/useCameraDevices';
import { analyzeFrameQuality } from '../utils/frameQualityAnalyzer';
import { extractFramesFromVideo } from '../utils/videoFrameExtractor';
import { generateSphericalTargets, getClosestUncapturedTarget, getNextSequentialTarget, projectTargetToScreen } from '../utils/sphericalTargets';

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_FRAMES = 16;
const MAX_FRAMES = 36;

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



// ─── Main Modal Component ───────────────────────────────────────────────────

// Device detection: live camera scanning requires physical rotation (mobile only)
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const webcamRef = useRef(null);
  const videoPlayerRef = useRef(null);

  // Default to video mode on desktop — live camera requires mobile gyroscope (Rule §22)
  const [inputMode, setInputMode] = useState(isTouchDevice ? 'camera' : 'video'); // 'camera' | 'video'
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoLockProgress, setAutoLockProgress] = useState(0);
  const [frameQuality, setFrameQuality] = useState({ isQualityOK: true, message: 'Calibrating...' });
  const [scanStarted, setScanStarted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [scanDensity, setScanDensity] = useState('Detailed'); // 'Fast' | 'Detailed'
  const [isGenerating, setIsGenerating] = useState(false);
  const [roomIndex, setRoomIndex] = useState(1); // Multi-room: tracks which room the user is scanning

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

  const captureInFlightRef = useRef(false);

  // Camera Devices Hook
  const {
    videoDevices, selectedDeviceId, setSelectedDeviceId, refreshDevices
  } = useCameraDevices(isOpen && inputMode === 'camera');

  const {
    angle, pitch, roll, motionSpeed, isSensorAvailable,
    requestSensorPermission, resetDisplacement
  } = useCameraMotion(isOpen && inputMode === 'camera' && scanStarted, webcamRef);

  const [virtualYaw, setVirtualYaw] = useState(0);
  const [virtualPitch, setVirtualPitch] = useState(0);
  const [dragStart, setDragStart] = useState(null);

  const currentYaw = isSensorAvailable ? angle : virtualYaw;
  const currentPitch = isSensorAvailable ? pitch : virtualPitch;

  // Computed values
  const capturedCount = useMemo(() => targets.filter(t => t.captured).length, [targets]);
  const allCaptured = capturedCount >= targets.length;

  // Sequential target: drives guidance UI ("go to target #5 next")
  const sequentialTarget = useMemo(() => getNextSequentialTarget(targets), [targets]);

  // Closest target within alignment range: drives auto-lock ("you're aimed at target #5")
  const alignedTarget = useMemo(() => {
    // Only allow snapping to targets in the active ring to prevent skipping ahead
    const activeRingTargets = targets.filter(t => t.ring === (sequentialTarget?.ring || 'equator'));
    return getClosestUncapturedTarget(currentYaw, currentPitch, activeRingTargets, 15);
  }, [currentYaw, currentPitch, targets, sequentialTarget]);

  // The "current" target for UI display: show the sequential target for guidance,
  // but when aligned with ANY uncaptured target, prioritize that for auto-capture
  const currentTarget = alignedTarget || sequentialTarget;

  // Spatial alignment & level math
  const levelDelta = Math.abs(currentPitch);
  const targetYawDelta = currentTarget ? (((currentTarget.yaw - currentYaw + 540) % 360) - 180) : 0;
  const targetPitchDelta = currentTarget ? (currentTarget.pitch - currentPitch) : 0;

  const isAligned = currentTarget && !currentTarget.captured &&
    Math.abs(targetYawDelta) <= 15 && Math.abs(targetPitchDelta) <= 15 && motionSpeed < 3;

  // Unified Guidance Priority Queue — NYC Pilot style
  const guidanceText = useMemo(() => {
    if (!scanStarted) return 'Tap Start to begin scanning';
    if (cameraError) return 'Camera unavailable — switch to video or retry';
    if (motionSpeed > 40) return '⚠️ Slow down — hold device steady';
    if (!frameQuality.isQualityOK) return `⚠️ ${frameQuality.message}`;
    if (allCaptured) return `✅ All ${capturedCount} photos captured! Tap Review to stitch.`;
    if (levelDelta > 35) return '📐 Level the camera with the horizon';
    if (isAligned) return `🎯 Hold steady — capturing... (${capturedCount + 1}/${targets.length})`;

    // Ring-aware progress label
    const ringLabel = sequentialTarget?.ring === 'upper' ? 'Look up — ceiling ring'
      : sequentialTarget?.ring === 'lower' ? 'Look down — floor ring'
        : 'Eye level — rotate slowly';

    if (currentTarget) {
      const progress = `${capturedCount}/${targets.length}`;
      if (Math.abs(targetYawDelta) > 135) return `🔄 Turn around — target behind you (${progress})`;
      if (targetYawDelta > 15) return `Tilt your device to the right (${progress})`;
      if (targetYawDelta < -15) return `Tilt your device to the left (${progress})`;
      if (targetPitchDelta > 10) return `Tilt up slowly (${progress})`;
      if (targetPitchDelta < -10) return `Tilt down slowly (${progress})`;
      return `Almost there — hold steady (${progress})`;
    }

    // Fallback: sequential target guidance
    if (sequentialTarget) {
      const seqYawDelta = (((sequentialTarget.yaw - currentYaw + 540) % 360) - 180);
      if (sequentialTarget.ring !== 'equator' && capturedCount > 0) {
        return `${ringLabel} — ${capturedCount}/${targets.length}`;
      }
      if (seqYawDelta > 0) return `Rotate right → (${capturedCount}/${targets.length})`;
      return `Rotate left ← (${capturedCount}/${targets.length})`;
    }
    return `Scanning Room ${roomIndex}... (${capturedCount}/${targets.length})`;
  }, [scanStarted, cameraError, motionSpeed, frameQuality, allCaptured, levelDelta, isAligned, autoLockProgress, currentTarget, sequentialTarget, targetYawDelta, targetPitchDelta, capturedCount, targets, currentYaw, roomIndex]);

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
      setAutoLockProgress(0);
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
        setTargets(prev => prev.map(t =>
          t.id === targetId ? { ...t, captured: true, photoUrl: res.url } : t
        ));
        setCapturedPhotos(prev => {
          const newPhotos = [
            ...prev,
            {
              url: res.url,
              targetId: targetId,
              angle: Math.round(currentYaw),
              pitch: Math.round(currentPitch),
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
        toast.success(`Target captured! (${capturedPhotos.length + 1}/${targets.length})`, { autoClose: 1200 });
      }
    } catch (err) {
      toast.error('Capture failed: ' + err.message);
    } finally {
      setIsCapturing(false);
      setAutoLockProgress(0);
      captureInFlightRef.current = false;
    }
  }, [capturedPhotos, roll, targets, currentYaw, currentPitch]);

  // ─── Instant Auto-Snap Lock Timer (<300ms) ──────────────────────────────────
  // 300ms Instant Auto-Lock: increments 33.4% per 100ms tick.
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || !scanStarted || cameraError || isCapturing || reviewMode || allCaptured) {
      setAutoLockProgress(0);
      misalignedSinceRef.current = null;
      return;
    }

    const timer = setInterval(() => {
      setAutoLockProgress(prev => {
        if (isAligned && frameQuality.isQualityOK && currentTarget && !currentTarget.captured) {
          // Aligned: reset misaligned timer, ramp up over 300ms
          misalignedSinceRef.current = null;
          if (prev >= 100) {
            captureForTarget(currentTarget.id);
            return 0;
          }
          return prev + 33.4;
        } else {
          // Misaligned: instant reset
          return Math.max(0, prev - 33.4);
        }
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isAligned, frameQuality.isQualityOK, isOpen, inputMode, scanStarted, cameraError, isCapturing, reviewMode, allCaptured, currentTarget, captureForTarget]);

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

  // ─── Desktop Mouse Drag Handlers ──────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (isSensorAvailable || !scanStarted) return;
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseMove = (e) => {
    if (!dragStart || isSensorAvailable || !scanStarted) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setVirtualYaw(prev => (prev - dx * 0.3 + 360) % 360);
    setVirtualPitch(prev => Math.max(-90, Math.min(90, prev + dy * 0.3)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setDragStart(null);

  // ─── Manual shutter ───────────────────────────────────────────────────────
  const handleManualCapture = useCallback(() => {
    if (currentTarget) captureForTarget(currentTarget.id);
  }, [captureForTarget, currentTarget]);

  // ─── Camera error handler (Auto Fallback to Video Upload) ─────────────────
  const handleUserMediaError = useCallback((err) => {
    console.warn('Webcam stream error:', err);
    setCameraError(true);
    toast.warning('Webcam unavailable or restricted. Switched to 360° Video Upload mode.');
    setInputMode('video');
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
      // Show "Generating 3D World" screen instead of immediately closing (NYC Pilot parity)
      setReviewMode(false);
      setIsGenerating(true);
      // Auto-close after a brief display of the generating state
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 4000);
    } catch (error) {
      toast.error('Failed to submit scan: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // ─── "Generating 3D World" Processing Screen (NYC Pilot parity) ────────────
  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-6 p-8">
          {/* Animated sphere */}
          <div className="w-32 h-32 mx-auto relative">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-700 via-amber-500 to-amber-800 shadow-[0_0_80px_rgba(217,119,6,0.4)] animate-spin" style={{ animationDuration: '4s' }}>
              <div className="absolute inset-2 rounded-full bg-gradient-to-tl from-amber-900/60 via-transparent to-amber-600/30" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          </div>
          <div>
            <h2 className="text-white text-xl font-black mb-2">Generating 3D World</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
              This will take about 5 minutes — feel free to leave and come back.
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-48 mx-auto">
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full animate-pulse" style={{ width: '30%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              {isTouchDevice && (
                <button type="button"
                  onClick={() => setInputMode('camera')}
                  title="Use your phone camera to scan 360°"
                  className={`px-2 sm:px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 ${inputMode === 'camera' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}>
                  <Camera size={11} /> Live 📱
                </button>
              )}
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
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 backdrop-blur-md rounded-full border text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider max-w-[280px] sm:max-w-none truncate ${isAligned ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                : allCaptured ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : motionSpeed > 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
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
            <h2 className="text-white text-xl font-bold mb-2">Review 360° Source Frames — Room {roomIndex}</h2>
            <p className="text-slate-400 text-xs mb-6">{capturedPhotos.length} photos captured across {roomIndex} room{roomIndex > 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 w-full max-w-6xl mb-8">
              {targets.filter(t => t.captured).map((t, i) => (
                <div key={i} className="aspect-square bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative group shadow-lg">
                  {t.photoUrl ? (
                    <img src={t.photoUrl} alt={`Target ${t.id}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500"><CheckCircle2 size={32} /></div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold uppercase tracking-widest">({Math.round(t.yaw)}°, {Math.round(t.pitch)}°)</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Scan another room — resets targets but keeps accumulated photos */}
              <button type="button" onClick={() => {
                setRoomIndex(prev => prev + 1);
                setTargets(generateSphericalTargets(scanDensity));
                setReviewMode(false);
                setScanStarted(false);
                toast.info(`Ready to scan Room ${roomIndex + 1}. Stand at center of the next room.`);
              }}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-black uppercase tracking-wider text-xs border border-slate-600 transition flex items-center gap-2">
                <RotateCcw size={14} /> Scan Another Room
              </button>

              <button onClick={handleFinish} disabled={isProcessing}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-black uppercase tracking-wider text-xs shadow-lg hover:scale-105 transition flex items-center gap-2 disabled:opacity-50 disabled:scale-100">
                {isProcessing ? <><RefreshCw size={16} className="animate-spin" /> Stitching Model...</> : 'Confirm & Stitch Model'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto custom-scrollbar min-h-0"
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

            {/* Left: Camera Feed */}
            <div className="flex-1 relative bg-black flex flex-col items-center justify-center min-h-[220px] sm:min-h-[300px] lg:min-h-[400px] border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden"
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} style={{ cursor: (!isSensorAvailable && scanStarted) ? 'grab' : 'default' }}>
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
                    <div className="space-y-3 max-w-sm w-full">
                      {/* Desktop notice banner */}
                      {!isTouchDevice && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                          <p className="text-amber-300 text-xs font-bold">
                            📱 Live 360° scanning requires a mobile phone
                          </p>
                          <p className="text-slate-400 text-[10px] mt-1">
                            Record a slow 360° walkthrough video on your phone, then upload it here.
                          </p>
                        </div>
                      )}
                      <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-300 w-full bg-slate-900/50 hover:bg-slate-900 group block">
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />
                        <FileVideo size={32} className="mx-auto text-slate-500 group-hover:text-blue-400 mb-2 transition" />
                        <h4 className="text-white font-extrabold text-xs sm:text-sm mb-1">Upload 360° Room Video</h4>
                        <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed mb-2">MP4 or WebM format. Frames will be extracted automatically.</p>
                        <span className="inline-block px-3 py-1.5 bg-blue-600 text-white font-bold text-[10px] rounded-xl shadow-md group-hover:bg-blue-500 transition">Browse File</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Reticle & Shutter (camera mode, scan started) ───────── */}
              {inputMode === 'camera' && !cameraError && scanStarted && (
                <>
                    {/* ─── 360° Room Sector Coverage Mask (NYC Pilot style) ─── */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                      {targets.filter(t => t.ring === 'equator').map((t) => {
                        const sectorAngle = 36; // 10 equator sectors
                        const relativeYaw = ((t.yaw - currentYaw + 540) % 360) - 180;
                        const startAngle = relativeYaw - sectorAngle / 2;

                        return (
                          <div key={`mask-${t.id}`}
                            className={`absolute inset-0 transition-opacity duration-500 ${t.captured ? 'opacity-0' : 'opacity-80 bg-slate-950'}`}
                            style={{
                              clipPath: t.captured ? 'none' : `conic-gradient(from ${startAngle + 180}deg at 50% 50%, #020617 0deg ${sectorAngle}deg, transparent ${sectorAngle}deg 360deg)`
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Viewfinder reticle (AR Tracker) */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                      {/* Bounding Box (NYC Pilot minimal thin white frame) */}
                      <div className={`relative w-[85%] max-w-xl aspect-[4/3] border rounded-2xl transition-all duration-300 ${isAligned
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.5)] scale-[1.02]'
                          : (currentTarget && currentTarget.captured)
                            ? 'border-amber-400/40'
                            : 'border-white/30'
                        }`}>
                        {/* Central Reticle */}
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 border-2 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.8)] transition-colors ${isAligned ? 'border-emerald-400 bg-emerald-400/40 scale-110' : 'border-white/80'
                          }`} />
                      </div>

                      {/* Virtual AR Breadcrumb for Current Target */}
                      <div className="absolute inset-0 pointer-events-none">
                        {currentTarget && !currentTarget.captured && (() => {
                          const proj = projectTargetToScreen(currentTarget.yaw, currentTarget.pitch, currentYaw, currentPitch, isTouchDevice ? 70 : 60, isTouchDevice ? 55 : 45);
                          const isTargetAligned = proj.distance <= 15;

                          if (proj.clamped) {
                            // Render edge pointer arrow
                            return (
                              <div className="absolute w-10 h-10 -mt-5 -ml-5 flex items-center justify-center text-emerald-400 z-30 transition-transform duration-100 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                                style={{ left: `${proj.x}%`, top: `${proj.y}%`, transform: `rotate(${proj.angleToTarget}deg)` }}>
                                <Navigation size={32} className="fill-emerald-500 stroke-emerald-200" />
                              </div>
                            );
                          }

                          // Render NYC Pilot target dot with surrounding white radial SVG progress ring stroke
                          return (
                            <div className="absolute w-10 h-10 -mt-5 -ml-5 flex items-center justify-center transition-all duration-100 z-20"
                              style={{ left: `${proj.x}%`, top: `${proj.y}%` }}>
                              {/* White Radial Progress Ring Stroke */}
                              {isTargetAligned && autoLockProgress > 0 && (
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                  <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                                  <circle cx="20" cy="20" r="16" fill="none" stroke="#ffffff" strokeWidth="3"
                                    strokeDasharray={`${(autoLockProgress / 100) * 100.5} 100.5`} strokeLinecap="round" />
                                </svg>
                              )}
                              {/* Solid Green Target Dot */}
                              <div className={`w-5 h-5 rounded-full bg-emerald-500 transition-all duration-200 ${isTargetAligned ? 'shadow-[0_0_16px_rgba(16,185,129,1)] scale-110' : 'shadow-[0_0_6px_rgba(16,185,129,0.6)]'}`}>
                                <div className="w-1.5 h-1.5 bg-white rounded-full mx-auto mt-1.75 shadow-inner" />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* NYC Pilot Bottom Progress Bar Overlay */}
                    <div className="absolute bottom-4 left-6 right-6 z-30 flex items-center justify-between pointer-events-auto bg-slate-950/70 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-2xl">
                      <div className="flex items-center gap-3 flex-1 max-w-md">
                        <span className="text-white text-xs font-black tracking-wider uppercase whitespace-nowrap">{capturedCount} of {targets.length}</span>
                        <div className="h-2 flex-1 bg-slate-800 rounded-full overflow-hidden border border-white/10">
                          <div className={`h-full transition-all duration-300 rounded-full ${allCaptured ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (capturedCount / targets.length) * 100)}%` }} />
                        </div>
                      </div>

                      {capturedCount >= MIN_FRAMES && (
                        <button type="button" onClick={() => setReviewMode(true)}
                          className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Review & Stitch ({capturedCount})
                        </button>
                      )}
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
                    <h3 className="text-white font-black text-sm sm:text-base">360° Room Scanner — Room {roomIndex}</h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed max-w-[280px] mx-auto">
                      {isSensorAvailable ? (
                        <>Stand at the <strong className="text-white">center of the room</strong>. Rotate slowly — green dots will guide you. Photos capture automatically when aligned.</>
                      ) : (
                        <>Point your phone camera at the room. <strong className="text-white">Pan slowly</strong> to capture all angles. Shoot all photos from the same spot.</>
                      )}
                    </p>
                    <button type="button" onClick={handleStartScan}
                      className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center gap-2 mx-auto">
                      <Play size={16} /> Start Scanning
                    </button>
                  </div>
                </div>
              )}
            </div>


          </div>
        )}
      </div>
    </div>
  );
}
