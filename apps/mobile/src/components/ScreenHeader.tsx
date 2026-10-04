import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface ScreenHeaderProps {
  title: string;
  /** The first letter of the signed-in person's handle. */
  avatarLetter: string;
  onAvatarPress: () => void;
  subtitle?: string;
}

/** A tab screen's title row (2e, 4a): Fraunces 28 title on the left, the profile avatar on the right. */
export function ScreenHeader({ title, avatarLetter, onAvatarPress, subtitle }: ScreenHeaderProps) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="sub" color="textSecondary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={onAvatarPress}
        style={[styles.avatar, { backgroundColor: c.primaryTint }]}
      >
        <AppText variant="bodyStrong" color="primary" maxFontSizeMultiplier={1.3}>
          {avatarLetter}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  titles: { flex: 1 },
  subtitle: { lineHeight: 20 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
