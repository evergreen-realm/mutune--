import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize, Minimize, Loader2 } from 'lucide-react';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

export default function SplatViewerModal({ isOpen, onClose, splatUrl, title = '3D Splat View' }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current || !splatUrl) return;

    let viewer;
    let isMounted = true;
    setProgress(0);
    setError(null);

    const initViewer = async () => {
      try {
        viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, -0.6],
          initialCameraPosition: [-1, -4, 6],
          initialCameraLookAt: [0, 4, 0],
          rootElement: containerRef.current,
          halfPrecisionVideoTexture: true,
        });
        viewerRef.current = viewer;

        await viewer.addSplatScene(splatUrl, {
          showLoadingUI: false,
          position: [0, 1, 0],
          rotation: [0, 0, 0, 1],
          scale: [1.5, 1.5, 1.5],
          onProgress: (percent) => {
            if (isMounted) setProgress(percent);
          }
        });

        if (isMounted) {
          viewer.start();
          setProgress(100);
        }
      } catch (err) {
        console.error('Failed to load splat:', err);
        if (isMounted) setError(err.message || 'Failed to load 3D scan');
      }
    };

    initViewer();

    return () => {
      isMounted = false;
      if (viewer) {
        try {
          viewer.dispose();
        } catch (e) {
          console.error("Error disposing viewer:", e);
        }
      }
    };
  }, [isOpen, splatUrl]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className={`relative bg-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ${
          isFullscreen ? 'w-full h-full rounded-none border-none' : 'w-full max-w-5xl h-[80vh]'
        }`}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="px-4 py-2 bg-black/40 backdrop-blur border border-white/10 rounded-2xl pointer-events-auto">
            <h3 className="text-white font-bold text-sm">{title}</h3>
          </div>
          
          <div className="flex items-center gap-2 pointer-events-auto">
            <button 
              onClick={toggleFullscreen}
              className="p-2.5 bg-black/40 backdrop-blur rounded-xl border border-white/10 text-white hover:bg-white/10 transition"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-black/40 backdrop-blur rounded-xl border border-white/10 text-white hover:bg-red-500/80 hover:border-red-500 transition"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {progress < 100 && !error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <Loader2 size={48} className="text-emerald-500 animate-spin mb-6" />
            <div className="text-emerald-400 font-bold tracking-widest uppercase text-sm mb-2">
              Loading Splat Data...
            </div>
            <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <X size={32} className="text-red-500" />
            </div>
            <h3 className="text-white font-black text-xl mb-2">Failed to Load Scan</h3>
            <p className="text-slate-400 text-sm max-w-md">{error}</p>
            <button 
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition"
            >
              Close Viewer
            </button>
          </div>
        )}

        {/* 3D Canvas Container */}
        <div ref={containerRef} className="w-full h-full bg-black outline-none" />

        {/* Controls Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-5 py-2.5 bg-black/60 backdrop-blur border border-white/10 rounded-full pointer-events-auto">
            <p className="text-white/70 text-xs font-semibold">
              <span className="text-white">Left Click</span> to Orbit • <span className="text-white">Right Click</span> to Pan • <span className="text-white">Scroll</span> to Zoom
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
