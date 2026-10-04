import { copy, onboardingCopy } from '@tendril/core';
import Lock from 'lucide-react-native/icons/lock';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, HomeAreaMap, TextField } from '../../components';
import { DECORATIVE } from '../../components/decorative';
import type { MapCenter } from '../../components/HomeAreaParts';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';
import { OnboardingProgress } from './OnboardingProgress';

export interface HomeAreaScreenProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** The search was submitted. */
  onSearch: () => void;
  /** The last search found nothing: shows the "couldn't find that town" card and dims the map. */
  notFound: boolean;
  center?: MapCenter;
  onCenterChange?: (center: MapCenter) => void;
  radiusM: number;
  onRadiusChange: (radiusM: number) => void;
  onSave: () => void;
  onSkip: () => void;
  onBack: () => void;
  saving?: boolean;
  /** False until a town is found or the map is moved. Default true. */
  canSave?: boolean;
  /** Forces the search field's focused look, for the catalog. */
  searchFocused?: boolean;
}

/** Where the map sits below the top of the content: just under the search, or below the card. */
const MAP_TOP = { found: 181, notFound: 341 };

/**
 * Where's home? (3i, 3j): search for a town or move the area on the map. No location prompt: the
 * person places the area themselves. The area is never public, which the lock line says.
 */
export function HomeAreaScreen({
  query,
  onQueryChange,
  onSearch,
  notFound,
  center,
  onCenterChange,
  radiusM,
  onRadiusChange,
  onSave,
  onSkip,
  onBack,
  saving,
  canSave = true,
  searchFocused,
}: HomeAreaScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.top, { top: insets.top }]}>
        <OnboardingProgress
          step={4}
          onBack={onBack}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip"
              onPress={onSkip}
              style={styles.skip}
            >
              <AppText variant="bodyStrong" color="primary">
                Skip
              </AppText>
            </Pressable>
          }
        />
        <AppText variant="title" accessibilityRole="header">
          {onboardingCopy.homeAreaTitle}
        </AppText>
        <TextField
          variant="search"
          label="Search for a town"
          placeholder="Search for a town"
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          autoCapitalize="words"
          autoCorrect={false}
          focused={searchFocused ?? notFound}
          error={
            notFound
              ? { title: onboardingCopy.townNotFoundTitle, body: onboardingCopy.townNotFoundBody }
              : undefined
          }
        />
      </View>
      <View
        style={[styles.map, { top: insets.top + (notFound ? MAP_TOP.notFound : MAP_TOP.found) }]}
      >
        <HomeAreaMap
          height={notFound ? 170 : 330}
          radiusM={radiusM}
          onRadiusChange={onRadiusChange}
          center={center}
          onCenterChange={onCenterChange}
          inactive={notFound}
        />
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.lock}>
          <View style={styles.lockIcon}>
            <Lock {...DECORATIVE} size={20} color={c.primary} strokeWidth={2} />
          </View>
          <AppText variant="sub" style={styles.lockText}>
            {copy.homeArea}
          </AppText>
        </View>
        <Button
          label="Save area"
          disabled={notFound || !canSave}
          loading={saving}
          onPress={onSave}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, gap: 16, zIndex: 3 },
  skip: { height: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  map: { position: 'absolute', left: 16, right: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  lock: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lockIcon: { marginTop: 1 },
  lockText: { flex: 1 },
});
