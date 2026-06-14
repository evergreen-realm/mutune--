import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam';
import { Camera, UploadCloud, Trash2, Image, VideoOff, RefreshCw } from 'lucide-react';
import { uploadDoc } from '../lib/api';
import { toast } from 'react-toastify';

export default function ImageUpload({ value = [], onChange, multiple = false, label = "Upload Images" }) {
  const [mode, setMode] = useState('dropzone'); // 'dropzone' or 'camera'
  const [uploading, setUploading] = useState(false);
  const webcamRef = useRef(null);

  // File drop handler
  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);
    const uploadedUrls = [...value];
    
    try {
      const filesToUpload = multiple ? acceptedFiles : [acceptedFiles[0]];
      for (const file of filesToUpload) {
        const res = await uploadDoc(file);
        if (res?.success && res.url) {
          uploadedUrls.push(res.url);
          if (!multiple) break; // if single, only take the first successful url
        }
      }
      onChange(multiple ? uploadedUrls : [uploadedUrls[uploadedUrls.length - 1]]);
      toast.success('File(s) uploaded successfully');
    } catch (err) {
      toast.error(err?.error?.message || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [value, onChange, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    },
    multiple
  });

  // Capture snapshot from webcam
  const captureSnapshot = useCallback(async () => {
    if (!webcamRef.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      toast.error('Failed to capture image from camera');
      return;
    }

    setUploading(true);
    try {
      // Convert base64 DataURL to File object
      const blob = await fetch(imageSrc).then(r => r.blob());
      const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      const res = await uploadDoc(file);
      if (res?.success && res.url) {
        const newUrls = multiple ? [...value, res.url] : [res.url];
        onChange(newUrls);
        toast.success('Photo captured and uploaded');
        setMode('dropzone'); // Go back to gallery view
      }
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to upload captured image');
    } finally {
      setUploading(false);
    }
  }, [value, onChange, multiple]);

  const removeImage = (indexToRemove) => {
    const updated = value.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label} {multiple ? '(Multiple files allowed)' : ''}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('dropzone')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
              mode === 'dropzone'
                ? 'bg-green-600 text-white shadow-sm shadow-green-900/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Gallery / Dropzone
          </button>
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
              mode === 'camera'
                ? 'bg-green-600 text-white shadow-sm shadow-green-900/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Camera size={12} /> Take Photo
          </button>
        </div>
      </div>

      {mode === 'dropzone' ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? 'border-green-500 bg-green-50/10'
              : 'border-slate-300 hover:border-green-400 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <UploadCloud size={24} />
            </div>
            {uploading ? (
              <div className="flex flex-col items-center gap-1">
                <RefreshCw size={18} className="animate-spin text-green-600" />
                <p className="text-xs text-slate-600 font-semibold">Uploading document...</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-slate-700 font-bold">
                  {isDragActive ? 'Drop files here' : 'Drag & drop image/PDF here, or click to browse'}
                </p>
                <p className="text-[10px] text-slate-400">Supports JPEG, PNG, WEBP, or PDF</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-4">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode: "user"
            }}
            className="w-full max-w-sm rounded-xl overflow-hidden shadow-inner border border-slate-800"
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={captureSnapshot}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider"
            >
              {uploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Camera size={14} /> Capture & Upload
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('dropzone')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Previews / Gallery */}
      {value && value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {value.map((url, idx) => {
            const isPdf = url.toLowerCase().endsWith('.pdf');
            return (
              <div key={url + idx} className="relative group border border-slate-200 rounded-xl overflow-hidden aspect-video bg-slate-100 flex items-center justify-center shadow-sm">
                {isPdf ? (
                  <div className="flex flex-col items-center gap-1 p-2 text-center">
                    <Image size={24} className="text-red-500" />
                    <span className="text-[9px] text-slate-600 font-bold truncate max-w-full">PDF Document</span>
                  </div>
                ) : (
                  <img src={url} alt={`Upload preview ${idx}`} className="object-cover w-full h-full" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-white hover:bg-slate-100 rounded-lg text-slate-700 transition-colors text-[10px] font-bold"
                  >
                    View File
                  </a>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
