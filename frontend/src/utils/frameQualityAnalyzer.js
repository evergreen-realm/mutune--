/**
 * Real-time HTML5 Canvas Image Frame Quality & Blur Analyzer.
 * Uses Laplacian Kernel Convolution to calculate variance (edge sharpness)
 * and channel luminance to detect poor lighting.
 */

let canvasBuffer = null;
let ctxBuffer = null;

export function analyzeFrameQuality(videoElement, options = {}) {
  const {
    minBlurScore = 15,
    minLuminance = 25,
    maxLuminance = 240,
    sampleWidth = 120,
    sampleHeight = 90
  } = options;

  if (!videoElement || videoElement.readyState < 2) {
    return {
      isQualityOK: false,
      blurScore: 0,
      luminance: 0,
      isBlurry: false,
      isTooDark: false,
      isTooBright: false,
      message: 'Waiting for camera feed...'
    };
  }

  if (!canvasBuffer) {
    canvasBuffer = document.createElement('canvas');
    canvasBuffer.width = sampleWidth;
    canvasBuffer.height = sampleHeight;
    ctxBuffer = canvasBuffer.getContext('2d', { willReadFrequently: true });
  }

  // Draw current frame to sample canvas
  ctxBuffer.drawImage(videoElement, 0, 0, sampleWidth, sampleHeight);
  const imgData = ctxBuffer.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = imgData.data;

  // 1. Calculate Mean Luminance
  let totalLuminance = 0;
  const grayScale = new Float32Array(sampleWidth * sampleHeight);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Perceptual luminance formula
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    grayScale[j] = lum;
    totalLuminance += lum;
  }

  const avgLuminance = totalLuminance / (sampleWidth * sampleHeight);

  // 2. Calculate Variance of Laplacian (Blur Metric)
  // Laplacian kernel: [ [0, 1, 0], [1, -4, 1], [0, 1, 0] ]
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let count = 0;

  for (let y = 1; y < sampleHeight - 1; y++) {
    for (let x = 1; x < sampleWidth - 1; x++) {
      const idx = y * sampleWidth + x;
      const center = grayScale[idx];
      const left = grayScale[idx - 1];
      const right = grayScale[idx + 1];
      const top = grayScale[idx - sampleWidth];
      const bottom = grayScale[idx + sampleWidth];

      const lap = left + right + top + bottom - 4 * center;
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      count++;
    }
  }

  const meanLap = laplacianSum / count;
  const blurScore = Math.max(0, (laplacianSqSum / count) - (meanLap * meanLap));

  const isTooDark = avgLuminance < minLuminance;
  const isTooBright = avgLuminance > maxLuminance;
  const isBlurry = blurScore < minBlurScore;

  let message = 'Quality Good';
  let isQualityOK = true;

  if (isTooDark) {
    message = 'Too dark — turn on lights';
    isQualityOK = false;
  } else if (isTooBright) {
    message = 'Too bright — reduce glare';
    isQualityOK = false;
  } else if (isBlurry) {
    message = 'Camera blurry — hold steady';
    isQualityOK = false;
  }

  return {
    isQualityOK,
    blurScore: Math.round(blurScore * 10) / 10,
    luminance: Math.round(avgLuminance),
    isBlurry,
    isTooDark,
    isTooBright,
    message
  };
}
