import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View } from 'react-native';

/**
 * A stand-in for expo-camera under jest (mapped in jest.config.js), so no test opens a real
 * camera. `permission` is what `useCameraPermissions()` reports, `cameraProps` the props the last
 * `CameraView` was rendered with (a test calls `cameraProps.current.onBarcodeScanned(...)`), and
 * `takePictureAsync` what the shutter calls. `resetCameraMock()` puts the defaults back:
 * permission granted, and one 4000 x 3000 photo per shutter press.
 */
type Permission = { granted: boolean; status: string; canAskAgain: boolean };
const GRANTED: Permission = { granted: true, status: 'granted', canAskAgain: true };

export const permission: { current: Permission | null } = { current: GRANTED };
export const requestPermission = jest.fn();
export const takePictureAsync = jest.fn();
export const cameraProps: { current: any } = { current: null };

export function resetCameraMock() {
  permission.current = GRANTED;
  cameraProps.current = null;
  requestPermission.mockReset().mockImplementation(async () => permission.current);
  takePictureAsync
    .mockReset()
    .mockResolvedValue({ uri: 'file:///shutter-1.jpg', width: 4000, height: 3000 });
}
resetCameraMock();

export function useCameraPermissions() {
  return [permission.current, requestPermission] as const;
}

export const CameraView = forwardRef(function CameraView(props: object, ref) {
  // Recorded after the render, so a test reads the props of the camera that is on screen.
  useEffect(() => {
    cameraProps.current = props;
  });
  useImperativeHandle(ref, () => ({ takePictureAsync }));
  return <View testID="camera-view" />;
});
