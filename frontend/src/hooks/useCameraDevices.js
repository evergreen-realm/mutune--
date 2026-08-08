import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to enumerate connected camera devices via navigator.mediaDevices.enumerateDevices()
 * and manage active device selection and fallback constraints.
 */
export function useCameraDevices(isActive = false) {
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [hasPermission, setHasPermission] = useState(false);

  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;

    try {
      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');

      setVideoDevices(videoInputs);

      if (videoInputs.length > 0 && !selectedDeviceId) {
        // Prefer rear/environment camera if label contains 'back', 'rear', or 'environment'
        const rearCamera = videoInputs.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') || 
          d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(rearCamera ? rearCamera.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate camera devices:', err);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!isActive) return;

    // Prompt for permission if labels are blank
    navigator.mediaDevices?.getUserMedia?.({ video: true })
      .then(stream => {
        setHasPermission(true);
        refreshDevices();
        // Stop initial stream to release lock
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(() => {
        setHasPermission(false);
        refreshDevices();
      });

    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [isActive, refreshDevices]);

  const getConstraints = useCallback((useGenericFallback = false) => {
    if (useGenericFallback || !selectedDeviceId) {
      return { video: true };
    }
    return {
      video: {
        deviceId: { exact: selectedDeviceId }
      }
    };
  }, [selectedDeviceId]);

  return {
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    getConstraints,
    hasPermission
  };
}
