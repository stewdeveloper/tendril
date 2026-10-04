import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SessionProvider, useSession } from './SessionProvider';

function Probe() {
  const s = useSession();
  return <Text onPress={() => s.blockForAge()}>{`${s.status} ${s.ageBlocked}`}</Text>;
}

describe('SessionProvider', () => {
  it('starts signed out and remembers an age block across remounts', async () => {
    const first = await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText('signed_out false')).toBeTruthy();
    await act(async () => screen.getByText('signed_out false').props.onPress());
    expect(await screen.findByText('signed_out true')).toBeTruthy();
    await first.unmount();
    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText('signed_out true')).toBeTruthy();
  });
});
