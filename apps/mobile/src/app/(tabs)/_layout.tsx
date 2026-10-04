import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '../../components/TabBar';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
    >
      <Tabs.Screen name="today/index" />
      <Tabs.Screen name="plants/index" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="collection/index" />
      <Tabs.Screen name="leagues/index" />
      {/* Streaks opens from Today, so it has no tab of its own. TabBar files it under Today. */}
      <Tabs.Screen name="today/streaks" options={{ href: null }} />
    </Tabs>
  );
}
