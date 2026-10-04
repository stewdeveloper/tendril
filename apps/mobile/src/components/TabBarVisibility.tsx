import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface TabBarVisibility {
  hidden: boolean;
  /** Registers one screen that wants the bar hidden; returns what to call when it stops. */
  hide: () => () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

/**
 * Lets a screen inside the tabs hide the tab bar. The bar is drawn by the tab navigator, above
 * the screens, so a screen can't remove it itself: it tells this provider (which wraps the
 * navigator), and the router-bound `TabBar` reads it. Counted, so two screens hiding the bar at
 * once don't un-hide it when the first goes away.
 */
export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const hide = useCallback(() => {
    setCount((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setCount((n) => n - 1);
    };
  }, []);
  const value = useMemo(() => ({ hidden: count > 0, hide }), [count, hide]);
  return (
    <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>
  );
}

/** True while some screen has asked for the bar to be hidden. False outside a provider. */
export function useTabBarHidden(): boolean {
  return useContext(TabBarVisibilityContext)?.hidden ?? false;
}

/**
 * Hides the tab bar while `hidden` is true and this screen is focused (a plant that has died or
 * been given away shows no bar, frames 4k and 4l). Only while focused: a stack screen stays
 * mounted underneath the next one, and must not keep the bar hidden for it. Does nothing outside
 * a provider.
 */
export function useHideTabBar(hidden: boolean): void {
  const hide = useContext(TabBarVisibilityContext)?.hide;
  useFocusEffect(
    useCallback(() => {
      if (!hidden || !hide) return;
      return hide();
    }, [hidden, hide]),
  );
}
