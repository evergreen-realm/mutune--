import { uploadDoc } from '../lib/api';

/**
 * Extracts 16 spatially distributed frames from an MP4 360° video file
 * by seeking across timestamps along the video duration.
 *
 * @param {File|Blob} videoFile - The uploaded 360° MP4 video file
 * @param {Function} onProgress - Progress callback (percent, currentSector)
 * @param {number} totalSectors - Number of sectors (default 16)
 * @returns {Promise<Array<{ url: string, sectorIndex: number, timestamp: number, angle: number }>>}
 */
export async function extractFramesFromVideo(videoFile, onProgress = () => {}, totalSectors = 16) {
  if (!videoFile) throw new Error('No video file provided');

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const extractedFrames = [];
    let currentSector = 0;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || isNaN(duration) || duration <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid video duration. Please upload a valid MP4 video.'));
        return;
      }

      const interval = duration / totalSectors;

      const captureNextSector = () => {
        if (currentSector >= totalSectors) {
          URL.revokeObjectURL(objectUrl);
          resolve(extractedFrames);
          return;
        }

        // Target timestamp for current sector
        const targetTime = Math.min(duration - 0.1, currentSector * interval + 0.1);
        video.currentTime = targetTime;
      };

      video.onseeked = async () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          // Convert DataURL to File object
          const blob = await (await fetch(dataUrl)).blob();
          const frameFile = new File(
            [blob], 
            `video_sector_${currentSector + 1}_${Date.now()}.jpg`, 
            { type: 'image/jpeg' }
          );

          // Upload extracted frame to server/cloud
          const res = await uploadDoc(frameFile);
          const url = res?.url || dataUrl;

          const angle = Math.round((currentSector / totalSectors) * 360);
          extractedFrames.push({
            url,
            sectorIndex: currentSector,
            timestamp: Math.round(video.currentTime * 10) / 10,
            angle
          });

          currentSector++;
          const progressPercent = Math.round((currentSector / totalSectors) * 100);
          onProgress(progressPercent, currentSector);

          // Process next sector
          captureNextSector();
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Failed to extract frame at sector ${currentSector + 1}: ${err.message}`));
        }
      };

      // Start processing first sector
      captureNextSector();
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video file. Ensure format is MP4 or WebM.'));
    };
  });
}
