import type { MapCenter } from '../components/HomeAreaParts';

/**
 * Towns the fixture world knows, so the home-area step can be walked through on the web and in
 * tests, where there is no geocoder. Only used when the app runs against the fixture API.
 */
const FIXTURE_TOWNS: Record<string, MapCenter> = {
  ballynahinch: { lat: 54.4026, lng: -5.9163 },
  dublin: { lat: 53.3498, lng: -6.2603 },
  cork: { lat: 51.8985, lng: -8.4756 },
  galway: { lat: 53.2707, lng: -9.0568 },
  belfast: { lat: 54.5973, lng: -5.9301 },
};

/**
 * The map centre for a town name, or null when it can't be found (or the lookup fails: a failed
 * lookup reads as "couldn't find that town", and the person can move the map instead). On a device
 * this asks the system geocoder, which needs no location permission.
 */
export async function findTown(query: string): Promise<MapCenter | null> {
  const name = query.trim();
  if (!name) return null;
  if (process.env.EXPO_PUBLIC_API_MODE !== 'supabase') {
    return FIXTURE_TOWNS[name.toLowerCase()] ?? null;
  }
  try {
    const Location = await import('expo-location');
    const [hit] = await Location.geocodeAsync(name);
    return hit ? { lat: hit.latitude, lng: hit.longitude } : null;
  } catch {
    return null;
  }
}
