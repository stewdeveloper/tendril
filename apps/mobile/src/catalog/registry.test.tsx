import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getFrame, listFrames, registerFrame } from './registry';
import { CatalogScreen } from '../app/catalog/[frame]';

describe('catalog registry', () => {
  it('registers and finds frames', () => {
    registerFrame({ id: 'zz-test', title: 'Test frame', render: () => <Text>hello frame</Text> });
    expect(getFrame('zz-test')?.title).toBe('Test frame');
    expect(listFrames().map((f) => f.id)).toContain('zz-test');
  });
  it('throws on a duplicate id in development', () => {
    registerFrame({ id: 'zz-dup', title: 'One', render: () => <Text>one</Text> });
    expect(() =>
      registerFrame({ id: 'zz-dup', title: 'Two', render: () => <Text>two</Text> }),
    ).toThrow(/zz-dup/);
  });
  it('renders an unknown id as a helpful message, not a crash', async () => {
    await render(<CatalogScreen frameId="nope" />);
    expect(screen.getByText(/No frame nope/)).toBeTruthy();
    expect(screen.getByText(/Registered: .*zz-test/)).toBeTruthy();
  });
  it('renders a registered frame inside device chrome', async () => {
    registerFrame({ id: 'zz-two', title: 'Two', render: () => <Text>inside</Text> });
    await render(<CatalogScreen frameId="zz-two" />);
    expect(screen.getByText('inside')).toBeTruthy();
    expect(screen.getByText('9:41', { hidden: true })).toBeTruthy();
    // The chrome is decorative: screen readers must not reach it.
    expect(screen.queryByText('9:41')).toBeNull();
  });
});
