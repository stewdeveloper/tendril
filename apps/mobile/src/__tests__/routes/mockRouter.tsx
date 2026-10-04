import { useEffect, type ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * What the router did, for assertions. One shared set of functions, so a test can import
 * `routerMock` and check `routerMock.replace` after a screen rendered through the mock below. Call
 * `resetRouterMock()` in `beforeEach`.
 */
export const routerMock = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};
/** What `useLocalSearchParams()` returns. Set `paramsMock.current = { id: 'monty' }` before rendering. */
export const paramsMock: { current: Record<string, string | string[]> } = { current: {} };
/** What `useNavigation()` returns. */
export const navigationMock = {
  setOptions: jest.fn(),
  getParent: jest.fn(),
  isFocused: jest.fn(() => true),
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => () => {}),
};
navigationMock.getParent.mockReturnValue(navigationMock);

export function resetRouterMock() {
  for (const fn of [...Object.values(routerMock), ...Object.values(navigationMock)]) fn.mockClear();
  routerMock.canGoBack.mockReturnValue(true);
  paramsMock.current = {};
}

type Href = string | { pathname: string; params?: Record<string, unknown> };
const hrefText = (href: Href) =>
  typeof href === 'string' ? href : `${href.pathname}${JSON.stringify(href.params ?? {})}`;

/**
 * A stand-in for expo-router that real screens can render against: `Stack` (and the js-tabs
 * `Tabs`) draw the screens they are given as text and drop those behind a closed
 * `Stack.Protected` guard; `useRouter`, `useLocalSearchParams`, `useNavigation` and
 * `useFocusEffect` read the shared mocks above; `Redirect` draws `redirect:<href>` and `Link` a
 * pressable link that pushes its href. Use it from a `jest.mock` factory:
 * `jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter())`.
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
  function Redirect({ href }: { href: Href }) {
    return <Text>{`redirect:${hrefText(href)}`}</Text>;
  }
  function Link({
    href,
    children,
    asChild,
  }: {
    href: Href;
    children?: ReactNode;
    asChild?: boolean;
  }) {
    if (asChild) return <>{children}</>;
    return (
      <Text accessibilityRole="link" onPress={() => routerMock.push(href)}>
        {children}
      </Text>
    );
  }
  /** Runs the callback once on mount and its cleanup on unmount, as a screen that is focused throughout. */
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(() => effect(), [effect]);
  }
  return {
    Stack,
    Redirect,
    Link,
    useFocusEffect,
    useRouter: () => routerMock,
    useLocalSearchParams: () => paramsMock.current,
    useNavigation: () => navigationMock,
  };
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
