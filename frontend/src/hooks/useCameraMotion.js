import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to track device motion and orientation (yaw/alpha, pitch/beta, roll/gamma)
 * with an automatic HTML5 Canvas optical flow fallback for desktop webcams.
 */
export function useCameraMotion(isActive = false, webcamRef = null) {
  const [angle, setAngle] = useState(0); // 0..360 degrees (Yaw)
  const [pitch, setPitch] = useState(0); // -90..90 degrees
  const [roll, setRoll] = useState(0); // -180..180 degrees
  const [isSensorAvailable, setIsSensorAvailable] = useState(false);
  const [motionSpeed, setMotionSpeed] = useState(0); // Motion magnitude indicator
  const [permissionState, setPermissionState] = useState('prompt');

  const prevFrameRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const animFrameRef = useRef(null);

  // Request permission for iOS 13+ devices
  const requestSensorPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        setPermissionState(state);
        return state === 'granted';
      } catch (err) {
        setPermissionState('denied');
        return false;
      }
    }
    return true;
  }, []);

  // Listen to mobile DeviceOrientationEvent
  useEffect(() => {
    if (!isActive) return;

    const handleOrientation = (event) => {
      if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
        setIsSensorAvailable(true);
        // Alpha: compass orientation [0, 360)
        // Beta: front-to-back tilt [-180, 180)
        // Gamma: left-to-right tilt [-90, 90)
        const alphaAngle = event.alpha || 0;
        setAngle(alphaAngle);
        setPitch(event.beta || 0);
        setRoll(event.gamma || 0);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isActive]);

  // Fallback: Optical Motion Estimation via Canvas Frame Differencing for Desktop Webcams
  useEffect(() => {
    if (!isActive || isSensorAvailable) return;

    const canvas = canvasRef.current;
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let lastTime = performance.now();

    const processFrame = () => {
      if (webcamRef?.current?.video && webcamRef.current.video.readyState === 4) {
        const video = webcamRef.current.video;
        ctx.drawImage(video, 0, 0, 160, 120);
        const frame = ctx.getImageData(0, 0, 160, 120);
        const data = frame.data;

        if (prevFrameRef.current) {
          const prevData = prevFrameRef.current;
          let diffSum = 0;
          let horizontalShiftSum = 0;
          let totalCount = 0;

          // Compare luminance & horizontal gradient diff across pixels
          for (let i = 0; i < data.length; i += 16) {
            const lum1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const lum2 = 0.299 * prevData[i] + 0.587 * prevData[i + 1] + 0.114 * prevData[i + 2];
            const diff = Math.abs(lum1 - lum2);
            diffSum += diff;

            // Optical shift approximation along width
            if (i > 4) {
              const prevLumLeft = 0.299 * prevData[i - 4] + 0.587 * prevData[i - 3] + 0.114 * prevData[i - 2];
              const grad = lum2 - prevLumLeft;
              horizontalShiftSum += grad;
            }
            totalCount++;
          }

          const avgDiff = diffSum / totalCount;
          setMotionSpeed(Math.min(100, Math.round(avgDiff * 2)));

          // Update synthetic panning angle based on optical motion gradient if moving
          if (avgDiff > 2) {
            const now = performance.now();
            const deltaT = (now - lastTime) / 1000;
            const dir = horizontalShiftSum > 0 ? 1 : -1;
            const shiftRate = Math.min(15, avgDiff * 0.4);
            setAngle(prev => (prev + dir * shiftRate * deltaT * 10 + 360) % 360);
          }
          lastTime = performance.now();
        }

        prevFrameRef.current = data;
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, isSensorAvailable, webcamRef]);

  return {
    angle,
    pitch,
    roll,
    isSensorAvailable,
    motionSpeed,
    permissionState,
    requestSensorPermission
  };
}
