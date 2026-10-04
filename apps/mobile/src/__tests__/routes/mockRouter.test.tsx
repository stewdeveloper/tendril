import { fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import {
  Link,
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import { Text } from 'react-native';
import { navigationMock, paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());

describe('mockExpoRouter', () => {
  beforeEach(() => resetRouterMock());

  it('draws a Redirect as text with its href', async () => {
    await render(<Redirect href="/camera" />);
    expect(screen.getByText('redirect:/camera')).toBeTruthy();
    await render(<Redirect href={{ pathname: '/scan/[id]', params: { id: 'x' } }} />);
    expect(screen.getByText('redirect:/scan/[id]{"id":"x"}')).toBeTruthy();
  });

  it('draws a Link that pushes its href, or passes its child through with asChild', async () => {
    await render(
      <>
        <Link href="/paywall">Try Premium</Link>
        <Link href="/paywall" asChild>
          <Text>Child</Text>
        </Link>
      </>,
    );
    await fireEvent.press(screen.getByRole('link', { name: 'Try Premium' }));
    expect(routerMock.push).toHaveBeenCalledWith('/paywall');
    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('serves the router, the params and the navigation object from shared mocks', async () => {
    paramsMock.current = { id: 'monty' };
    const { result } = await renderHook(() => ({
      router: useRouter(),
      params: useLocalSearchParams(),
      navigation: useNavigation(),
    }));
    expect(result.current.params).toEqual({ id: 'monty' });
    expect(result.current.router).toBe(routerMock);
    expect(result.current.navigation).toBe(navigationMock);
    result.current.navigation.getParent()?.setOptions({ title: 'x' });
    expect(navigationMock.setOptions).toHaveBeenCalledWith({ title: 'x' });
    resetRouterMock();
    expect(paramsMock.current).toEqual({});
  });

  it('runs a focus effect on mount and cleans up on unmount', async () => {
    const cleanup = jest.fn();
    const effect = jest.fn(() => cleanup);
    function Screen() {
      useFocusEffect(effect);
      return null;
    }
    const view = await render(<Screen />);
    expect(effect).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
