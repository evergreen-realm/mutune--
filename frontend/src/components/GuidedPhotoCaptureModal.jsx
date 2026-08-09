import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, UploadCloud, AlertTriangle, Navigation, Zap, Film, FileVideo, Settings2, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';
import { useCameraMotion } from '../hooks/useCameraMotion';
import { useCameraDevices } from '../hooks/useCameraDevices';
import { analyzeFrameQuality } from '../utils/frameQualityAnalyzer';
import { extractFramesFromVideo } from '../utils/videoFrameExtractor';

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTOR_COUNT = 16;
const SECTOR_SIZE = 360 / SECTOR_COUNT; // 22.5° per sector
const MIN_FRAMES = 16;
const MAX_FRAMES = 32;

// Direction labels for each of the 16 sectors
const SECTOR_LABELS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

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

  // 16-sector tracking state
  const [sectors, setSectors] = useState(() =>
    Array.from({ length: SECTOR_COUNT }, (_, i) => ({
      id: i,
      centerAngle: i * SECTOR_SIZE,
      captured: false,
      photoUrl: null
    }))
  );

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

  // Motion Tracker Hook
  const {
    angle, pitch, roll, motionSpeed, isSensorAvailable, displacement,
    currentSector, requestSensorPermission, resetDisplacement
  } = useCameraMotion(isOpen && inputMode === 'camera' && scanStarted, webcamRef);

  // Computed values
  const capturedCount = useMemo(() => sectors.filter(s => s.captured).length, [sectors]);
  const allCaptured = capturedCount >= MIN_FRAMES;
  const nextUncaptured = useMemo(() => {
    // Find the nearest uncaptured sector from current position
    for (let offset = 0; offset < SECTOR_COUNT; offset++) {
      const idx = (currentSector + offset) % SECTOR_COUNT;
      if (!sectors[idx].captured) return idx;
    }
    return -1;
  }, [sectors, currentSector]);

  // Guidance text
  const guidanceText = useMemo(() => {
    if (!scanStarted) return 'Tap Start to begin scanning';
    if (cameraError) return 'Camera unavailable — select device or retry';
    if (motionSpeed > 60) return '⚠️ Moving too fast — slow down';
    if (!frameQuality.isQualityOK) return `⚠️ ${frameQuality.message}`;
    if (allCaptured) return `✅ All ${capturedCount} angles captured — ready to generate!`;
    
    const currentIsCaptured = sectors[currentSector]?.captured;
    if (currentIsCaptured && nextUncaptured >= 0) {
      const targetAngle = Math.round(nextUncaptured * SECTOR_SIZE);
      return `↻ Rotate to ${SECTOR_LABELS[nextUncaptured]} (${targetAngle}°) — this angle is done`;
    }
    return `Aiming at ${SECTOR_LABELS[currentSector]} — hold steady to capture (${capturedCount}/${MIN_FRAMES})`;
  }, [scanStarted, cameraError, motionSpeed, frameQuality, allCaptured, capturedCount, currentSector, sectors, nextUncaptured]);

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
      setCapturedPhotos([]);
      setSectors(Array.from({ length: SECTOR_COUNT }, (_, i) => ({
        id: i, centerAngle: i * SECTOR_SIZE, captured: false, photoUrl: null
      })));
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
    if (!isOpen || inputMode !== 'camera' || cameraError || !scanStarted) return;
    const interval = setInterval(() => {
      if (webcamRef.current?.video) {
        setFrameQuality(analyzeFrameQuality(webcamRef.current.video));
      }
    }, 120);
    return () => clearInterval(interval);
  }, [isOpen, inputMode, cameraError, scanStarted]);

  // ─── Capture Logic ────────────────────────────────────────────────────────

  const captureForSector = useCallback(async (sectorIdx) => {
    if (captureInFlightRef.current) return;
    if (sectors[sectorIdx]?.captured) {
      toast.info(`Sector ${SECTOR_LABELS[sectorIdx]} already captured`);
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

      const file = dataURLtoFile(imageSrc, `scan_sector_${sectorIdx}_${SECTOR_LABELS[sectorIdx]}_${Date.now()}.jpg`);
      const res = await uploadDoc(file);

      if (res?.success && res.url) {
        // Mark sector as captured
        setSectors(prev => prev.map((s, i) =>
          i === sectorIdx ? { ...s, captured: true, photoUrl: res.url } : s
        ));
        setCapturedPhotos(prev => [
          ...prev,
          {
            url: res.url,
            sectorIndex: sectorIdx,
            sectorLabel: SECTOR_LABELS[sectorIdx],
            angle: Math.round(angle),
            pitch: Math.round(pitch),
            roll: Math.round(roll)
          }
        ]);

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

  // ─── Auto-Capture: Dwell timer on uncaptured sectors ──────────────────────
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || !scanStarted || cameraError) return;
    if (!frameQuality.isQualityOK || motionSpeed > 30) {
      // Clear dwell if moving too fast or quality is bad
      if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
      dwellSectorRef.current = -1;
      return;
    }

    const targetSector = currentSector;
    const sectorData = sectors[targetSector];
    if (!sectorData || sectorData.captured || capturedPhotos.length >= MAX_FRAMES) {
      if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
      dwellSectorRef.current = -1;
      return;
    }

    // If we're still on the same uncaptured sector, let the timer run
    if (dwellSectorRef.current === targetSector) return;

    // New uncaptured sector — start dwell timer
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellSectorRef.current = targetSector;
    dwellTimerRef.current = setTimeout(() => {
      captureForSector(targetSector);
      dwellSectorRef.current = -1;
      dwellTimerRef.current = null;
    }, AUTO_CAPTURE_DWELL_MS);

    return () => {
      // Don't clear on every render — only clear if sector changes (handled above)
    };
  }, [currentSector, isOpen, inputMode, scanStarted, cameraError, frameQuality.isQualityOK, motionSpeed, sectors, capturedPhotos.length, captureForSector]);

  // ─── Start Scan (iOS permission from gesture — Rule §17) ──────────────────
  const handleStartScan = useCallback(async () => {
    const granted = await requestSensorPermission();
    if (granted || !isSensorAvailable) {
      resetDisplacement();
      setScanStarted(true);
      setCapturedPhotos([]);
      setSectors(Array.from({ length: SECTOR_COUNT }, (_, i) => ({
        id: i, centerAngle: i * SECTOR_SIZE, captured: false, photoUrl: null
      })));
    }
  }, [requestSensorPermission, isSensorAvailable, resetDisplacement]);

  // ─── Desktop manual sector click ──────────────────────────────────────────
  const handleDesktopSectorClick = useCallback((sectorIdx) => {
    if (scanStarted) {
      captureForSector(sectorIdx);
    }
  }, [scanStarted, captureForSector]);

  // ─── Manual shutter (captures current sector) ─────────────────────────────
  const handleManualCapture = useCallback(() => {
    captureForSector(currentSector);
  }, [captureForSector, currentSector]);

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
      const frames = await extractFramesFromVideo(selectedVideoFile, (p) => setVideoExtractionProgress(p), MIN_FRAMES);
      setCapturedPhotos(frames);
      // Mark all sectors as captured for video mode
      setSectors(prev => prev.map(s => ({ ...s, captured: true })));
      playChimeSound();
      toast.success('🎉 Extracted spatial scans from video!');
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

  const progressPercent = Math.round((capturedCount / MIN_FRAMES) * 100);
  const currentSectorIsCaptured = sectors[currentSector]?.captured;

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
                {/* Viewfinder reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className={`w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 border-2 rounded-2xl sm:rounded-3xl relative flex flex-col items-center justify-center transition-all duration-200 ${
                    isCapturing ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105'
                      : currentSectorIsCaptured ? 'border-amber-400/50' : 'border-white/30'
                  }`}>
                    {/* Corner brackets */}
                    <div className={`absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-l-4 rounded-tl-2xl sm:rounded-tl-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />
                    <div className={`absolute top-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-r-4 rounded-tr-2xl sm:rounded-tr-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />
                    <div className={`absolute bottom-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-l-4 rounded-bl-2xl sm:rounded-bl-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />
                    <div className={`absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-r-4 rounded-br-2xl sm:rounded-br-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />

                    {/* Artificial horizon */}
                    <div className="absolute inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent transition-transform duration-100 ease-out"
                      style={{ transform: `translateY(${Math.max(-60, Math.min(60, pitch * 1.5))}px) rotate(${-roll}deg)` }} />
                    <div className="absolute inset-y-3 w-[1px] bg-emerald-400/40" />

                    {/* Center crosshair */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 transition-all duration-300 ${
                        isCapturing ? 'bg-emerald-400 border-white scale-125 shadow-[0_0_15px_rgba(16,185,129,0.9)]'
                          : currentSectorIsCaptured ? 'bg-amber-500/50 border-amber-400' : 'bg-blue-500/50 border-blue-400'
                      }`} />
                    </div>

                    {/* Sector label in viewfinder */}
                    <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        currentSectorIsCaptured
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {SECTOR_LABELS[currentSector]} ({Math.round(angle)}°)
                        {currentSectorIsCaptured ? ' ✓' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Shutter button */}
                <div className="absolute bottom-3 left-0 right-0 z-30 flex items-center justify-center gap-3 pointer-events-auto">
                  <button type="button" onClick={handleManualCapture}
                    disabled={isCapturing || currentSectorIsCaptured || capturedPhotos.length >= MAX_FRAMES}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 backdrop-blur flex items-center justify-center transition-all duration-300 active:scale-95 ${
                      isCapturing ? 'bg-emerald-500/80 border-emerald-300'
                        : currentSectorIsCaptured ? 'bg-amber-500/30 border-amber-400/50 cursor-not-allowed'
                        : 'bg-white/20 border-white/80 hover:bg-white/40'
                    } disabled:opacity-50`}>
                    {isCapturing ? (
                      <RefreshCw className="animate-spin text-white" size={20} />
                    ) : currentSectorIsCaptured ? (
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

              {/* Compass Radar (mobile/sensor available) */}
              {inputMode === 'camera' && scanStarted && isSensorAvailable && (
                <div className="flex justify-center mb-3 sm:mb-4">
                  <CompassRadar sectors={sectors} currentSector={currentSector} angle={angle} size={200} />
                </div>
              )}

              {/* Desktop Sector Grid (no sensor) */}
              {inputMode === 'camera' && scanStarted && !isSensorAvailable && (
                <div className="mb-3 sm:mb-4">
                  <DesktopSectorSelector sectors={sectors} onSectorClick={handleDesktopSectorClick} />
                </div>
              )}

              {/* Compact compass for mobile when sensor is available */}
              {inputMode === 'camera' && scanStarted && isSensorAvailable && (
                <div className="grid grid-cols-8 gap-1 mb-3">
                  {sectors.map((sector, i) => (
                    <div key={i} className={`aspect-square rounded-md border flex items-center justify-center text-[8px] font-black transition-all ${
                      sector.captured
                        ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : i === currentSector
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400'
                          : 'border-slate-700 bg-slate-800/50 text-slate-500'
                    }`}>
                      {sector.captured ? '✓' : SECTOR_LABELS[i]}
                    </div>
                  ))}
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
                  <span className="text-slate-400 uppercase tracking-wider">Sectors Captured</span>
                  <span className={`font-extrabold ${allCaptured ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {capturedCount}/{MIN_FRAMES}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 rounded-full ${
                    allCaptured ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400'
                  }`} style={{ width: `${Math.min(100, progressPercent)}%` }} />
                </div>
              </div>

              <button onClick={handleFinish}
                disabled={isProcessing || capturedCount < MIN_FRAMES}
                className={`w-full py-2.5 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 ${
                  allCaptured
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}>
                {isProcessing ? (<><RefreshCw size={14} className="animate-spin" /> Processing...</>) : (<><UploadCloud size={14} /> Generate 3D Model</>)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
