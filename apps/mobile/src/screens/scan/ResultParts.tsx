import {
  colors,
  radius,
  resultCopy,
  resultPhotoCount,
  type Animal,
  type DiagnosisResult,
  type Pet,
  type Severity,
  type ToxicityEntry,
} from '@tendril/core';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import X from 'lucide-react-native/icons/x';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card } from '../../components/Card';
import { ConfidenceLabel } from '../../components/ConfidenceLabel';
import { PhotoSlot } from '../../components/PhotoSlot';
import { VerdictChip } from '../../components/VerdictChip';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

// White over a photo in both schemes, like the status bar in DeviceChrome.
const ON_PHOTO = colors.light.surface;

export interface ResultFrameProps {
  /** Photo height and where the content sheet starts: 280/256 (2a), 220/196 (2c), 236/212 elsewhere. */
  photoHeight: number;
  sheetTop: number;
  photoUri: string | null;
  photoLabel: string;
  /** The top-left circle: Close (an X, 2a and 2c) or Back (a chevron, 4v to 4y). */
  leading: 'close' | 'back';
  onLeading: () => void;
  /** Every photo of the scan; two or more draw the count pill and the strip over the hero. */
  photoUrls?: string[];
  /** The content scrolls and ends above `footer` (2a, 2c). Otherwise it fills the sheet. */
  footer?: ReactNode;
  /** Space between the sections: 24 on the full result (2a), 18 elsewhere. */
  gap?: number;
  children: ReactNode;
}

/**
 * The result's chrome: the photo on top with a scrim, the Close or Back circle, a rounded content
 * sheet that overlaps the photo, and an optional footer pinned to the bottom. With several photos
 * a strip of thumbnails sits over the photo and picks which one is shown.
 */
export function ResultFrame({
  photoHeight,
  sheetTop,
  photoUri,
  photoLabel,
  leading,
  onLeading,
  photoUrls = [],
  footer,
  gap = 18,
  children,
}: ResultFrameProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const [selected, setSelected] = useState(0);
  const several = photoUrls.length > 1;
  const shown = several ? (photoUrls[selected] ?? null) : photoUri;
  const Glyph = leading === 'close' ? X : ChevronLeft;
  const bottom = Math.max(42, insets.bottom + 8);
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.photo, { height: photoHeight }]}>
        <PhotoSlot uri={shown || null} label={photoLabel} height={photoHeight} />
      </View>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]} />
      <View style={[styles.topRow, { top: insets.top + 1 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
          onPress={onLeading}
          style={[styles.circle, { backgroundColor: c.photoButton }]}
        >
          <Glyph size={24} color={ON_PHOTO} strokeWidth={2} />
        </Pressable>
        {several ? (
          <View style={[styles.count, { backgroundColor: c.photoButton }]}>
            <AppText variant="caption" color={ON_PHOTO}>
              {resultPhotoCount(photoUrls.length)}
            </AppText>
          </View>
        ) : null}
      </View>
      {several ? (
        <View style={[styles.strip, { top: sheetTop - 60 }]}>
          {photoUrls.map((uri, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1}`}
              accessibilityState={{ selected: i === selected }}
              onPress={() => setSelected(i)}
              style={[styles.thumb, { opacity: i === selected ? 1 : 0.85 }]}
            >
              <PhotoSlot uri={uri || null} label={`Photo ${i + 1}`} height={44} showLabel={false} />
              {i === selected ? (
                <View pointerEvents="none" style={[styles.thumbRing, { borderColor: ON_PHOTO }]} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.sheet, { top: sheetTop, backgroundColor: c.background }]}>
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={[
            styles.content,
            // The scrolling pages leave room for the footer; the others end 42 pt above the bottom.
            { gap, paddingBottom: footer ? 140 : bottom },
          ]}
        >
          {children}
        </ScrollView>
      </View>
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: c.background, borderTopColor: c.hairline, paddingBottom: bottom },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** The minimal "Health check" card (no frame shows it): the condition, how sure, and where the advice goes. */
export function HealthCheckCard({ diagnosis }: { diagnosis: DiagnosisResult }) {
  return (
    <Card gap={8}>
      <AppText variant="heading" accessibilityRole="header">
        {resultCopy.healthCheckTitle}
      </AppText>
      <View style={styles.healthRow}>
        <AppText variant="bodyStrong" style={styles.healthName}>
          {diagnosis.conditionName}
        </AppText>
        <ConfidenceLabel probability={diagnosis.probability} />
      </View>
      <AppText variant="sub" color="textSecondary">
        {resultCopy.healthCheckLine}
      </AppText>
    </Card>
  );
}

const severityOf = (entry: ToxicityEntry | undefined, reassure: boolean): Severity =>
  // "No known toxicity" needs a source behind it, and a match that is not yet confirmed must not
  // reassure: either way the verdict is Unknown.
  entry && !(entry.severity === 'none' && (!entry.sourceName || !reassure))
    ? entry.severity
    : 'unknown';

/**
 * One chip per kind of pet in the household (4v, 2c). With `settled` false every chip reads
 * Unknown: a match that is not sure never states a verdict about the plant. With `reassure` false
 * (a likely match) a toxic verdict shows but "no known toxicity" reads Unknown.
 */
export function PetVerdictChips({
  pets,
  toxicity,
  settled,
  reassure = true,
}: {
  pets: Pet[];
  toxicity: ToxicityEntry[];
  settled: boolean;
  reassure?: boolean;
}) {
  const animals = [...new Set(pets.map((p): Animal => p.animal))];
  if (animals.length === 0) return null;
  return (
    <View style={styles.chips}>
      {animals.map((animal) => (
        <VerdictChip
          key={animal}
          animal={animal}
          severity={
            settled
              ? severityOf(
                  toxicity.find((t) => t.animal === animal),
                  reassure,
                )
              : 'unknown'
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  photo: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 112, pointerEvents: 'none' },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  strip: { position: 'absolute', left: 16, flexDirection: 'row', gap: 8, zIndex: 3 },
  thumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
  thumbRing: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: 10 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
    zIndex: 4,
  },
  content: { flexGrow: 1, paddingTop: 20, paddingHorizontal: 16, gap: 18 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    zIndex: 5,
  },
  healthRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  healthName: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
