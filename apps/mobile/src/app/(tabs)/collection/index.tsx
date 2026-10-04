import { badgeShareMessage, resultCopy, type Badge } from '@tendril/core';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { useBadges, useFinds, usePlantdex, useProfile, useSets } from '../../../api/hooks';
import { PermissionPrimer, useStartScan } from '../../../components';
import { useInsets } from '../../../components/useInsets';
import {
  locationAccess,
  markLocationPrimerShown,
  requestLocation,
  wasLocationPrimerShown,
} from '../../../lib/useLocationAccess';
import {
  CollectionScreen,
  type CollectionSegment,
  type PlantdexFilter,
} from '../../../screens/collection/CollectionScreen';
import { useTheme } from '../../../theme';

const NOTICE_MS = 5000;
const SEGMENTS: readonly string[] = ['plantdex', 'sets', 'map', 'badges'];
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;
const asSegment = (value: string | undefined): CollectionSegment | undefined =>
  value && SEGMENTS.includes(value) ? (value as CollectionSegment) : undefined;

/**
 * The Collection tab. A saved find arrives with `saved=1` and gets its snackbar; the species card's
 * "See finds on the map" arrives with `segment=map`. Both are read once and cleared.
 */
export default function CollectionRoute() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useInsets();
  const params = useLocalSearchParams<{ saved?: string; segment?: string }>();
  const saved = first(params.saved);
  const wantedSegment = asSegment(first(params.segment));
  const [segment, setSegment] = useState<CollectionSegment>(wantedSegment ?? 'plantdex');
  const [filter, setFilter] = useState<PlantdexFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [primer, setPrimer] = useState(false);
  const plantdex = usePlantdex(filter);
  const sets = useSets();
  const finds = useFinds();
  const badges = useBadges();
  const profile = useProfile();
  const startScan = useStartScan();

  // Each request is read while rendering, once, so there is no frame before it; the effect clears it.
  const [sawSaved, setSawSaved] = useState(false);
  if (saved && !sawSaved) {
    setSawSaved(true);
    setNotice(resultCopy.findSaved);
  } else if (!saved && sawSaved) setSawSaved(false);
  const [sawSegment, setSawSegment] = useState<CollectionSegment | undefined>(wantedSegment);
  if (wantedSegment && wantedSegment !== sawSegment) {
    setSawSegment(wantedSegment);
    setSegment(wantedSegment);
  } else if (!wantedSegment && sawSegment) setSawSegment(undefined);
  useEffect(() => {
    if (saved) router.setParams({ saved: undefined });
  }, [saved, router]);
  useEffect(() => {
    if (wantedSegment) router.setParams({ segment: undefined });
  }, [wantedSegment, router]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The permission can change in Settings while the tab is away, so it is read on every focus.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void locationAccess().then((a) => live && setLocationGranted(a.status === 'granted'));
      return () => {
        live = false;
      };
    }, []),
  );

  const request = async () => setLocationGranted((await requestLocation()).status === 'granted');
  const turnOnLocation = async () => {
    const current = await locationAccess();
    if (current.status === 'granted') return setLocationGranted(true);
    if (!current.canAskAgain) {
      void Linking.openSettings();
      return;
    }
    // The first time, say why before the system asks.
    if (current.status === 'undetermined' && !wasLocationPrimerShown()) setPrimer(true);
    else await request();
  };
  const primerContinue = async () => {
    markLocationPrimerShown();
    setPrimer(false);
    await request();
  };
  const primerNotNow = () => {
    markLocationPrimerShown();
    setPrimer(false);
  };

  // Dismissing the share sheet can reject; that is not an error worth showing.
  const shareBadge = (badge: Badge) =>
    void Share.share({ message: badgeShareMessage(badge.name) }).catch(() => {});

  return (
    <View style={styles.root}>
      <CollectionScreen
        segment={segment}
        plantdex={plantdex.data ? { ...plantdex.data, filter } : null}
        sets={sets.data ?? []}
        finds={finds.data ?? []}
        locationGranted={locationGranted}
        badges={badges.data ?? []}
        avatarLetter={profile.data?.displayName.charAt(0).toUpperCase() ?? ''}
        notice={notice}
        onSegment={setSegment}
        onFilter={setFilter}
        onOpenSpecies={(id) => router.push(`/collection/species/${id}`)}
        onScan={startScan}
        onTurnOnLocation={() => void turnOnLocation()}
        onShareBadge={shareBadge}
        onAvatar={() => router.push('/profile')}
      />
      {primer ? (
        <View
          style={[styles.primer, { backgroundColor: c.background, paddingTop: insets.top + 24 }]}
        >
          <PermissionPrimer
            kind="location"
            continueLabel={resultCopy.allowLocation}
            onContinue={() => void primerContinue()}
            onNotNow={primerNotNow}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  primer: { ...StyleSheet.absoluteFill, zIndex: 10, paddingHorizontal: 16 },
});
