import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** True while this screen is the one in front. A screen under another one is not focused. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
