import { View } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import { DeviceChrome } from './DeviceChrome';
import type { FrameEntry } from './registry';

/** iPhone 16: 393×852 pt, safe areas 59 top and 34 bottom (UX brief). */
const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
};

export function CatalogFrame({ entry }: { entry: FrameEntry }) {
  const scheme = entry.scheme ?? 'light';
  return (
    <ThemeProvider scheme={scheme}>
      {/* Static contexts, not SafeAreaProvider: a nested provider's initialMetrics are replaced by
          the device's real insets (0 on web) as soon as it mounts. */}
      <SafeAreaFrameContext.Provider value={METRICS.frame}>
        <SafeAreaInsetsContext.Provider value={METRICS.insets}>
          <View testID="catalog-frame" style={{ width: 393, height: 852, overflow: 'hidden' }}>
            {entry.render()}
            <DeviceChrome
              scheme={scheme}
              statusBar={entry.statusBar ?? (scheme === 'dark' ? 'light' : 'dark')}
            />
          </View>
        </SafeAreaInsetsContext.Provider>
      </SafeAreaFrameContext.Provider>
    </ThemeProvider>
  );
}
