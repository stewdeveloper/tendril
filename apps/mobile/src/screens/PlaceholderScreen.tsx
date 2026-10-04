import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useProfile } from '../api/hooks';
import { BackBar, ScreenHeader } from '../components';
import { useInsets } from '../components/useInsets';
import { AppText, useTheme } from '../theme';

export interface PlaceholderScreenProps {
  title: string;
  /** The design frames this route will hold, e.g. "2e, 4a, 4b". Empty for routes with no frame. */
  frames: string;
  /**
   * `tab` draws a tab screen's header, `stack` a back row above the title, `plain` just the title
   * (for screens that have no way back).
   */
  kind?: 'tab' | 'stack' | 'plain';
}

/** Stands in for a screen until Phase 1B builds it. The route exists, so navigation already works. */
export function PlaceholderScreen({ title, frames, kind = 'stack' }: PlaceholderScreenProps) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useInsets();
  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      {kind === 'tab' ? (
        <TabHeader title={title} />
      ) : (
        <>
          {kind === 'stack' ? (
            <BackBar
              label="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          ) : null}
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
        </>
      )}
      <AppText variant="sub" color="textSecondary">
        {frames ? `Design frames: ${frames}` : 'No design frame. Built on existing components.'}
      </AppText>
    </View>
  );
}

/** A tab screen's header, with the avatar letter read from the profile. */
function TabHeader({ title }: { title: string }) {
  const router = useRouter();
  const profile = useProfile();
  const letter = profile.data?.displayName.charAt(0).toUpperCase() ?? '';
  return (
    <ScreenHeader
      title={title}
      avatarLetter={letter}
      onAvatarPress={() => router.push('/profile')}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, gap: 16 },
});
