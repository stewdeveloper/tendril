import { Stack } from 'expo-router';
import { useSession } from '../../session/SessionProvider';
import { useTheme } from '../../theme';

/**
 * Onboarding. Once someone has said they're under 13, every screen but the stop is guarded out,
 * so the stop is all that remains: there is no way back to sign-in, even after a restart.
 */
export default function OnboardingLayout() {
  const { ageBlocked } = useSession();
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Protected guard={!ageBlocked}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="age" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="link-sent" />
        <Stack.Screen name="link-expired" />
        <Stack.Screen name="pets" />
        <Stack.Screen name="home-area" />
        <Stack.Screen name="first-scan" />
      </Stack.Protected>
      <Stack.Screen name="age-stop" />
    </Stack>
  );
}
