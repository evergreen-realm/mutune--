export function getPropertyCoords(prop) {
  if (!prop) return [39.6682, -4.0435];
  const coords = prop.location?.coordinates;
  if (coords && coords.length === 2 && coords[0] !== 0 && coords[1] !== 0) {
    return coords;
  }
  // Deterministic GPS fallback using string hash of property ID
  const hashStr = prop._id || prop.name || '';
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hash = hashStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const latOffset = (hash % 100) * 0.0001;
  const lngOffset = ((hash / 100) % 100) * 0.0001;
  return [39.6682 + lngOffset, -4.0435 + latOffset];
}
