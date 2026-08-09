import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for device motion tracking with two backends:
 *   1. Mobile: DeviceOrientationEvent + DeviceMotionEvent (gyroscope + accelerometer)
 *   2. Desktop: Block-Matching SAD optical flow via HTML5 Canvas
 *
 * Returns cumulative displacement (for continuous spatial tracking of irregular rooms)
 * and instantaneous angle/pitch/roll for the HUD overlay.
 *
 * Key design decisions:
 *   - Block-matching uses 8×8 blocks with ±6px search range (SAD metric)
 *   - Dead zone: displacement < 2.5px per frame is treated as stationary (ignores sensor noise)
 *   - iOS 13+ permission must be requested from a user gesture — we expose requestSensorPermission
 *     as a callable that components invoke from onClick, NOT from useEffect
 */

const BLOCK_SIZE = 8;
const SEARCH_RANGE = 6;
const CANVAS_W = 160;
const CANVAS_H = 120;
const DEAD_ZONE_PX = 2.5; // Minimum displacement to count as real motion
const BLOCKS_X = Math.floor(CANVAS_W / BLOCK_SIZE); // 20
const BLOCKS_Y = Math.floor(CANVAS_H / BLOCK_SIZE); // 15

/**
 * Compute Sum of Absolute Differences between two blocks.
 * @param {Uint8ClampedArray} cur - Current frame grayscale data (w * h)
 * @param {Uint8ClampedArray} prev - Previous frame grayscale data (w * h)
 * @param {number} bx - Block top-left x in current frame
 * @param {number} by - Block top-left y in current frame
 * @param {number} sx - Search offset x in previous frame
 * @param {number} sy - Search offset y in previous frame
 * @param {number} w - Frame width
 * @returns {number} SAD value
 */
function computeSAD(cur, prev, bx, by, sx, sy, w) {
  let sad = 0;
  for (let dy = 0; dy < BLOCK_SIZE; dy++) {
    for (let dx = 0; dx < BLOCK_SIZE; dx++) {
      const cx = bx + dx;
      const cy = by + dy;
      const px = bx + dx + sx;
      const py = by + dy + sy;
      // Bounds check
      if (px < 0 || px >= CANVAS_W || py < 0 || py >= CANVAS_H) {
        sad += 128; // Penalty for out-of-bounds
        continue;
      }
      sad += Math.abs(cur[cy * w + cx] - prev[py * w + px]);
    }
  }
  return sad;
}

/**
 * Convert RGBA ImageData to grayscale Uint8ClampedArray (single channel).
 */
function rgbaToGray(rgba) {
  const len = rgba.length / 4;
  const gray = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i++) {
    const offset = i * 4;
    // Perceptual luminance
    gray[i] = Math.round(0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]);
  }
  return gray;
}

/**
 * Run block matching across the frame grid, return average displacement vector.
 * @param {Uint8ClampedArray} curGray - Current frame grayscale
 * @param {Uint8ClampedArray} prevGray - Previous frame grayscale
 * @returns {{ dx: number, dy: number, magnitude: number }}
 */
function blockMatchMotion(curGray, prevGray) {
  let totalDx = 0;
  let totalDy = 0;
  let blockCount = 0;

  for (let by = 0; by < BLOCKS_Y; by++) {
    for (let bx = 0; bx < BLOCKS_X; bx++) {
      const blockX = bx * BLOCK_SIZE;
      const blockY = by * BLOCK_SIZE;

      let bestSAD = Infinity;
      let bestSx = 0;
      let bestSy = 0;

      // Search in ±SEARCH_RANGE around the block position
      for (let sy = -SEARCH_RANGE; sy <= SEARCH_RANGE; sy++) {
        for (let sx = -SEARCH_RANGE; sx <= SEARCH_RANGE; sx++) {
          const sad = computeSAD(curGray, prevGray, blockX, blockY, sx, sy, CANVAS_W);
          if (sad < bestSAD) {
            bestSAD = sad;
            bestSx = sx;
            bestSy = sy;
          }
        }
      }

      totalDx += bestSx;
      totalDy += bestSy;
      blockCount++;
    }
  }

  const avgDx = totalDx / blockCount;
  const avgDy = totalDy / blockCount;
  const magnitude = Math.sqrt(avgDx * avgDx + avgDy * avgDy);

  return { dx: avgDx, dy: avgDy, magnitude };
}

export function useCameraMotion(isActive = false, webcamRef = null) {
  const [angle, setAngle] = useState(0);           // 0..360 degrees (Yaw)
  const [pitch, setPitch] = useState(0);            // -90..90 degrees
  const [roll, setRoll] = useState(0);              // -180..180 degrees
  const [isSensorAvailable, setIsSensorAvailable] = useState(false);
  const [motionSpeed, setMotionSpeed] = useState(0);
  const [permissionState, setPermissionState] = useState('prompt');
  const [displacement, setDisplacement] = useState({ x: 0, y: 0, total: 0 });

  const prevGrayRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const cumulativeDisp = useRef({ x: 0, y: 0 });

  // Reset cumulative displacement (call when starting a new scan)
  const resetDisplacement = useCallback(() => {
    cumulativeDisp.current = { x: 0, y: 0 };
    setDisplacement({ x: 0, y: 0, total: 0 });
  }, []);

  /**
   * Request permission for iOS 13+ devices.
   * MUST be called from a user gesture (onClick handler).
   */
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
    // Android / desktop — no permission needed, will detect via event
    return true;
  }, []);

  // Listen to mobile DeviceOrientationEvent
  useEffect(() => {
    if (!isActive) return;

    let orientationDetected = false;

    const handleOrientation = (event) => {
      // Only count as sensor available if we get real data (not all nulls)
      if (event.alpha !== null && event.alpha !== undefined) {
        if (!orientationDetected) {
          orientationDetected = true;
          setIsSensorAvailable(true);
        }
        setAngle(event.alpha || 0);
        setPitch(event.beta || 0);
        setRoll(event.gamma || 0);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    // Give the sensor 1.5 seconds to report — if nothing arrives, it's not available
    const fallbackTimer = setTimeout(() => {
      if (!orientationDetected) {
        setIsSensorAvailable(false);
      }
    }, 1500);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      clearTimeout(fallbackTimer);
    };
  }, [isActive]);

  // Desktop fallback: Block-Matching SAD Optical Flow
  useEffect(() => {
    if (!isActive || isSensorAvailable) {
      // Clean up if we switch away
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      prevGrayRef.current = null;
      return;
    }

    // Lazy-create canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = CANVAS_W;
      canvasRef.current.height = CANVAS_H;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const processFrame = () => {
      const video = webcamRef?.current?.video;
      if (video && video.readyState === 4 && video.videoWidth > 0) {
        ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);
        const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        const curGray = rgbaToGray(imgData.data);

        if (prevGrayRef.current) {
          const motion = blockMatchMotion(curGray, prevGrayRef.current);

          // Dead zone: ignore sub-threshold motion (noise)
          if (motion.magnitude >= DEAD_ZONE_PX) {
            // Update angle based on horizontal displacement
            const angleDelta = motion.dx * 1.2; // Scale factor: px -> degrees
            setAngle(prev => (prev + angleDelta + 360) % 360);

            // Accumulate displacement for spatial tracking
            cumulativeDisp.current.x += Math.abs(motion.dx);
            cumulativeDisp.current.y += Math.abs(motion.dy);
            const total = Math.sqrt(
              cumulativeDisp.current.x ** 2 + cumulativeDisp.current.y ** 2
            );
            setDisplacement({
              x: cumulativeDisp.current.x,
              y: cumulativeDisp.current.y,
              total
            });

            setMotionSpeed(Math.min(100, Math.round(motion.magnitude * 8)));
          } else {
            setMotionSpeed(0);
          }
        }

        // Bug 6 fix: Clone the data so it can't be recycled by the canvas context
        prevGrayRef.current = new Uint8ClampedArray(curGray);
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, isSensorAvailable, webcamRef]);

  // Compute current sector (0-15) from angle for 16-sector compass
  const currentSector = Math.round(((angle % 360 + 360) % 360) / 22.5) % 16;

  return {
    angle,
    pitch,
    roll,
    isSensorAvailable,
    motionSpeed,
    permissionState,
    displacement,
    currentSector,
    requestSensorPermission,
    resetDisplacement
  };
}
