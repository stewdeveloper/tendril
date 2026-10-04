import { StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useInsets } from '../../components/useInsets';
import { useTheme } from '../../theme';

export interface ScanTabScreenProps {
  avatarLetter: string;
  onAvatar: () => void;
}

/**
 * The Scan tab's own screen (4af, 4ag): only a header. It is reached at the identification cap,
 * where the "Limit reached" sheet goes over it; under the cap the Scan button opens the camera
 * instead, so there is nothing else to show here.
 */
export function ScanTabScreen({ avatarLetter, onAvatar }: ScanTabScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <ScreenHeader title="Scan" avatarLetter={avatarLetter} onAvatarPress={onAvatar} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
});
