import type { ExpoConfig } from 'expo/config';

const appId = process.env.TENDRIL_APP_ID ?? 'app.tendril';

const config: ExpoConfig = {
  name: 'Tendril',
  slug: 'tendril',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'tendril',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: appId, supportsTablet: false },
  android: { package: appId, predictiveBackGestureEnabled: false },
  web: { output: 'single', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#FBFAF6', image: './assets/images/splash-icon.png', imageWidth: 76 },
    ],
  ],
  experiments: { typedRoutes: false, reactCompiler: true },
};

export default config;
