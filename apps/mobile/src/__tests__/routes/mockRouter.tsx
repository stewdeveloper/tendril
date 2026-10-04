import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * A stand-in for expo-router's `Stack` (and the js-tabs `Tabs`) that draws the screens it is given
 * as text, and drops those behind a closed `Stack.Protected` guard. Use it from a `jest.mock`
 * factory: `jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter())`.
 */
export function mockExpoRouter() {
  function Stack({ children }: { children?: ReactNode }) {
    return <View>{children}</View>;
  }
  function Protected({ guard, children }: { guard: boolean; children?: ReactNode }) {
    return guard ? <>{children}</> : null;
  }
  function Screen({ name }: { name: string }) {
    return <Text>{`screen:${name}`}</Text>;
  }
  Stack.Protected = Protected;
  Stack.Screen = Screen;
  return { Stack };
}

export function mockJsTabs() {
  function Tabs({ children }: { children?: ReactNode }) {
    return <View>{children}</View>;
  }
  function Screen({ name, options }: { name: string; options?: { href: null } }) {
    return <Text>{`${options ? 'hidden' : 'tab'}:${name}`}</Text>;
  }
  Tabs.Screen = Screen;
  return { Tabs };
}
