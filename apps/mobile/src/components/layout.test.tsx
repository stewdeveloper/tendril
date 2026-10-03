import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import {
  BackBar,
  Button,
  HERO_CONTENT_TOP,
  HeroHeader,
  Note,
  PhotoSlot,
  ScreenHeader,
} from './index';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

const flat = (el: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('layout primitives', () => {
  it('ScreenHeader shows the title and subtitle, and the avatar opens the profile', async () => {
    const onAvatarPress = jest.fn();
    await wrap(
      <ScreenHeader
        title="Today"
        subtitle="Saturday 3 October"
        avatarLetter="A"
        onAvatarPress={onAvatarPress}
      />,
    );
    expect(screen.getByRole('header', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Saturday 3 October')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(onAvatarPress).toHaveBeenCalledTimes(1);
  });

  it('BackBar names where back goes', async () => {
    const onPress = jest.fn();
    await wrap(<BackBar label="Today" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(flat(screen.getByRole('button')).minHeight).toBe(44);
  });

  it('HeroHeader has a back button, the photo label and the content-sheet offset', async () => {
    const onBack = jest.fn();
    await wrap(<HeroHeader photoLabel="Your photo: Lily" opacity={0.55} onBack={onBack} />);
    expect(screen.getByText('Your photo: Lily')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(HERO_CONTENT_TOP).toBe(212);
  });

  it('PhotoSlot shows the placeholder without a photo and the photo with one', async () => {
    await wrap(
      <>
        <PhotoSlot label="Your photo: peace lily" height={236} />
        <PhotoSlot
          uri="https://example.com/lily.jpg"
          label="Peace lily on a windowsill"
          height={120}
        />
      </>,
    );
    expect(screen.getByText('Your photo: peace lily')).toBeTruthy();
    expect(screen.getByLabelText('Peace lily on a windowsill')).toBeTruthy();
  });

  it('Note dark tone is the inverse of the page', async () => {
    await wrap(<Note tone="dark" icon="lock" text="You're offline." />);
    expect(flat(screen.getByText("You're offline."))).toMatchObject({ color: '#FFFFFF' });
  });

  it('Button variants follow the style tile', async () => {
    await wrap(
      <>
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
        <Button label="Off" disabled onPress={() => {}} />
      </>,
    );
    expect(flat(screen.getByRole('button', { name: 'Secondary' }))).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: '#2E6B4E',
      borderWidth: 1.5,
      borderRadius: 14,
    });
    expect(flat(screen.getByRole('button', { name: 'Off' }))).toMatchObject({ opacity: 0.4 });
  });
});
