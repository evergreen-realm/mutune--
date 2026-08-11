/**
 * Generates a spherical constellation of target capture points.
 * Targets are ordered sequentially: equator clockwise → upper ring.
 * This ordering drives the guidance UI so users follow a predictable path.
 * NYC Pilot uses 16 total targets — we match that count.
 * @param {string} density 'Fast' | 'Detailed'
 * @returns {Array} Array of target objects { id, yaw, pitch, ring, captured }
 */
export function generateSphericalTargets(density = 'Detailed') {
  const targets = [];
  let idCounter = 0;

  const addRing = (pitch, numPoints, ringName) => {
    const step = 360 / numPoints;
    for (let i = 0; i < numPoints; i++) {
      targets.push({
        id: idCounter++,
        yaw: i * step,
        pitch: pitch,
        ring: ringName,
        captured: false
      });
    }
  };

  if (density === 'Fast') {
    // Fast: 10 points on the equator (every 36°)
    addRing(0, 10, 'equator');
  } else {
    // Detailed: 16 points (10 equator @ 36° → 6 upper @ 60°)
    // Matches NYC Pilot's 16-target count with added ceiling coverage.
    // Lower ring removed: phone cameras capture floor in equator shots,
    // and looking down is the most error-prone gesture.
    addRing(0, 10, 'equator');
    addRing(40, 6, 'upper');
  }

  return targets;
}

/**
 * Returns the next target in sequential order (by ID).
 * This drives the UI guidance — users always know which target comes next.
 * Unlike getClosestUncapturedTarget (which is used for alignment detection),
 * this always returns the NEXT in the fixed sequence regardless of user position.
 * @param {Array} targets
 * @returns {Object|null}
 */
export function getNextSequentialTarget(targets) {
  return targets.find(t => !t.captured) || null;
}

/**
 * Spatial Hashing / Distance check to see if current yaw/pitch is close to an uncaptured target.
 * Returns the closest uncaptured target that is within thresholdDegrees.
 * If none is within threshold, returns the globally closest uncaptured target anyway
 * (so guidance never goes silent in irregular rooms where the user may be far from
 * the next fixed-grid point).
 * @param {number} currentYaw 
 * @param {number} currentPitch 
 * @param {Array} targets 
 * @param {number} thresholdDegrees 
 * @returns {Object|null} The matched target or null (only null when ALL targets captured)
 */
export function getClosestUncapturedTarget(currentYaw, currentPitch, targets, thresholdDegrees = 20) {
  let closestTarget = null;
  let minDistance = Infinity;
  let globalClosest = null;
  let globalMinDist = Infinity;

  for (const target of targets) {
    if (target.captured) continue;

    let dYaw = Math.abs(currentYaw - target.yaw);
    if (dYaw > 180) dYaw = 360 - dYaw; // Wrap around
    
    const dPitch = currentPitch - target.pitch;
    
    const dist = Math.sqrt(dYaw * dYaw + dPitch * dPitch);

    // Track global closest (regardless of threshold)
    if (dist < globalMinDist) {
      globalMinDist = dist;
      globalClosest = target;
    }

    // Track within-threshold closest
    if (dist < minDistance && dist <= thresholdDegrees) {
      minDistance = dist;
      closestTarget = target;
    }
  }

  // Always return a target if any remain uncaptured (prevents guidance from going silent)
  return closestTarget || globalClosest;
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

  let xPercent = 50 + (dYaw / fovX) * 50; 
  let yPercent = 50 - (dPitch / fovY) * 50;

  const visible = xPercent >= 5 && xPercent <= 95 && yPercent >= 5 && yPercent <= 95;
  let clamped = false;
  let angleToTarget = 0;

  if (!visible) {
    clamped = true;
    angleToTarget = Math.atan2(yPercent - 50, xPercent - 50) * (180 / Math.PI);
    
    // Clamp to boundaries (5% margin)
    xPercent = Math.max(5, Math.min(95, xPercent));
    yPercent = Math.max(5, Math.min(95, yPercent));
    
    // Push exactly to edge if out of bounds to maintain directional arrow
    const dx = xPercent - 50;
    const dy = yPercent - 50;
    if (Math.abs(dx) > Math.abs(dy)) {
        xPercent = dx > 0 ? 95 : 5;
        yPercent = 50 + (dy / Math.abs(dx)) * 45;
    } else {
        yPercent = dy > 0 ? 95 : 5;
        xPercent = 50 + (dx / Math.abs(dy)) * 45;
    }
  }

  const distance = Math.sqrt(dYaw * dYaw + dPitch * dPitch);

  return {
    x: Number(xPercent.toFixed(2)),
    y: Number(yPercent.toFixed(2)),
    visible,
    clamped,
    angleToTarget,
    distance
  };
}
