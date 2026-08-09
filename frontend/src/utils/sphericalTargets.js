/**
 * Generates a spherical constellation of target capture points.
 * We use simple rings for predictable user guidance.
 * @param {string} density 'Fast' | 'Detailed'
 * @returns {Array} Array of target objects { id, yaw, pitch, captured }
 */
export function generateSphericalTargets(density = 'Detailed') {
  const targets = [];
  let idCounter = 0;

  const addRing = (pitch, numPoints) => {
    const step = 360 / numPoints;
    for (let i = 0; i < numPoints; i++) {
      targets.push({
        id: idCounter++,
        yaw: i * step,
        pitch: pitch,
        captured: false
      });
    }
  };

  if (density === 'Fast') {
    // Fast: 16 points (12 equator, 4 top)
    addRing(0, 12); // Equator
    addRing(45, 4); // Upper ring
  } else {
    // Detailed: 34 points (16 equator, 10 upper, 8 lower)
    addRing(0, 16);  // Equator
    addRing(35, 10); // Upper ring
    addRing(-25, 8); // Lower ring
  }

  return targets;
}

/**
 * Spatial Hashing / Distance check to see if current yaw/pitch is close to an uncaptured target.
 * We use an angular distance threshold.
 * @param {number} currentYaw 
 * @param {number} currentPitch 
 * @param {Array} targets 
 * @param {number} thresholdDegrees 
 * @returns {Object|null} The matched target or null
 */
export function getClosestUncapturedTarget(currentYaw, currentPitch, targets, thresholdDegrees = 10) {
  let closestTarget = null;
  let minDistance = Infinity;

  for (const target of targets) {
    if (target.captured) continue;

    let dYaw = Math.abs(currentYaw - target.yaw);
    if (dYaw > 180) dYaw = 360 - dYaw; // Wrap around
    
    const dPitch = currentPitch - target.pitch;
    
    const dist = Math.sqrt(dYaw * dYaw + dPitch * dPitch);

    if (dist < minDistance && dist <= thresholdDegrees) {
      minDistance = dist;
      closestTarget = target;
    }
  }

  return closestTarget;
}

/**
 * Projects a 3D target (yaw, pitch) onto a 2D screen coordinate.
 * @param {number} targetYaw 
 * @param {number} targetPitch 
 * @param {number} camYaw 
 * @param {number} camPitch 
 * @param {number} fovX Degrees (horizontal field of view)
 * @param {number} fovY Degrees (vertical field of view)
 * @returns {Object} { x, y, visible, distance } where x/y are percentages (0-100)
 */
export function projectTargetToScreen(targetYaw, targetPitch, camYaw, camPitch, fovX = 60, fovY = 45) {
  let dYaw = targetYaw - camYaw;
  // Normalize dYaw to -180..180
  while (dYaw > 180) dYaw -= 360;
  while (dYaw < -180) dYaw += 360;

  const dPitch = targetPitch - camPitch;

  const xPercent = 50 + (dYaw / fovX) * 50; 
  const yPercent = 50 - (dPitch / fovY) * 50;

  const visible = xPercent > -20 && xPercent < 120 && yPercent > -20 && yPercent < 120;
  const distance = Math.sqrt(dYaw * dYaw + dPitch * dPitch);

  return { x: xPercent, y: yPercent, visible, distance };
}
