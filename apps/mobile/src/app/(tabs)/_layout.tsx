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
      {/* A nested Stack: the list, and a plant's page above it with the bar still showing. */}
      <Tabs.Screen name="plants" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="collection/index" />
      <Tabs.Screen name="leagues/index" />
    </Tabs>
  );
}
