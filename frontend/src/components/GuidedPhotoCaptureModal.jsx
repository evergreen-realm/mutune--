import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, AlertTriangle, Navigation, Zap, Film, FileVideo, Settings2, Play, CheckCircle2, RotateCcw, Compass } from 'lucide-react';
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

// ─── Heading-Up Rotating Compass Radar Component ─────────────────────────────

function CompassRadar({ targets, angle, onTargetClick, size = 200 }) {
  const center = size / 2;
  const outerR = (size / 2) - 12;
  const innerR = outerR - 22;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ maxHeight: size }} className="drop-shadow-lg mx-auto select-none">
      {/* Outer rings */}
      <circle cx={center} cy={center} r={outerR} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
      <circle cx={center} cy={center} r={innerR} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={center} cy={center} r={8} fill="rgba(59,130,246,0.3)" stroke="rgba(59,130,246,0.8)" strokeWidth="1" />

      {/* Heading Cone (Points UP to indicate current camera facing direction) */}
      <path d={`M ${center} ${center} L ${center - outerR * 0.35} ${center - outerR} A ${outerR} ${outerR} 0 0 1 ${center + outerR * 0.35} ${center - outerR} Z`}
            fill="rgba(59,130,246,0.25)" stroke="rgba(59,130,246,0.6)" strokeWidth="1" />

      {/* Dynamic Rotating Targets (Transformed relative to current angle) */}
      {targets.map((target) => {
        const relYaw = (target.yaw - angle + 360) % 360;
        const rad = (relYaw - 90) * (Math.PI / 180);
        const r = target.pitch > 10 ? innerR - 18 : target.pitch < -10 ? outerR : innerR;
        const cx = center + r * Math.cos(rad);
        const cy = center + r * Math.sin(rad);
        return (
          <circle
            key={target.id}
            cx={cx}
            cy={cy}
            r={target.captured ? 4 : 6}
            fill={target.captured ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,1)'}
            stroke={target.captured ? 'none' : 'rgba(255,255,255,0.8)'}
            strokeWidth="1.5"
            onClick={() => onTargetClick && onTargetClick(target.id)}
            className="cursor-pointer hover:scale-150 transition-transform"
          >
            <title>{`Target ${target.id} (${Math.round(target.yaw)}°, ${Math.round(target.pitch)}°)`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

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
  const [compassCollapsed, setCompassCollapsed] = useState(false);
  const [roomIndex, setRoomIndex] = useState(1); // Multi-room: tracks which room the user is scanning

  const [dragStart, setDragStart] = useState(null);
  const [virtualYaw, setVirtualYaw] = useState(0);
  const [virtualPitch, setVirtualPitch] = useState(0);

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

  const currentYaw = isSensorAvailable ? angle : virtualYaw;
  const currentPitch = isSensorAvailable ? pitch : virtualPitch;

  // Computed values
  const capturedCount = useMemo(() => targets.filter(t => t.captured).length, [targets]);
  const allCaptured = capturedCount >= targets.length;

  // Sequential target: drives guidance UI ("go to target #5 next")
  const sequentialTarget = useMemo(() => getNextSequentialTarget(targets), [targets]);

  // Closest target within alignment range: drives auto-lock ("you're aimed at target #5")
  const alignedTarget = useMemo(() => {
    return getClosestUncapturedTarget(currentYaw, currentPitch, targets, 15);
  }, [currentYaw, currentPitch, targets]);

  // The "current" target for UI display: show the sequential target for guidance,
  // but when aligned with ANY uncaptured target, prioritize that for auto-capture
  const currentTarget = alignedTarget || sequentialTarget;

  // Spatial alignment & level math
  const levelDelta = Math.abs(currentPitch) + Math.abs(roll);
  const targetYawDelta = currentTarget ? (((currentTarget.yaw - currentYaw + 540) % 360) - 180) : 0;
  const targetPitchDelta = currentTarget ? (currentTarget.pitch - currentPitch) : 0;

  const isAligned = currentTarget && !currentTarget.captured &&
    Math.abs(targetYawDelta) <= 8.5 && Math.abs(targetPitchDelta) <= 10 && levelDelta <= 15 && motionSpeed < 35;

  // Unified Guidance Priority Queue — NYC Pilot style
  const guidanceText = useMemo(() => {
    if (!scanStarted) return 'Tap Start to begin scanning';
    if (cameraError) return 'Camera unavailable — switch to video or retry';
    if (motionSpeed > 40) return '⚠️ Slow down — hold device steady';
    if (!frameQuality.isQualityOK) return `⚠️ ${frameQuality.message}`;
    if (allCaptured) return `✅ All ${capturedCount} photos captured! Tap Review to stitch.`;
    if (levelDelta > 15) return '📐 Level the camera with the horizon';
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

    // Duplicate-frame guard: check angular distance from last captured frame
    // If the user barely moved since the last capture, skip (prevents near-identical frames)
    if (capturedPhotos.length > 0) {
      const lastPhoto = capturedPhotos[capturedPhotos.length - 1];
      let dYaw = Math.abs(currentYaw - lastPhoto.angle);
      if (dYaw > 180) dYaw = 360 - dYaw;
      const dPitch = Math.abs(currentPitch - lastPhoto.pitch);
      const angularDist = Math.sqrt(dYaw * dYaw + dPitch * dPitch);
      if (angularDist < 10) {
        // Less than 10° from last capture — warn but still allow manual trigger
        // (auto-lock will naturally not fire since targets are 22.5°+ apart)
      }
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

  // ─── Auto-Snap Lock Timer with Gradual Decay ──────────────────────────────
  // Instead of hard-resetting to 0 on brief misalignment (which punishes natural hand shake),
  // decay gradually: lose 10% per tick when misaligned, gain 25% per tick when aligned.
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || !scanStarted || cameraError || isCapturing || reviewMode || allCaptured) {
      setAutoLockProgress(0);
      return;
    }

    const timer = setInterval(() => {
      setAutoLockProgress(prev => {
        if (isAligned && frameQuality.isQualityOK && currentTarget && !currentTarget.captured) {
          // Aligned: ramp up
          if (prev >= 100) {
            captureForTarget(currentTarget.id);
            return 0;
          }
          return prev + 25;
        } else {
          // Misaligned: gradual decay instead of hard reset
          return Math.max(0, prev - 10);
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
              <button type="button"
                onClick={() => isTouchDevice && setInputMode('camera')}
                disabled={!isTouchDevice}
                title={!isTouchDevice ? 'Live scanning requires a mobile phone with gyroscope' : 'Use your phone camera to scan 360°'}
                className={`px-2 sm:px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 ${
                  !isTouchDevice
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : inputMode === 'camera' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}>
                <Camera size={11} /> Live {!isTouchDevice && '📱'}
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
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 backdrop-blur-md rounded-full border text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider max-w-[280px] sm:max-w-none truncate ${
              isAligned ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
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
                  {/* ─── Directional Text Overlay (NYC Pilot style) ─────────── */}
                  <div className="absolute top-4 left-0 right-0 z-30 flex justify-center pointer-events-none">
                    <div className={`px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md transition-all duration-300 ${
                      isAligned ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        : motionSpeed > 40 ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                        : 'bg-black/50 text-white border border-white/20'
                    }`}>
                      {guidanceText}
                    </div>
                  </div>
                  {/* Viewfinder reticle (AR Tracker) */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                    {/* Bounding Box */}
                    <div className={`relative w-[85%] max-w-xl aspect-[4/3] border-[3px] rounded-3xl transition-all duration-300 ${
                      isAligned
                        ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.6)] scale-[1.03]'
                        : (currentTarget && currentTarget.captured)
                          ? 'border-amber-400/50'
                          : 'border-white/50'
                    }`}>
                      {/* Corner Accents */}
                      <div className={`absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 rounded-tl-2xl ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
                      <div className={`absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 rounded-tr-2xl ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
                      <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 rounded-bl-2xl ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
                      <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 rounded-br-2xl ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />

                      {/* Central Reticle */}
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-[3px] rounded-full shadow-[0_0_15px_rgba(0,0,0,0.8)] transition-colors ${
                        isAligned ? 'border-emerald-400 bg-emerald-400/50 scale-125' : 'border-white'
                      }`} />
                    </div>

                    {/* Virtual AR Breadcrumb for Current Target */}
                    <div className="absolute inset-0 pointer-events-none">
                      {currentTarget && !currentTarget.captured && (() => {
                        const proj = projectTargetToScreen(currentTarget.yaw, currentTarget.pitch, currentYaw, currentPitch);
                        const isTargetAligned = proj.distance <= 10;

                        if (proj.clamped) {
                          // Render edge pointer arrow
                          return (
                            <div className="absolute w-10 h-10 -mt-5 -ml-5 flex items-center justify-center text-emerald-400 z-30 transition-transform duration-100 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                              style={{ left: `${proj.x}%`, top: `${proj.y}%`, transform: `rotate(${proj.angleToTarget}deg)` }}>
                              <Navigation size={32} className="fill-emerald-500 stroke-emerald-200" />
                            </div>
                          );
                        }

                        // Render target dot
                        return (
                          <div className={`absolute w-16 h-16 -mt-8 -ml-8 rounded-full flex flex-col items-center justify-center transition-all duration-100 z-20 ${
                            isTargetAligned ? 'bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,1)] scale-125 animate-pulse' : 'bg-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                          }`} style={{ left: `${proj.x}%`, top: `${proj.y}%` }}>
                            <div className="w-5 h-5 bg-white rounded-full shadow-inner mb-0.5" />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Horizon Level Line */}
                    <div className="absolute top-1/2 left-1/2 w-[85%] max-w-xl h-[1px] -translate-x-1/2 -translate-y-1/2 opacity-40">
                      <div className={`w-full h-full ${levelDelta > 15 ? 'bg-amber-400' : 'bg-emerald-400'} shadow-[0_0_10px_rgba(16,185,129,1)]`}
                        style={{ transform: `translateY(${Math.max(-80, Math.min(80, currentPitch * 3))}px) rotate(${-roll}deg)` }} />
                    </div>
                  </div>

                  {/* Shutter button with Auto-Lock Progress Ring */}
                  <div className="absolute bottom-3 left-0 right-0 z-30 flex items-center justify-center gap-3 pointer-events-auto">
                    <button type="button" onClick={handleManualCapture}
                      disabled={isCapturing || (currentTarget && currentTarget.captured) || capturedPhotos.length >= MAX_FRAMES}
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 backdrop-blur flex items-center justify-center transition-all duration-300 active:scale-95 ${
                        isCapturing || isAligned
                          ? 'bg-emerald-500/80 border-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-105'
                          : (currentTarget && currentTarget.captured)
                            ? 'bg-amber-500/30 border-amber-400/50 cursor-not-allowed'
                            : 'bg-white/20 border-white/80 hover:bg-white/40'
                      } disabled:opacity-50`}>
                      {isCapturing ? (
                        <RefreshCw className="animate-spin text-white" size={22} />
                      ) : (
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white transition-all flex items-center justify-center">
                          {autoLockProgress > 0 && (
                            <span className="text-[9px] font-black text-slate-900">{autoLockProgress}%</span>
                          )}
                        </div>
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
                    <h3 className="text-white font-black text-sm sm:text-base">360° Room Scanner — Room {roomIndex}</h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed max-w-[280px] mx-auto">
                      {isSensorAvailable ? (
                        <>Stand at the <strong className="text-white">center of the room</strong>. Rotate slowly — green dots will guide you. Photos capture automatically when aligned.</>
                      ) : (
                        <>Point your webcam at the room. <strong className="text-white">Click and drag</strong> the camera feed to rotate the virtual compass, or <strong className="text-white">click target dots</strong> on the radar to capture manually. Shoot all photos from the same spot.</>
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

            {/* ─── Right Pane: Heading-Up Compass Radar + Progress ────── */}
            <div className="w-full lg:w-96 bg-slate-900 p-3 sm:p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar shrink-0">
              <div>
                <div className="text-center mb-3 sm:mb-4">
                  <button type="button" onClick={() => setCompassCollapsed(prev => !prev)}
                    className="w-full flex items-center justify-center gap-1.5 text-white font-black text-sm sm:text-base mb-0.5 hover:text-blue-300 transition">
                    <Compass size={16} className="text-blue-400" /> Heading-Up Compass Radar
                    <span className="text-[10px] text-slate-500 ml-1">{compassCollapsed ? '▸ Show' : '▾ Hide'}</span>
                  </button>
                  {!compassCollapsed && (
                    <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed">
                      {inputMode === 'camera'
                        ? isSensorAvailable
                          ? 'Rotate slowly. Top of radar is your view direction.'
                          : 'Click target dots below or drag camera feed to steer.'
                        : 'Upload 360° video to extract spatial frames.'}
                    </p>
                  )}
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

                {/* Heading-Up Rotating Compass Radar View (collapsible) */}
                {inputMode === 'camera' && scanStarted && !compassCollapsed && (
                  <div className="mb-3 flex justify-center py-2 bg-slate-950/50 rounded-2xl border border-slate-800 transition-all duration-300">
                    <div className="w-full max-w-[200px] aspect-square relative">
                      <CompassRadar targets={targets} angle={currentYaw} onTargetClick={captureForTarget} size={200} />
                    </div>
                  </div>
                )}

                {/* Motion indicator */}
                {scanStarted && inputMode === 'camera' && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3 mb-3">
                    <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
                      <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Zap size={10} className="text-blue-400" /> Motion Speed
                      </span>
                      <span className={`font-extrabold ${motionSpeed > 40 ? 'text-amber-400' : motionSpeed > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {motionSpeed > 40 ? 'Too Fast' : motionSpeed > 0 ? 'Moving' : 'Still'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-200 ${motionSpeed > 40 ? 'bg-amber-500' : 'bg-blue-500'}`}
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
                    capturedCount >= MIN_FRAMES
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}>
                  {isProcessing ? (<><RefreshCw size={14} className="animate-spin" /> Processing...</>) : (<><CheckCircle2 size={14} /> Review & Stitch ({capturedCount})</>)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
