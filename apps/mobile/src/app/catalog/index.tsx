import { Link, Redirect } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { catalogEnabled } from '../../catalog/enabled';
import '../../catalog/frames';
import { listFrames } from '../../catalog/registry';
import { AppText, useTheme } from '../../theme';

export default function CatalogIndex() {
  const { c } = useTheme();
  if (!catalogEnabled) return <Redirect href="/" />;
  const frames = listFrames();
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: 24, paddingTop: 64, gap: 4 }}
    >
      <AppText variant="title">Frame catalog</AppText>
      {frames.length === 0 ? (
        <AppText variant="sub" color="textSecondary">
          No frames registered yet.
        </AppText>
      ) : (
        frames.map((f) => (
          <Link key={f.id} href={`/catalog/${f.id}`} asChild>
            <Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
              <AppText variant="body" color="primary">{`${f.id}  ${f.title}`}</AppText>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}
