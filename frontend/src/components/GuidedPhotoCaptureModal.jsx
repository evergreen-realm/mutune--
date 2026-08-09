import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, UploadCloud, AlertTriangle, Navigation, Zap, Film, FileVideo, Settings2, Play, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';
import { useCameraMotion } from '../hooks/useCameraMotion';
import { useCameraDevices } from '../hooks/useCameraDevices';
import { analyzeFrameQuality } from '../utils/frameQualityAnalyzer';
import { extractFramesFromVideo } from '../utils/videoFrameExtractor';

// Helper to convert base64 data URL to File safely
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
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    throw new Error('Failed to decode image buffer from camera feed.');
  }
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
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Ignore audio context restrictions
  }
};

// Displacement threshold (in cumulative px) between auto-captures
const CAPTURE_DISPLACEMENT_THRESHOLD = 40;
const MIN_FRAMES = 16;
const MAX_FRAMES = 32;

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const webcamRef = useRef(null);
  const videoPlayerRef = useRef(null);

  const [inputMode, setInputMode] = useState('camera'); // 'camera' | 'video'
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [frameQuality, setFrameQuality] = useState({ isQualityOK: true, message: 'Calibrating...' });
  const [scanStarted, setScanStarted] = useState(false);

  // Camera WebRTC Resilient State
  const [cameraError, setCameraError] = useState(false);
  const [useGenericFallback, setUseGenericFallback] = useState(false);

  // Video File Mode State
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState(null);
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);
  const [videoExtractionProgress, setVideoExtractionProgress] = useState(0);

  // Bug 4 fix: capture-in-flight guard ref
  const captureInFlightRef = useRef(false);
  // Track last displacement that triggered a capture
  const lastCaptureDisp = useRef(0);

  // Camera Devices Enumeration Hook
  const {
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices
  } = useCameraDevices(isOpen && inputMode === 'camera');

  // Integrated Sensor & Optical Motion Tracker Hook
  const {
    angle,
    pitch,
    roll,
    motionSpeed,
    isSensorAvailable,
    displacement,
    requestSensorPermission,
    resetDisplacement
  } = useCameraMotion(isOpen && inputMode === 'camera' && scanStarted, webcamRef);

  // Compute video constraints dynamically (Rule §14: soft ideal constraints)
  const getVideoConstraints = () => {
    if (useGenericFallback) {
      return true; // Generic stream fallback
    }
    if (selectedDeviceId) {
      return { deviceId: { exact: selectedDeviceId } };
    }
    return { facingMode: { ideal: 'environment' } };
  };

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setCameraError(false);
      setUseGenericFallback(false);
      setScanStarted(false);
      setCapturedPhotos([]);
      lastCaptureDisp.current = 0;
      refreshDevices();
    } else {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
        setVideoObjectUrl(null);
      }
      setSelectedVideoFile(null);
      setIsExtractingVideo(false);
      setScanStarted(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Real-time Frame Quality Analysis Loop
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || cameraError || !scanStarted) return;

    const interval = setInterval(() => {
      if (webcamRef.current?.video) {
        const quality = analyzeFrameQuality(webcamRef.current.video);
        setFrameQuality(quality);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isOpen, inputMode, cameraError, scanStarted]);

  // Handle WebRTC Camera Errors safely
  const handleUserMediaError = useCallback((err) => {
    console.warn('Webcam stream error:', err);
    setCameraError(true);
  }, []);

  // Handle Live Camera Snapshot Capture (Bug 4: guarded with ref)
  const handleCapture = useCallback(async () => {
    if (captureInFlightRef.current) return;
    if (capturedPhotos.length >= MAX_FRAMES) {
      toast.info(`Maximum ${MAX_FRAMES} frames captured.`);
      return;
    }

    captureInFlightRef.current = true;
    setIsCapturing(true);
    try {
      let imageSrc = webcamRef.current?.getScreenshot?.();

      // Fallback: Direct HTML5 Canvas frame extraction
      if (!imageSrc && webcamRef.current?.video) {
        const videoEl = webcamRef.current.video;
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoEl, 0, 0);
          imageSrc = canvas.toDataURL('image/jpeg', 0.92);
        }
      }

      if (!imageSrc) {
        throw new Error('Could not capture frame from webcam feed.');
      }

      const frameIndex = capturedPhotos.length;
      const file = dataURLtoFile(imageSrc, `scan_frame_${frameIndex + 1}_${Date.now()}.jpg`);

      const res = await uploadDoc(file);
      if (res?.success && res.url) {
        setCapturedPhotos(prev => [
          ...prev,
          {
            url: res.url,
            frameIndex,
            angle: Math.round(angle),
            pitch: Math.round(pitch),
            roll: Math.round(roll),
            displacement: Math.round(displacement.total)
          }
        ]);

        playChimeSound();
        if (navigator.vibrate) navigator.vibrate(80);
        toast.success(`Frame ${frameIndex + 1} captured!`, { autoClose: 1200 });
      }
    } catch (err) {
      toast.error('Capture failed: ' + err.message);
    } finally {
      setIsCapturing(false);
      captureInFlightRef.current = false;
    }
  }, [angle, capturedPhotos.length, displacement.total, pitch, roll]);

  // Bug 3: Auto-capture based on continuous displacement (not sector alignment)
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || cameraError || !scanStarted) return;
    if (capturedPhotos.length >= MAX_FRAMES) return;
    if (!frameQuality.isQualityOK) return;
    if (motionSpeed > 60) return; // Moving too fast

    const dispSinceLastCapture = displacement.total - lastCaptureDisp.current;

    if (dispSinceLastCapture >= CAPTURE_DISPLACEMENT_THRESHOLD) {
      lastCaptureDisp.current = displacement.total;
      handleCapture();
    }
  }, [displacement.total, isOpen, inputMode, cameraError, scanStarted, capturedPhotos.length, frameQuality.isQualityOK, motionSpeed, handleCapture]);

  // Handle Start Scanning (Bug 2: iOS permission from user gesture)
  const handleStartScan = useCallback(async () => {
    const granted = await requestSensorPermission();
    if (granted || !isSensorAvailable) {
      // Either permission granted or no sensor (desktop) — proceed
      resetDisplacement();
      setScanStarted(true);
      lastCaptureDisp.current = 0;
      setCapturedPhotos([]);
    }
  }, [requestSensorPermission, isSensorAvailable, resetDisplacement]);

  // Handle Video File Selection
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

  // Process Video File into Spatial Sector Frames
  const handleExtractVideoFrames = async () => {
    if (!selectedVideoFile) {
      toast.error('Please upload a 360° video file first.');
      return;
    }

    setIsExtractingVideo(true);
    setVideoExtractionProgress(0);

    try {
      const frames = await extractFramesFromVideo(selectedVideoFile, (percent) => {
        setVideoExtractionProgress(percent);
      }, MIN_FRAMES);

      setCapturedPhotos(frames);
      playChimeSound();
      toast.success('🎉 Extracted spatial scans from video!');
    } catch (err) {
      toast.error('Failed to process video: ' + err.message);
    } finally {
      setIsExtractingVideo(false);
    }
  };

  // Finalize Submission
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

  // Guidance status calculation
  const progressPercent = Math.round((capturedPhotos.length / MIN_FRAMES) * 100);
  let guidanceMessage = '';
  let statusBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  if (inputMode === 'video') {
    guidanceMessage = selectedVideoFile
      ? `Video: ${selectedVideoFile.name}`
      : 'Upload a 360° video file';
    statusBadgeColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  } else if (cameraError) {
    guidanceMessage = 'Camera unavailable — select device or retry';
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (!scanStarted) {
    guidanceMessage = 'Tap Start to begin scanning';
    statusBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  } else if (motionSpeed > 60) {
    guidanceMessage = '⚠️ Moving too fast — slow down';
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (!frameQuality.isQualityOK) {
    guidanceMessage = `⚠️ ${frameQuality.message}`;
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (capturedPhotos.length >= MIN_FRAMES) {
    guidanceMessage = `✅ ${capturedPhotos.length} frames — ready to generate!`;
    statusBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  } else {
    guidanceMessage = `Scanning... ${capturedPhotos.length}/${MIN_FRAMES} frames`;
    statusBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto p-1.5 sm:p-3 flex items-center justify-center bg-slate-950/85 backdrop-blur-lg custom-scrollbar">
      {/* Backdrop click handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container — Bug 5 fix: removed overflow-hidden, adjusted max-h */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[97vh] my-auto z-10">

        {/* Top Control Header */}
        <div className="w-full bg-slate-900/90 border-b border-slate-800 px-2.5 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-1.5 z-30 shrink-0 rounded-t-2xl sm:rounded-t-3xl">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Input Mode Tabs */}
            <div className="bg-black/60 p-0.5 sm:p-1 rounded-full border border-white/10 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setInputMode('camera')}
                className={`px-2 sm:px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 ${
                  inputMode === 'camera'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera size={11} /> Live
              </button>
              <button
                type="button"
                onClick={() => setInputMode('video')}
                className={`px-2 sm:px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 ${
                  inputMode === 'video'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film size={11} /> Video
              </button>
            </div>

            {/* Camera Device Dropdown */}
            {inputMode === 'camera' && !cameraError && videoDevices.length > 1 && (
              <div className="bg-black/60 px-2 py-1 rounded-full border border-white/10 flex items-center gap-1">
                <Settings2 size={10} className="text-blue-400" />
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    setUseGenericFallback(false);
                  }}
                  className="bg-transparent text-white text-[9px] font-bold focus:outline-none cursor-pointer max-w-[100px]"
                >
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
            <div className={`px-2 py-0.5 sm:px-3 sm:py-1 backdrop-blur-md rounded-full border text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider ${statusBadgeColor} max-w-[200px] sm:max-w-none truncate`}>
              {guidanceMessage}
            </div>

            <button
              onClick={onClose}
              title="Close modal"
              className="p-1.5 sm:p-2 bg-black/70 hover:bg-white/20 rounded-full border border-white/10 text-white transition flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto custom-scrollbar min-h-0">

          {/* Left Pane: Live Camera OR Video Player */}
          <div className="flex-1 relative bg-black flex flex-col items-center justify-center min-h-[220px] sm:min-h-[300px] lg:min-h-[400px] border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">

            {inputMode === 'camera' ? (
              cameraError ? (
                /* Camera Error & Recovery */
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-center space-y-3 z-10">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-extrabold text-sm mb-1">Camera Unavailable</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed max-w-xs mx-auto">
                      Select a device or use generic fallback.
                    </p>
                  </div>

                  {videoDevices.length > 0 && (
                    <div className="w-full max-w-xs space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Select Camera
                      </label>
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          setUseGenericFallback(false);
                          setCameraError(false);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {videoDevices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {d.label || `Camera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUseGenericFallback(true);
                        setCameraError(false);
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl transition shadow"
                    >
                      Try Default Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('video')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl transition border border-slate-700"
                    >
                      Switch to Video
                    </button>
                  </div>
                </div>
              ) : (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={getVideoConstraints()}
                  onUserMediaError={handleUserMediaError}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950">
                {videoObjectUrl ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <video
                      ref={videoPlayerRef}
                      src={videoObjectUrl}
                      controls
                      playsInline
                      className="max-h-[250px] sm:max-h-[320px] w-full rounded-2xl border border-slate-800 object-contain shadow-lg"
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExtractVideoFrames}
                        disabled={isExtractingVideo}
                        className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-2"
                      >
                        {isExtractingVideo ? (
                          <><RefreshCw size={14} className="animate-spin" /> {videoExtractionProgress}%</>
                        ) : (
                          <><Film size={14} /> Extract Frames</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-300 max-w-sm w-full bg-slate-900/50 hover:bg-slate-900 group">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                    <FileVideo size={32} className="mx-auto text-slate-500 group-hover:text-blue-400 mb-2 transition" />
                    <h4 className="text-white font-extrabold text-xs sm:text-sm mb-1">Upload 360° Room Video</h4>
                    <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed mb-2">
                      MP4 or WebM format. Frames will be extracted automatically.
                    </p>
                    <span className="inline-block px-3 py-1.5 bg-blue-600 text-white font-bold text-[10px] rounded-xl shadow-md group-hover:bg-blue-500 transition">
                      Browse File
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Reticle Overlay (camera mode + scan started + stream active) */}
            {inputMode === 'camera' && !cameraError && scanStarted && (
              <>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 border-2 rounded-2xl sm:rounded-3xl relative flex flex-col items-center justify-center transition-all duration-200 ${
                      isCapturing
                        ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105'
                        : 'border-white/30'
                    }`}
                  >
                    <div className={`absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-l-4 rounded-tl-2xl sm:rounded-tl-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />
                    <div className={`absolute top-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-t-4 border-r-4 rounded-tr-2xl sm:rounded-tr-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />
                    <div className={`absolute bottom-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-l-4 rounded-bl-2xl sm:rounded-bl-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />
                    <div className={`absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-4 border-r-4 rounded-br-2xl sm:rounded-br-3xl transition-colors ${isCapturing ? 'border-emerald-400' : 'border-blue-400'}`} />

                    {/* Artificial Horizon */}
                    <div
                      className="absolute inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent transition-transform duration-100 ease-out"
                      style={{
                        transform: `translateY(${Math.max(-60, Math.min(60, pitch * 1.5))}px) rotate(${-roll}deg)`
                      }}
                    />
                    <div className="absolute inset-y-3 w-[1px] bg-emerald-400/40" />

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 transition-all duration-300 ${isCapturing ? 'bg-emerald-400 border-white scale-125 shadow-[0_0_15px_rgba(16,185,129,0.9)]' : 'bg-blue-500/50 border-blue-400'}`} />
                    </div>
                  </div>
                </div>

                {/* Manual Shutter Button */}
                <div className="absolute bottom-3 left-0 right-0 z-30 flex items-center justify-center gap-3 pointer-events-auto">
                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={isCapturing || capturedPhotos.length >= MAX_FRAMES}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 backdrop-blur flex items-center justify-center transition-all duration-300 active:scale-95 ${
                      isCapturing
                        ? 'bg-emerald-500/80 border-emerald-300'
                        : 'bg-white/20 border-white/80 hover:bg-white/40'
                    } disabled:opacity-50`}
                  >
                    {isCapturing ? (
                      <RefreshCw className="animate-spin text-white" size={20} />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white transition-all" />
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Start Scanning Button (shown before scan starts — Bug 2: iOS permission from gesture) */}
            {inputMode === 'camera' && !cameraError && !scanStarted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="text-center space-y-3 p-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                    <Navigation size={28} className="text-blue-400" />
                  </div>
                  <h3 className="text-white font-black text-sm sm:text-base">Ready to Scan</h3>
                  <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed max-w-[260px] mx-auto">
                    Walk slowly around the room. Frames will auto-capture as you move. You can also tap the shutter manually.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartScan}
                    className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center gap-2 mx-auto"
                  >
                    <Play size={16} /> Start Scanning
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Pane: Progress & Controls (Bug 3: replaced radar with progress tracker) */}
          <div className="w-full lg:w-80 bg-slate-900 p-3 sm:p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar shrink-0">
            <div>
              <div className="text-center mb-3 sm:mb-4">
                <h3 className="text-white font-black text-sm sm:text-base mb-0.5 flex items-center justify-center gap-1.5">
                  <Navigation size={15} className="text-blue-400" /> Room Scanner
                </h3>
                <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed">
                  {inputMode === 'camera'
                    ? 'Walk around the room slowly. Auto-captures at each movement threshold.'
                    : 'Upload 360° video to extract spatial frames.'}
                </p>
              </div>

              {/* Captured Frames Grid */}
              <div className="grid grid-cols-4 gap-1.5 mb-3 sm:mb-4">
                {Array.from({ length: Math.max(MIN_FRAMES, capturedPhotos.length) }).map((_, idx) => {
                  const photo = capturedPhotos[idx];
                  return (
                    <div
                      key={idx}
                      className={`aspect-square rounded-lg sm:rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                        photo
                          ? 'border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                          : idx === capturedPhotos.length
                            ? 'border-amber-400/60 bg-amber-400/5 animate-pulse'
                            : 'border-slate-800 bg-slate-800/30'
                      }`}
                    >
                      {photo ? (
                        <img
                          src={photo.url}
                          alt={`Frame ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className={`text-[9px] font-black ${idx === capturedPhotos.length ? 'text-amber-400' : 'text-slate-600'}`}>
                            {idx + 1}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Motion Indicator */}
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
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${motionSpeed > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, motionSpeed)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom: Progress + Actions */}
            <div className="space-y-2.5 sm:space-y-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 sm:p-3">
                <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider">Frames Captured</span>
                  <span className={`font-extrabold ${capturedPhotos.length >= MIN_FRAMES ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {capturedPhotos.length}/{MIN_FRAMES}+
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      capturedPhotos.length >= MIN_FRAMES
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400'
                    }`}
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={handleFinish}
                disabled={isProcessing || capturedPhotos.length < MIN_FRAMES}
                className={`w-full py-2.5 sm:py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 ${
                  capturedPhotos.length >= MIN_FRAMES
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                ) : (
                  <><UploadCloud size={14} /> Generate 3D Model</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
