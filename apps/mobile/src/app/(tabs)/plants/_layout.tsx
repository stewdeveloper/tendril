import { Stack } from 'expo-router';
import { useTheme } from '../../../theme';

// A plant's page opens inside the My Plants tab, so the tab bar stays under it (frames 2d, 6d).
// Landing straight on a plant, from Today or a link, still leaves the list underneath to go back to.
export const unstable_settings = { initialRouteName: 'index' };

export default function PlantsLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
    </Stack>
  );
}
