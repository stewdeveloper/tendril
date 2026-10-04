/**
 * A stand-in for expo-location under jest (mapped in jest.config.js), so no test asks the system
 * for a permission. `resetLocationMock()` puts the default back: permission not yet asked, and
 * granted when requested.
 */
export const getForegroundPermissionsAsync = jest.fn();
export const requestForegroundPermissionsAsync = jest.fn();
export const geocodeAsync = jest.fn();

export function resetLocationMock() {
  getForegroundPermissionsAsync
    .mockReset()
    .mockResolvedValue({ granted: false, status: 'undetermined', canAskAgain: true });
  requestForegroundPermissionsAsync
    .mockReset()
    .mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
  geocodeAsync.mockReset().mockResolvedValue([]);
}
resetLocationMock();
