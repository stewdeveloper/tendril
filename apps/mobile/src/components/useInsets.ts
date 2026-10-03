import { useContext } from 'react';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

const NONE: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The safe-area insets (the same value `useSafeAreaInsets()` returns), but zero outside a
 * provider instead of throwing, so components render in unit tests without one.
 */
export function useInsets(): EdgeInsets {
  return useContext(SafeAreaInsetsContext) ?? NONE;
}
