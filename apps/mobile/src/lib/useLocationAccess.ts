import * as Location from 'expo-location';

/** What the location permission allows: not asked yet, granted, or refused. */
export type LocationAccess = {
  status: 'granted' | 'undetermined' | 'denied';
  canAskAgain: boolean;
};

const access = (p: { granted: boolean; status: string; canAskAgain: boolean }): LocationAccess => ({
  status: p.granted ? 'granted' : p.status === 'undetermined' ? 'undetermined' : 'denied',
  canAskAgain: p.canAskAgain,
});

/** The current permission. It never prompts. */
export async function locationAccess(): Promise<LocationAccess> {
  try {
    return access(await Location.getForegroundPermissionsAsync());
  } catch {
    return { status: 'denied', canAskAgain: false };
  }
}

/** Asks the system for foreground location. */
export async function requestLocation(): Promise<LocationAccess> {
  try {
    return access(await Location.requestForegroundPermissionsAsync());
  } catch {
    return { status: 'denied', canAskAgain: false };
  }
}

// The primer is shown the first time only: once it has been answered, even with "Not now", the
// person is not asked again by the primer. Turn on location in the sheet is the way back.
let primerShown = false;
export const wasLocationPrimerShown = () => primerShown;
export const markLocationPrimerShown = () => {
  primerShown = true;
};
/** For tests. */
export const resetLocationPrimer = () => {
  primerShown = false;
};
