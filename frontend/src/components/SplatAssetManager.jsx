import React, { useState } from 'react';
import { Box, Play, Trash2, Loader2, Download, AlertCircle } from 'lucide-react';
import SplatViewerModal from './SplatViewerModal';

export default function SplatAssetManager({ assets = [], onDelete, onDownload }) {
  const [selectedSplat, setSelectedSplat] = useState(null);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'processing':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Loader2 size={12} className="animate-spin" /> Processing
          </span>
        );
      case 'ready':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            Ready
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={12} /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      
      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/50">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Box size={24} className="text-slate-500" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">No 3D Scans Yet</h3>
          <p className="text-slate-400 text-sm text-center max-w-sm">
            Capture a room using the Guided 360° Photo Capture tool to generate your first Gaussian Splat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div 
              key={asset.id} 
              className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-300"
            >
              {/* Thumbnail / Status Area */}
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                {asset.thumbnailUrl ? (
                  <img 
                    src={asset.thumbnailUrl} 
                    alt={asset.title} 
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <Box size={32} className="text-slate-800" />
                )}
                
                <div className="absolute top-3 right-3 z-10">
                  {getStatusBadge(asset.status)}
                </div>

                {asset.status === 'ready' && (
                  <button 
                    onClick={() => setSelectedSplat(asset)}
                    className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      <Play size={16} className="fill-current" />
                      View 3D
                    </div>
                  </button>
                )}
              </div>

              {/* Details & Actions */}
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-white font-bold text-sm truncate">{asset.title}</h4>
                  <p className="text-slate-400 text-xs mt-1">
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {asset.status === 'ready' && onDownload && (
                    <button 
                      onClick={() => onDownload(asset)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      title="Download .splat"
                    >
                      <Download size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button 
                      onClick={() => onDelete(asset.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Delete asset"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Viewer Modal */}
      <SplatViewerModal 
        isOpen={!!selectedSplat}
        onClose={() => setSelectedSplat(null)}
        splatUrl={selectedSplat?.splatUrl}
        title={selectedSplat?.title}
      />
      
    </div>
  );
}
