import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const t = useTheme();
  return <Text>{`${t.scheme} ${t.c.background} ${t.verdict.moderate} ${t.c.onChip}`}</Text>;
}

describe('ThemeProvider', () => {
  it('serves the forced scheme tokens', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('dark #121714 #F0A07F #0E1A13')).toBeTruthy();
  });
});
