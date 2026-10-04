import { copy, isAtLeast13, onboardingCopy } from '@tendril/core';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { AgeScreen } from './AgeScreen';
import { AgeStopScreen } from './AgeStopScreen';
import { FirstScanScreen } from './FirstScanScreen';
import { HomeAreaScreen } from './HomeAreaScreen';
import { LinkExpiredScreen } from './LinkExpiredScreen';
import { LinkSentScreen } from './LinkSentScreen';
import { PetsScreen } from './PetsScreen';
import { SignInScreen } from './SignInScreen';
import { WelcomeScreen } from './WelcomeScreen';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('onboarding', () => {
  it('welcome offers Get started and scanning a label', async () => {
    const onGetStarted = jest.fn();
    const onScanLabel = jest.fn();
    await wrap(<WelcomeScreen onGetStarted={onGetStarted} onScanLabel={onScanLabel} />);
    expect(screen.getByText('Tendril')).toBeTruthy();
    expect(screen.getByText(onboardingCopy.welcomeLine)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Scan your plant label' }));
    expect(onGetStarted).toHaveBeenCalled();
    expect(onScanLabel).toHaveBeenCalled();
  });

  it('age screen shows exactly its two lines, never the limit, and submits month and year', async () => {
    const onContinue = jest.fn();
    await wrap(
      <AgeScreen initial={{ year: 1998, month: 9 }} onContinue={onContinue} onBack={() => {}} />,
    );
    expect(screen.getByText('When were you born?')).toBeTruthy();
    expect(screen.getByText('Month and year are enough.')).toBeTruthy();
    // The only words about age are those two lines: nothing mentions a limit or a reason.
    expect(
      screen.queryByText(/old enough|too young|under 1|age limit|at least|minimum age/i),
    ).toBeNull();
    expect(screen.getByRole('adjustable', { name: 'Month' })).toHaveAccessibilityValue({
      text: 'September',
    });
    expect(screen.getByRole('adjustable', { name: 'Year' })).toHaveAccessibilityValue({
      text: '1998',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith({ year: 1998, month: 9 });
  });

  it('age wheel changes by accessibility actions, and stays inside its range', async () => {
    const onContinue = jest.fn();
    await wrap(
      <AgeScreen
        initial={{ year: 2026, month: 12 }}
        maxYear={2026}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    // December is the last month: up stays on it, then two steps down is October.
    const month = screen.getByRole('adjustable', { name: 'Month' });
    await fireEvent(month, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(month, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(month, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    const year = screen.getByRole('adjustable', { name: 'Year' });
    await fireEvent(year, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith({ year: 2025, month: 10 });
  });

  it('age wheel: scrolling with no end events still changes the submitted value, so Continue never submits a stale one', async () => {
    const onContinue = jest.fn();
    await wrap(
      <AgeScreen
        initial={{ year: 1998, month: 9 }}
        maxYear={2026}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    // 2015 is row 95 from 1920. Only scroll events fire, as with a mouse wheel on web.
    await fireEvent.scroll(screen.getByTestId('year-wheel'), {
      nativeEvent: { contentOffset: { x: 0, y: 95 * 44 } },
    });
    expect(screen.getByRole('adjustable', { name: 'Year' })).toHaveAccessibilityValue({
      text: '2015',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith({ year: 2015, month: 9 });
    // 13 years before October 2026 is 2013 or later: this person is under the limit.
    expect(isAtLeast13(onContinue.mock.calls[0][0], { year: 2026, month: 10 })).toBe(false);
  });

  it('age stop has no way back', async () => {
    await wrap(<AgeStopScreen />);
    expect(screen.getByText('Thanks for telling us')).toBeTruthy();
    expect(screen.getByText(onboardingCopy.ageStopLine)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('sign in offers Apple, Google and an email link', async () => {
    const onApple = jest.fn();
    const onGoogle = jest.fn();
    const onEmail = jest.fn();
    await wrap(
      <SignInScreen
        showApple
        onApple={onApple}
        onGoogle={onGoogle}
        onEmail={onEmail}
        onBack={() => {}}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(onApple).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(onGoogle).toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByPlaceholderText('you@example.com'),
      ' aoife@example.com ',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(onEmail).toHaveBeenCalledWith('aoife@example.com');
  });

  it('sign in hides Apple off iOS, and asks for a real address before sending a link', async () => {
    const onEmail = jest.fn();
    await wrap(
      <SignInScreen
        showApple={false}
        onApple={() => {}}
        onGoogle={() => {}}
        onEmail={onEmail}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'not-an-address');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(onEmail).not.toHaveBeenCalled();
  });

  it('link sent names the address and offers Open Mail and Send it again', async () => {
    const onOpenMail = jest.fn();
    const onResend = jest.fn();
    await wrap(
      <LinkSentScreen
        email="aoife@example.com"
        onOpenMail={onOpenMail}
        onResend={onResend}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(screen.getByText('aoife@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Mail' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send it again' }));
    expect(onOpenMail).toHaveBeenCalled();
    expect(onResend).toHaveBeenCalled();
  });

  it('link expired explains the 15 minutes and offers a fresh link or another address', async () => {
    const onSendNew = jest.fn();
    const onUseDifferent = jest.fn();
    await wrap(
      <LinkExpiredScreen
        email="aoife@example.com"
        onSendNew={onSendNew}
        onUseDifferent={onUseDifferent}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('This link has expired')).toBeTruthy();
    expect(
      screen.getByText(
        'Sign-in links work once, for 15 minutes. We can send a fresh one to aoife@example.com.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send a new link' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(onSendNew).toHaveBeenCalled();
    expect(onUseDifferent).toHaveBeenCalled();
  });

  it('pets: picking None clears others and shows the note', async () => {
    const onContinue = jest.fn();
    await wrap(
      <PetsScreen
        initial={[{ animal: 'cat', name: 'Miso' }]}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'None' }));
    expect(screen.getByText(onboardingCopy.petsNone)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Cat' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith([]);
  });

  it('pets: names are optional and empty names save as null', async () => {
    const onContinue = jest.fn();
    await wrap(
      <PetsScreen
        initial={[{ animal: 'dog', name: '' }]}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith([{ animal: 'dog', name: null }]);
  });

  it('pets: cat and dog get name fields, and another dog can be added', async () => {
    const onContinue = jest.fn();
    await wrap(<PetsScreen onContinue={onContinue} onBack={() => {}} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Dog' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cat' }));
    expect(screen.getByText('Names (optional)')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Cat name'), ' Miso ');
    await fireEvent.changeText(screen.getByLabelText('Dog name'), 'Bran');
    await fireEvent.press(screen.getByRole('button', { name: 'Add another dog' }));
    await fireEvent.changeText(screen.getByLabelText('Dog 2 name'), 'Fern');
    expect(screen.getByLabelText('Dog 1 name')).toBeTruthy();
    expect(screen.getByLabelText('Dog 2 name')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    // Cats come before dogs whatever order they were picked in; a blank name is saved as null.
    expect(onContinue).toHaveBeenCalledWith([
      { animal: 'cat', name: 'Miso' },
      { animal: 'dog', name: 'Bran' },
      { animal: 'dog', name: 'Fern' },
    ]);
  });

  it('pets: a mis-tapped Add another with a blank name does not save a phantom pet', async () => {
    const onContinue = jest.fn();
    await wrap(
      <PetsScreen
        initial={[
          { animal: 'cat', name: '' },
          { animal: 'dog', name: 'Bran' },
        ]}
        onContinue={onContinue}
        onBack={() => {}}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add another dog' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add another dog' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    // The blank cat is the first row of its animal, so it stays; the blank extra dogs go.
    expect(onContinue).toHaveBeenCalledWith([
      { animal: 'cat', name: null },
      { animal: 'dog', name: 'Bran' },
    ]);
  });

  it('pets: unticking an animal removes its names', async () => {
    await wrap(
      <PetsScreen
        initial={[
          { animal: 'cat', name: 'Miso' },
          { animal: 'dog', name: 'Bran' },
        ]}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cat' }));
    expect(screen.queryByLabelText('Cat name')).toBeNull();
    expect(screen.getByLabelText('Dog name')).toBeTruthy();
  });

  const homeArea = (over: Partial<React.ComponentProps<typeof HomeAreaScreen>> = {}) => (
    <HomeAreaScreen
      query=""
      onQueryChange={() => {}}
      onSearch={() => {}}
      notFound={false}
      radiusM={2000}
      onRadiusChange={() => {}}
      onSave={() => {}}
      onSkip={() => {}}
      onBack={() => {}}
      {...over}
    />
  );

  it('home area: the map is laid out in flow, with no absolute offsets, so nothing overlaps', async () => {
    await wrap(homeArea({ notFound: true }));
    const map = StyleSheet.flatten(screen.getByTestId('home-area-map').props.style) ?? {};
    expect(map.position).not.toBe('absolute');
    expect(map.top).toBeUndefined();
  });

  it('home area: skip and save, with the privacy line and no location prompt', async () => {
    const onSkip = jest.fn();
    const onSave = jest.fn();
    await wrap(homeArea({ onSkip, onSave }));
    expect(screen.getByText("Where's home?")).toBeTruthy();
    expect(screen.getByText(copy.homeArea)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save area' }));
    expect(onSkip).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });

  it('home area: a failed search shows the card and cannot be saved', async () => {
    const onSave = jest.fn();
    await wrap(homeArea({ query: 'Ballynahinchh', notFound: true, onSave }));
    expect(screen.getByText("We couldn't find that town")).toBeTruthy();
    expect(
      screen.getByText('Check the spelling, or move the area on the map instead.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save area' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('home area: searching and clearing the field', async () => {
    const onSearch = jest.fn();
    const onQueryChange = jest.fn();
    await wrap(homeArea({ query: 'Cork', onSearch, onQueryChange }));
    await fireEvent(screen.getByDisplayValue('Cork'), 'submitEditing');
    expect(onSearch).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('home area: the handle resizes the area in quarter-kilometre steps, within limits', async () => {
    const onRadiusChange = jest.fn();
    await wrap(homeArea({ radiusM: 2000, onRadiusChange }));
    const handle = screen.getByRole('adjustable', { name: 'Home area size' });
    expect(handle).toHaveAccessibilityValue({ text: '2 km' });
    await fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onRadiusChange).toHaveBeenLastCalledWith(2250);
    await fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onRadiusChange).toHaveBeenLastCalledWith(1750);
  });

  it('first scan: the skipped note shows only when the area was skipped', async () => {
    const onAllowCamera = jest.fn();
    const onNotNow = jest.fn();
    const view = await wrap(
      <FirstScanScreen
        homeAreaSkipped
        onAllowCamera={onAllowCamera}
        onNotNow={onNotNow}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('Your first scan')).toBeTruthy();
    expect(screen.getByText(onboardingCopy.homeAreaSkipped)).toBeTruthy();
    for (const line of onboardingCopy.firstScanLines) expect(screen.getByText(line)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onAllowCamera).toHaveBeenCalled();
    expect(onNotNow).toHaveBeenCalled();
    await act(async () => {
      view.unmount();
    });
    await wrap(
      <FirstScanScreen
        homeAreaSkipped={false}
        onAllowCamera={() => {}}
        onNotNow={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByText(onboardingCopy.homeAreaSkipped)).toBeNull();
  });
});
