import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TabBarVisibilityProvider, useHideTabBar, useTabBarHidden } from './TabBarVisibility';

function Reader() {
  return <Text>{useTabBarHidden() ? 'hidden' : 'shown'}</Text>;
}
function Hider({ hidden }: { hidden: boolean }) {
  useHideTabBar(hidden);
  return null;
}
const tree = (...hiders: boolean[]) => (
  <TabBarVisibilityProvider>
    <Reader />
    {hiders.map((hidden, i) => (
      <Hider key={i} hidden={hidden} />
    ))}
  </TabBarVisibilityProvider>
);

describe('tab bar visibility', () => {
  it('shows the bar unless a screen hides it', async () => {
    await render(tree());
    expect(screen.getByText('shown')).toBeTruthy();
  });

  it('hides the bar while a screen asks, and shows it again when that stops or unmounts', async () => {
    const view = await render(tree(true));
    expect(screen.getByText('hidden')).toBeTruthy();
    await view.rerender(tree(false));
    expect(screen.getByText('shown')).toBeTruthy();
    await view.rerender(tree(true));
    expect(screen.getByText('hidden')).toBeTruthy();
    await view.rerender(
      <TabBarVisibilityProvider>
        <Reader />
      </TabBarVisibilityProvider>,
    );
    expect(screen.getByText('shown')).toBeTruthy();
  });

  it('stays hidden until every hiding screen has stopped', async () => {
    const view = await render(tree(true, true));
    await view.rerender(tree(true, false));
    expect(screen.getByText('hidden')).toBeTruthy();
    await view.rerender(tree(false, false));
    expect(screen.getByText('shown')).toBeTruthy();
  });

  it('does nothing outside a provider', async () => {
    await render(
      <>
        <Reader />
        <Hider hidden />
      </>,
    );
    expect(screen.getByText('shown')).toBeTruthy();
  });
});
