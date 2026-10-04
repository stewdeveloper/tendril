import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

/**
 * Jest stand-in for react-native-maps, which is a native module. `MapView`, `Marker` and `Circle`
 * are plain Views that keep every prop (so a test can read `coordinate` or `radius`) and render
 * their children. Wired up by `moduleNameMapper` in jest.config.js.
 */
type MapProps = ViewProps & Record<string, unknown> & { children?: ReactNode };

export default function MapView(props: MapProps) {
  return <View {...(props as ViewProps)} />;
}
export function Marker(props: MapProps) {
  return <View {...(props as ViewProps)} />;
}
export function Circle(props: MapProps) {
  return <View {...(props as ViewProps)} />;
}
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
