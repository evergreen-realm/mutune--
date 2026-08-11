import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Complementary Filter Constants ──────────────────────────────────────────
// α = 0.98: trust gyroscope 98% for smooth short-term tracking,
// compass 2% for long-term drift correction.
// At 60 Hz, this corrects ~1.2° of drift per second.
const FILTER_ALPHA = 0.98;

// Dead-zone: raw rotationRate magnitude below this (deg/s) is treated as "Still".
// Normal hand tremor is ~3-7 deg/s. This prevents phantom "Moving" readings.
const MOTION_DEAD_ZONE = 3;

// Exponential moving average factors
const VELOCITY_SMOOTH = 0.3;   // Gyro velocity EMA (0.3 = responsive, 0.7 = smooth)
const SPEED_SMOOTH = 0.15;     // Motion speed EMA (0.15 = very smooth display)
const PITCH_SMOOTH = 0.15;     // Pitch EMA (matches previous implementation)

// ─── Vector-based heading fusion ─────────────────────────────────────────────
// Converts both angles to unit vectors, averages with weights, converts back.
// This correctly handles the 0°/360° boundary (e.g., fusing 359° and 1° → 0°).
function fuseHeading(prevFused, gyroRate, compassHeading, dt, currentSpeed = 0) {
  // Step 1: Integrate gyroscope → predicted angle
  const gyroAngle = (prevFused + gyroRate * dt + 360) % 360;

  // Step 2: If no compass available, return gyro-only (graceful degradation)
  if (compassHeading === null || compassHeading === undefined || isNaN(compassHeading)) {
    return gyroAngle;
  }

  // Motion-gated adaptive alpha: 1.0 during active motion (zero noise injection), 0.998 when stationary
  const alpha = currentSpeed >= 3 ? 1.0 : 0.998;

  // Step 3: Convert both angles to unit vectors, weighted blend
  const toRad = Math.PI / 180;
  const x = alpha * Math.cos(gyroAngle * toRad) + (1 - alpha) * Math.cos(compassHeading * toRad);
  const y = alpha * Math.sin(gyroAngle * toRad) + (1 - alpha) * Math.sin(compassHeading * toRad);

  // Step 4: Convert back to degrees (0–360)
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useCameraMotion(isActive = false, webcamRef = null) {
  const [angle, setAngle] = useState(0);           // 0..360 degrees (Fused Yaw)
  const [pitch, setPitch] = useState(0);            // -90..90 degrees
  const [roll, setRoll] = useState(0);              // -180..180 degrees
  const [isSensorAvailable, setIsSensorAvailable] = useState(false);
  const [motionSpeed, setMotionSpeed] = useState(0);
  const [permissionState, setPermissionState] = useState('prompt');

  // ─── Refs for raw sensor data (updated at sensor rate, no re-renders) ──────
  const compassRef = useRef(null);              // Absolute heading from compass (0-360)
  const gyroRef = useRef({ alpha: 0, beta: 0, gamma: 0 }); // Raw rotationRate (deg/s)
  const pitchRef = useRef(0);                   // Raw beta from orientation
  const rollRef = useRef(0);                    // Raw gamma from orientation
  const prevPitchSmooth = useRef(null);         // Previous smoothed pitch
  const prevGammaSmooth = useRef(null);         // Previous smoothed roll (gamma)

  // ─── Internal fusion state (mutated in rAF, not React state) ───────────────
  const fusedYawRef = useRef(0);                // Current fused heading
  const smoothedVelocityRef = useRef(0);        // EMA-smoothed gyro velocity
  const smoothedSpeedRef = useRef(0);           // EMA-smoothed motion speed
  const lastFrameTimeRef = useRef(null);        // For dt calculation in rAF
  const lastMotionTimeRef = useRef(null);       // For dt calculation in devicemotion
  const rAFRef = useRef(null);                  // rAF handle for cleanup
  const sensorDetectedRef = useRef(false);      // Has any sensor fired?

  // ─── Compass fallback state ────────────────────────────────────────────────
  const initialAlphaOffsetRef = useRef(null);   // For relative alpha fallback
  const hasAbsoluteCompassRef = useRef(false);  // Did we get an absolute reading?

  // ─── Permission request (iOS §17: must be from user gesture) ───────────────
  const requestSensorPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        setPermissionState(state);
        if (state === 'granted') {
          setIsSensorAvailable(true);
        }
        return state === 'granted';
      } catch (err) {
        console.warn('DeviceOrientation permission denied:', err);
        setPermissionState('denied');
        return false;
      }
    }
    // Also request DeviceMotionEvent permission on iOS if available
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        await DeviceMotionEvent.requestPermission();
      } catch (err) {
        console.warn('DeviceMotion permission denied:', err);
      }
    }
    return true;
  }, []);

  // ─── Unified sensor effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    // Reset internal state on activation
    fusedYawRef.current = 0;
    smoothedVelocityRef.current = 0;
    smoothedSpeedRef.current = 0;
    lastFrameTimeRef.current = null;
    lastMotionTimeRef.current = null;
    sensorDetectedRef.current = false;
    compassRef.current = null;
    initialAlphaOffsetRef.current = null;
    hasAbsoluteCompassRef.current = false;
    prevPitchSmooth.current = null;
    prevGammaSmooth.current = null;

    // ── Listener 1: Compass heading (absolute orientation) ─────────────────
    // Priority cascade:
    //   1. deviceorientationabsolute (Android Chrome 50+)
    //   2. webkitCompassHeading (iOS Safari)
    //   3. Relative alpha with initial offset (fallback)
    const handleAbsoluteOrientation = (event) => {
      // iOS: webkitCompassHeading is the most direct compass reading
      if (event.webkitCompassHeading !== undefined && !isNaN(event.webkitCompassHeading)) {
        compassRef.current = event.webkitCompassHeading;
        hasAbsoluteCompassRef.current = true;
        return;
      }
      // Android absolute: event.absolute === true and alpha is available
      if (event.absolute === true && event.alpha !== null && !isNaN(event.alpha)) {
        compassRef.current = (360 - event.alpha) % 360;
        hasAbsoluteCompassRef.current = true;
        return;
      }
    };

    // ── Listener 2: Orientation (pitch, roll, + compass fallback) ──────────
    const handleOrientation = (event) => {
      if (event.beta !== null && event.beta !== undefined) {
        if (!sensorDetectedRef.current) {
          sensorDetectedRef.current = true;
          setIsSensorAvailable(true);
        }

        pitchRef.current = event.beta || 0;
        rollRef.current = event.gamma || 0;

        // Compass fallback: if absolute event never fired, use relative alpha
        if (!hasAbsoluteCompassRef.current && event.alpha !== null && !isNaN(event.alpha)) {
          if (initialAlphaOffsetRef.current === null) {
            initialAlphaOffsetRef.current = event.alpha;
          }
          compassRef.current = (360 - (event.alpha - initialAlphaOffsetRef.current) + 360) % 360;
        }
      }
    };

    // ── Listener 3: Gyroscope (rotationRate for yaw integration) ───────────
    const handleMotion = (event) => {
      const rate = event.rotationRate;
      if (!rate || rate.alpha === null) return;

      if (!sensorDetectedRef.current) {
        sensorDetectedRef.current = true;
        setIsSensorAvailable(true);
      }

      gyroRef.current = {
        alpha: rate.alpha || 0,
        beta: rate.beta || 0,
        gamma: rate.gamma || 0
      };

      // Track timing for gyro dt (separate from rAF dt)
      lastMotionTimeRef.current = performance.now();
    };

    // ── rAF Loop: reads all refs, applies filter, writes React state ───────
    const updateLoop = (timestamp) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
        rAFRef.current = requestAnimationFrame(updateLoop);
        return;
      }

      const dt = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      // Guard against huge dt (e.g., tab was backgrounded)
      if (dt > 0 && dt < 0.5) {
        // ── 3D Vector Yaw Projection ───────────────────────────────────────
        const screenOrientation = window.screen?.orientation?.angle || window.orientation || 0;
        const pitchRad = (pitchRef.current - 90) * (Math.PI / 180);

        let gyroY, gyroZ;
        if (screenOrientation === 90 || screenOrientation === -90) {
          gyroY = gyroRef.current.beta || 0;
          gyroZ = gyroRef.current.alpha || 0;
        } else {
          gyroY = gyroRef.current.gamma || 0;
          gyroZ = gyroRef.current.alpha || 0;
        }

        // Project 3D rotation rate vector onto world vertical axis
        const rawYawVelocity = gyroY * Math.cos(pitchRad) + gyroZ * Math.sin(pitchRad);

        // EMA smoothing on gyro velocity (removes single-frame spikes from tremor)
        smoothedVelocityRef.current =
          (1 - VELOCITY_SMOOTH) * smoothedVelocityRef.current +
          VELOCITY_SMOOTH * rawYawVelocity;

        // Apply adaptive speed-gated complementary filter
        fusedYawRef.current = fuseHeading(
          fusedYawRef.current,
          smoothedVelocityRef.current,
          compassRef.current,
          dt,
          smoothedSpeedRef.current
        );

        setAngle(fusedYawRef.current);

        // ── Pitch: EMA smoothed, normalized (upright = 0°) ────────────────
        const rawPitch = pitchRef.current;
        if (prevPitchSmooth.current === null) {
          prevPitchSmooth.current = rawPitch;
        }
        const smoothedPitch = prevPitchSmooth.current + PITCH_SMOOTH * (rawPitch - prevPitchSmooth.current);
        prevPitchSmooth.current = smoothedPitch;
        const normalizedPitch = smoothedPitch - 90; // beta=90 when upright (Rule §22)
        setPitch(Math.max(-90, Math.min(90, normalizedPitch)));

        // ── Roll: EMA smoothed ────────────────────────────────────────────
        const rawGamma = rollRef.current;
        if (prevGammaSmooth.current === null) {
          prevGammaSmooth.current = rawGamma;
        }
        const smoothedGamma = prevGammaSmooth.current + PITCH_SMOOTH * (rawGamma - prevGammaSmooth.current);
        prevGammaSmooth.current = smoothedGamma;
        setRoll(smoothedGamma);

        // ── Motion Speed: dead-zone + EMA ─────────────────────────────────
        const rawSpeed = Math.sqrt(
          gyroRef.current.alpha ** 2 +
          gyroRef.current.beta ** 2 +
          gyroRef.current.gamma ** 2
        );
        // Dead-zone: below threshold, treat as 0
        const filteredSpeed = rawSpeed < MOTION_DEAD_ZONE ? 0 : rawSpeed;
        smoothedSpeedRef.current =
          (1 - SPEED_SMOOTH) * smoothedSpeedRef.current +
          SPEED_SMOOTH * filteredSpeed;
        setMotionSpeed(Math.min(100, Math.round(smoothedSpeedRef.current)));
      }

      rAFRef.current = requestAnimationFrame(updateLoop);
    };

    // ── Register all listeners ─────────────────────────────────────────────
    // Try absolute orientation first (Android Chrome 50+)
    window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
    // Standard orientation for pitch/roll + compass fallback
    window.addEventListener('deviceorientation', handleOrientation, true);
    // Gyroscope for rotationRate
    window.addEventListener('devicemotion', handleMotion, true);
    // Start rAF loop
    rAFRef.current = requestAnimationFrame(updateLoop);

    // Fallback: if no sensor fires within 1.5s, mark unavailable
    const fallbackTimer = setTimeout(() => {
      if (!sensorDetectedRef.current) {
        setIsSensorAvailable(false);
      }
    }, 1500);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('devicemotion', handleMotion, true);
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
      clearTimeout(fallbackTimer);
    };
  }, [isActive]);

  // Backwards-compatible no-op
  const resetDisplacement = useCallback(() => {
    fusedYawRef.current = 0;
    smoothedVelocityRef.current = 0;
    compassRef.current = null;
    initialAlphaOffsetRef.current = null;
    hasAbsoluteCompassRef.current = false;
  }, []);

  return {
    angle,
    pitch,
    roll,
    isSensorAvailable,
    motionSpeed,
    permissionState,
    currentSector: 0, // Backwards compatibility
    requestSensorPermission,
    resetDisplacement
  };
}
