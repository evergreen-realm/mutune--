import React from 'react';
import { Box, Globe, Maximize2, Minimize2, ZoomIn, ZoomOut, Layers } from 'lucide-react';

export default function MapControls({
  is3D = false,
  onToggle3D,
  satellite = false,
  onToggleSatellite,
  isFullscreen = false,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  className = ''
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 2D / 3D Toggle */}
      {onToggle3D && (
        <button
          type="button"
          onClick={onToggle3D}
          title={is3D ? 'Switch to 2D Top View' : 'Switch to 3D Perspective'}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition shadow-lg cursor-pointer flex items-center justify-center ${
            is3D 
              ? 'bg-blue-600 border-blue-500 text-white shadow-blue-900/30' 
              : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Box size={16} />
        </button>
      )}

      {/* Satellite Overlay Toggle */}
      {onToggleSatellite && (
        <button
          type="button"
          onClick={onToggleSatellite}
          title={satellite ? 'Switch to Vector Street Map' : 'Toggle Satellite Imagery'}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition shadow-lg cursor-pointer flex items-center justify-center ${
            satellite
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/30'
              : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Globe size={16} />
        </button>
      )}

      {/* Zoom In */}
      {onZoomIn && (
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2.5 rounded-xl border bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 backdrop-blur-md transition shadow-lg cursor-pointer flex items-center justify-center"
        >
          <ZoomIn size={16} />
        </button>
      )}

      {/* Zoom Out */}
      {onZoomOut && (
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2.5 rounded-xl border bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 backdrop-blur-md transition shadow-lg cursor-pointer flex items-center justify-center"
        >
          <ZoomOut size={16} />
        </button>
      )}

      {/* Fullscreen Toggle */}
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className="p-2.5 rounded-xl border bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 backdrop-blur-md transition shadow-lg cursor-pointer flex items-center justify-center"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      )}
    </div>
  );
}
