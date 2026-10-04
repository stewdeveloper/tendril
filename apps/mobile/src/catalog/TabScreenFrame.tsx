import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { TabBarView, type TabKey } from '../components/TabBar';
import { useTheme } from '../theme';

const noop = () => {};

export interface TabScreenFrameProps {
  active: TabKey;
  children: ReactNode;
}

/**
 * A screen body above the tab bar, laid out exactly as the app does it: the body fills the space
 * above, the bar is in flow beneath it (56 pt plus the bottom inset), and the body ends at the bar.
 * Catalog frames whose design shows the tab bar (about 22 of them in 1B) wrap their body in this.
 */
export function TabScreenFrame({ active, children }: TabScreenFrameProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.body}>{children}</View>
      <TabBarView active={active} onTab={noop} onScan={noop} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
});
