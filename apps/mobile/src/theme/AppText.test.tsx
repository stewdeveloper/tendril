import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from './ThemeProvider';
import { AppText } from './AppText';

const flat = (el: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('AppText', () => {
  it('maps variants to the type scale and loaded font keys', async () => {
    await render(
      <ThemeProvider scheme="light">
        <AppText variant="title">Peace lily</AppText>
        <AppText variant="sci">Spathiphyllum</AppText>
        <AppText variant="caption">7 of 10 left this month</AppText>
      </ThemeProvider>,
    );
    expect(flat(screen.getByText('Peace lily'))).toMatchObject({
      fontFamily: 'Fraunces_600SemiBold',
      fontSize: 28,
      lineHeight: 34,
      color: '#1D2420',
    });
    expect(flat(screen.getByText('Spathiphyllum'))).toMatchObject({
      fontFamily: 'Inter_400Regular_Italic',
      fontSize: 15,
      lineHeight: 20,
    });
    expect(flat(screen.getByText('7 of 10 left this month'))).toMatchObject({
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
    });
  });
  it('uses theme colour names and dark mode', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <AppText variant="body" color="textSecondary">
          Kitchen
        </AppText>
      </ThemeProvider>,
    );
    expect(flat(screen.getByText('Kitchen'))).toMatchObject({ color: '#A9B5AE' });
  });
  it('lets text scale with the system setting (no truncation by default)', async () => {
    await render(
      <ThemeProvider scheme="light">
        <AppText variant="caption">Cats: No known toxicity</AppText>
      </ThemeProvider>,
    );
    const el = screen.getByText('Cats: No known toxicity');
    expect(el.props.numberOfLines).toBeUndefined();
    expect(el.props.allowFontScaling).not.toBe(false);
  });
});
