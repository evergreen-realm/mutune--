import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCw, UploadCloud, AlertTriangle, Navigation, Compass, Zap, Film, FileVideo, Video, Settings2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { uploadDoc } from '../lib/api';
import { useCameraMotion } from '../hooks/useCameraMotion';
import { useCameraDevices } from '../hooks/useCameraDevices';
import { analyzeFrameQuality } from '../utils/frameQualityAnalyzer';
import { extractFramesFromVideo } from '../utils/videoFrameExtractor';

// Helper to convert base64 data URL to File safely without throwing null dereference errors
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

export default function GuidedPhotoCaptureModal({ isOpen, onClose, onComplete }) {
  const webcamRef = useRef(null);
  const videoPlayerRef = useRef(null);

  const [inputMode, setInputMode] = useState('camera'); // 'camera' | 'video'
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [activeSectorIndex, setActiveSectorIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoLockProgress, setAutoLockProgress] = useState(0);
  const [frameQuality, setFrameQuality] = useState({ isQualityOK: true, message: 'Calibrating...' });
  
  // Camera WebRTC Resilient State
  const [cameraError, setCameraError] = useState(false);
  const [useGenericFallback, setUseGenericFallback] = useState(false);

  // Video File Mode State
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState(null);
  const [isExtractingVideo, setIsExtractingVideo] = useState(false);
  const [videoExtractionProgress, setVideoExtractionProgress] = useState(0);

  const TOTAL_SECTORS = 16;
  const SECTOR_ANGLE_STEP = 360 / TOTAL_SECTORS; // 22.5 degrees

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
    requestSensorPermission
  } = useCameraMotion(isOpen && inputMode === 'camera', webcamRef);

  // Target angle for current active sector
  const targetAngle = activeSectorIndex * SECTOR_ANGLE_STEP;

  // Calculate angular distance to active target sector
  const rawAngleDiff = Math.abs(angle - targetAngle) % 360;
  const angleDelta = rawAngleDiff > 180 ? 360 - rawAngleDiff : rawAngleDiff;
  const levelDelta = Math.abs(pitch) + Math.abs(roll);

  // Sector alignment check (within ±8.5° of target and camera held level)
  const isAligned = angleDelta <= 8.5 && levelDelta <= 15 && motionSpeed < 35;

  // Compute video constraints dynamically
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
      requestSensorPermission();
      refreshDevices();
    } else {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
        setVideoObjectUrl(null);
      }
      setSelectedVideoFile(null);
      setIsExtractingVideo(false);
    }
  }, [isOpen, requestSensorPermission, refreshDevices, videoObjectUrl]);

  // Real-time Frame Quality Analysis Loop
  useEffect(() => {
    if (!isOpen || inputMode !== 'camera' || cameraError) return;

    const interval = setInterval(() => {
      if (webcamRef.current?.video) {
        const quality = analyzeFrameQuality(webcamRef.current.video);
        setFrameQuality(quality);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [isOpen, inputMode, cameraError]);

  // Handle WebRTC Camera Errors safely (In-Pane Recovery)
  const handleUserMediaError = useCallback((err) => {
    console.warn('Webcam stream error:', err);
    setCameraError(true);
  }, []);

  // Handle Live Camera Snapshot Capture
  const handleCapture = useCallback(async () => {
    if (capturedPhotos.length >= TOTAL_SECTORS) {
      toast.error(`All ${TOTAL_SECTORS} sectors captured!`);
      return;
    }

    setIsCapturing(true);
    try {
      let imageSrc = webcamRef.current?.getScreenshot?.();

      // Fallback: Direct HTML5 Canvas frame extraction if react-webcam getScreenshot() returns null
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
        throw new Error('Could not capture frame from webcam feed. Please check video stream initialization.');
      }

      const file = dataURLtoFile(imageSrc, `sector_${activeSectorIndex + 1}_${Date.now()}.jpg`);
      
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
    if (!isOpen || inputMode !== 'camera' || cameraError || isCapturing || capturedPhotos.length >= TOTAL_SECTORS) {
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
          return prev + 25;
        });
      }, 100);
    } else {
      setAutoLockProgress(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAligned, frameQuality.isQualityOK, isOpen, inputMode, cameraError, isCapturing, capturedPhotos.length, handleCapture]);

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

  // Process Video File into 16 Spatial Sector Frames
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
      }, TOTAL_SECTORS);

      setCapturedPhotos(frames);
      playChimeSound();
      toast.success('🎉 Extracted 16 spatial sector scans from video!');
    } catch (err) {
      toast.error('Failed to process video: ' + err.message);
    } finally {
      setIsExtractingVideo(false);
    }
  };

  // Finalize Submission
  const handleFinish = async () => {
    if (capturedPhotos.length < TOTAL_SECTORS) {
      toast.error(`Please capture all ${TOTAL_SECTORS} sectors for an accurate 3D scan.`);
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
  let guidanceMessage = `Pan to Target Sector ${activeSectorIndex + 1} (${Math.round(targetAngle)}°)`;
  let statusBadgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  if (inputMode === 'video') {
    guidanceMessage = selectedVideoFile 
      ? `Video Selected: ${selectedVideoFile.name}` 
      : 'Upload a 360° MP4 video file to extract 16 spatial sector scans';
    statusBadgeColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  } else if (cameraError) {
    guidanceMessage = 'Camera restricted — select device or retry below';
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (motionSpeed > 40) {
    guidanceMessage = '⚠️ Moving too fast — hold steady!';
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (!frameQuality.isQualityOK) {
    guidanceMessage = `⚠️ ${frameQuality.message}`;
    statusBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  } else if (levelDelta > 15) {
    guidanceMessage = '📐 Tilt camera to level horizon';
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
        
        {/* Left Pane: Live Camera OR Video File Player */}
        <div className="flex-1 relative bg-black flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
          
          {inputMode === 'camera' ? (
            cameraError ? (
              /* In-Pane Camera Error & Recovery Viewport */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950 text-center space-y-4 z-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h4 className="text-white font-extrabold text-base mb-1">Camera Stream Unavailable</h4>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                    The requested camera constraints failed. Select a connected camera device or switch to generic stream fallback.
                  </p>
                </div>

                {videoDevices.length > 0 && (
                  <div className="w-full max-w-xs space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Select Camera Device
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

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseGenericFallback(true);
                      setCameraError(false);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow"
                  >
                    Try Default Camera ({'{ video: true }'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('video')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700"
                  >
                    Switch to 360° Video Upload
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950">
              {videoObjectUrl ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <video
                    ref={videoPlayerRef}
                    src={videoObjectUrl}
                    controls
                    playsInline
                    className="max-h-[380px] w-full rounded-2xl border border-slate-800 object-contain shadow-lg"
                  />
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleExtractVideoFrames}
                      disabled={isExtractingVideo}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-2"
                    >
                      {isExtractingVideo ? (
                        <><RefreshCw size={16} className="animate-spin" /> Processing Video ({videoExtractionProgress}%)...</>
                      ) : (
                        <><Film size={16} /> Extract 16 Spatial Sector Scans</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 max-w-md w-full bg-slate-900/50 hover:bg-slate-900 group">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  <FileVideo size={48} className="mx-auto text-slate-500 group-hover:text-blue-400 mb-3 transition" />
                  <h4 className="text-white font-extrabold text-sm mb-1">Upload 360° Room Video</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mb-4">
                    Select a pre-recorded MP4 video file. The system will extract 16 spatial sector frames automatically.
                  </p>
                  <span className="inline-block px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md group-hover:bg-blue-500 transition">
                    Browse Video File
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Header Mode Selector & Info */}
          <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Input Mode Tabs & Camera Selector */}
            <div className="pointer-events-auto bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/10 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setInputMode('camera')}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider transition flex items-center gap-1.5 ${
                  inputMode === 'camera'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera size={13} /> Live Camera
              </button>
              <button
                type="button"
                onClick={() => setInputMode('video')}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider transition flex items-center gap-1.5 ${
                  inputMode === 'video'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film size={13} /> Upload 360° Video
              </button>
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

          {/* Camera Device Dropdown Header (When Camera Available) */}
          {inputMode === 'camera' && !cameraError && videoDevices.length > 1 && (
            <div className="absolute top-16 left-4 z-20 pointer-events-auto bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
              <Settings2 size={12} className="text-blue-400" />
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  setUseGenericFallback(false);
                }}
                className="bg-transparent text-white text-[10px] font-bold focus:outline-none cursor-pointer"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId} className="bg-slate-900 text-white">
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reticle Overlay (Only in Camera mode when stream active) */}
          {inputMode === 'camera' && !cameraError && (
            <>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div 
                  className={`w-64 h-64 sm:w-72 sm:h-72 border-2 rounded-3xl relative flex flex-col items-center justify-center transition-all duration-200 ${
                    isAligned 
                      ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105' 
                      : 'border-white/30'
                  }`}
                >
                  <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
                  <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
                  <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />
                  <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-3xl transition-colors ${isAligned ? 'border-emerald-400' : 'border-blue-400'}`} />

                  {/* Artificial Horizon */}
                  <div 
                    className="absolute inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent transition-transform duration-100 ease-out"
                    style={{
                      transform: `translateY(${Math.max(-80, Math.min(80, pitch * 2))}px) rotate(${-roll}deg)`
                    }}
                  />
                  
                  <div className="absolute inset-y-4 w-[1px] bg-emerald-400/40" />

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${isAligned ? 'bg-emerald-400 border-white scale-125 shadow-[0_0_15px_rgba(16,185,129,0.9)]' : 'bg-blue-500/50 border-blue-400'}`} />
                  </div>
                </div>
              </div>

              {/* Shutter Button */}
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
                    <div className="w-10 h-10 rounded-full bg-white transition-all" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Pane: Radar & Guided Sector Progression */}
        <div className="w-full lg:w-88 bg-slate-900 p-6 flex flex-col justify-between overflow-y-auto">
          
          <div>
            <div className="text-center mb-6">
              <h3 className="text-white font-black text-lg mb-1 flex items-center justify-center gap-2">
                <Navigation size={18} className="text-blue-400" /> Live 360° Spatial Radar
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {inputMode === 'camera' 
                  ? 'Follow guided target sectors. Keep horizon level until target locks automatically.' 
                  : 'Upload 360° video file to extract 16 spatial sector scans across duration.'}
              </p>
            </div>

            {/* Radar Circular Visualizer */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
              <div className="absolute inset-4 rounded-full border border-slate-800/60" />
              <div className="absolute inset-8 rounded-full bg-slate-800/20" />
              
              <div className="absolute top-1/2 left-1/2 w-4 h-4 -mt-2 -ml-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10" />

              {/* Dynamic Camera FOV Sweep Cone */}
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

              {/* 16 Sector Nodes */}
              {Array.from({ length: TOTAL_SECTORS }).map((_, idx) => {
                const nodeAngle = idx * SECTOR_ANGLE_STEP;
                const rad = (nodeAngle - 90) * (Math.PI / 180);
                const r = 92;
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
