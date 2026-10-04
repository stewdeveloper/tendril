export type LatLng = { lat: number; lng: number };

/**
 * Reads a stored point in any form the data API may hand back: EWKT (`SRID=4326;POINT(lng lat)`), hex EWKB (what
 * PostgREST returns for a geography column) or a GeoJSON Point. Returns null when it is none of those.
 */
export function parsePoint(v: unknown): LatLng | null {
  if (typeof v === 'object' && v !== null) {
    const g = v as { type?: unknown; coordinates?: unknown };
    if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const [lng, lat] = g.coordinates as number[];
      return finite(lat, lng);
    }
    return null;
  }
  if (typeof v !== 'string') return null;
  const wkt = /^(?:SRID=\d+;)?POINT\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)$/i.exec(v.trim());
  if (wkt) return finite(Number(wkt[2]), Number(wkt[1]));
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(v) || v.length < 42) return null;
  const bytes = Uint8Array.from(v.match(/../g)!, (h) => parseInt(h, 16));
  const view = new DataView(bytes.buffer);
  const little = bytes[0] === 1;
  const type = view.getUint32(1, little);
  if ((type & 0xff) !== 1) return null; // not a Point
  let offset = 5;
  if (type & 0x20000000) offset += 4; // SRID present
  if (bytes.length < offset + 16) return null;
  return finite(view.getFloat64(offset + 8, little), view.getFloat64(offset, little));
}

function finite(lat: unknown, lng: unknown): LatLng | null {
  return typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}
