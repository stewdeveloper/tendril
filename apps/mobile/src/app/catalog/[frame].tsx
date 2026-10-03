import { colors } from '@tendril/core';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { CatalogFrame } from '../../catalog/CatalogFrame';
import { catalogEnabled } from '../../catalog/enabled';
import '../../catalog/frames';
import { getFrame, listFrames } from '../../catalog/registry';
import { AppText, ThemeProvider } from '../../theme';

export function CatalogScreen({ frameId }: { frameId: string }) {
  const entry = getFrame(frameId);
  if (!entry) {
    return (
      <ThemeProvider scheme="light">
        <View style={{ flex: 1, padding: 24, gap: 8, backgroundColor: colors.light.background }}>
          <AppText variant="heading">{`No frame ${frameId}`}</AppText>
          <AppText variant="sub" color="textSecondary">
            {`Registered: ${
              listFrames()
                .map((f) => f.id)
                .join(', ') || 'none'
            }`}
          </AppText>
        </View>
      </ThemeProvider>
    );
  }
  return (
    <ScrollView
      horizontal
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      // Dev-tool stage colour, outside the app UI and not a design token.
      style={{ backgroundColor: '#E8E6DF' }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 10 }}>
        <CatalogFrame entry={entry} />
      </ScrollView>
    </ScrollView>
  );
}

export default function CatalogRoute() {
  const { frame } = useLocalSearchParams<{ frame: string }>();
  if (!catalogEnabled) return <Redirect href="/" />;
  return <CatalogScreen frameId={frame} />;
}
