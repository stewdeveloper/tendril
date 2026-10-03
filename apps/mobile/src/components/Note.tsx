import { radius } from '@tendril/core';
import Info from 'lucide-react-native/icons/info';
import Lock from 'lucide-react-native/icons/lock';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface NoteProps {
  text: string;
  /** `tint` is the calm default (4b); `dark` is the inverse banner (4e, offline). */
  tone?: 'tint' | 'dark';
  icon?: 'info' | 'lock';
}

/** An inline sentence in a rounded box with a 20 pt icon (4b). */
export function Note({ text, tone = 'tint', icon = 'info' }: NoteProps) {
  const { c } = useTheme();
  const dark = tone === 'dark';
  // The dark tone is the inverse of the page: ink background with the surface colour as its text.
  const fg = dark ? c.surface : c.textPrimary;
  const Glyph = icon === 'lock' ? Lock : Info;
  return (
    <View style={[styles.box, { backgroundColor: dark ? c.textPrimary : c.primaryTint }]}>
      <View style={styles.icon}>
        <Glyph size={20} color={fg} strokeWidth={2} />
      </View>
      <AppText variant="sub" color={fg} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.note,
  },
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
