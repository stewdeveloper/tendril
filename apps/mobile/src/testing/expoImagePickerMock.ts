/**
 * A stand-in for expo-image-picker under jest (mapped in jest.config.js), so no test opens a real
 * camera or library. Each function is a jest.fn that a test can steer; `resetImagePickerMock()`
 * puts the defaults back: permission granted, and one photo for either source.
 */
const photo = (uri: string) => ({ canceled: false, assets: [{ uri, width: 800, height: 800 }] });

export const requestCameraPermissionsAsync = jest.fn();
export const launchCameraAsync = jest.fn();
export const launchImageLibraryAsync = jest.fn();

export function resetImagePickerMock() {
  requestCameraPermissionsAsync.mockReset().mockResolvedValue({ granted: true, status: 'granted' });
  launchCameraAsync.mockReset().mockResolvedValue(photo('file:///camera-1.jpg'));
  launchImageLibraryAsync.mockReset().mockResolvedValue(photo('file:///library-1.jpg'));
}
resetImagePickerMock();
