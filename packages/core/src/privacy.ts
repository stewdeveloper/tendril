export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Uniform random point within radius/2 of home; stored radius grows by half, so home stays covered. */
export function randomizeZone(
  home: LatLng,
  radiusM: number,
  rand: () => number,
): { center: LatLng; radiusM: number } {
  if (!Number.isFinite(radiusM) || radiusM <= 0) throw new RangeError('radiusM must be positive');
  if (!(Math.abs(home.lat) <= 90) || !(Math.abs(home.lng) <= 180)) {
    throw new RangeError('home is out of range');
  }
  const maxOffset = radiusM / 2;
  const d = maxOffset * Math.sqrt(rand());
  const bearing = 2 * Math.PI * rand();
  const lat1 = rad(home.lat);
  const lng1 = rad(home.lng);
  const ang = d / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    center: { lat: deg(lat2), lng: ((deg(lng2) + 540) % 360) - 180 },
    radiusM: Math.round(radiusM * 1.5),
  };
}

export function isInsideZone(point: LatLng, zone: { center: LatLng; radiusM: number }): boolean {
  return distanceM(point, zone.center) <= zone.radiusM;
}
