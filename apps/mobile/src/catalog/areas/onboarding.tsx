import { DEFAULT_RADIUS_M } from '../../components/HomeAreaParts';
import { registerFrame } from '../registry';
import { AgeScreen } from '../../screens/onboarding/AgeScreen';
import { AgeStopScreen } from '../../screens/onboarding/AgeStopScreen';
import { FirstScanScreen } from '../../screens/onboarding/FirstScanScreen';
import { HomeAreaScreen } from '../../screens/onboarding/HomeAreaScreen';
import { LinkExpiredScreen } from '../../screens/onboarding/LinkExpiredScreen';
import { LinkSentScreen } from '../../screens/onboarding/LinkSentScreen';
import { PetsScreen } from '../../screens/onboarding/PetsScreen';
import { SignInScreen } from '../../screens/onboarding/SignInScreen';
import { WelcomeScreen } from '../../screens/onboarding/WelcomeScreen';

/** Frames 3a to 3k: onboarding, from the welcome photo to the camera primer. */

const noop = () => {};
const EMAIL = 'aoife@example.com';

registerFrame({
  id: '3a',
  title: 'Welcome',
  scheme: 'dark',
  statusBar: 'light',
  render: () => <WelcomeScreen onGetStarted={noop} onScanLabel={noop} />,
});

registerFrame({
  id: '3b',
  title: 'Age · month and year, no mention of a limit',
  render: () => (
    <AgeScreen initial={{ year: 1998, month: 9 }} maxYear={2026} onContinue={noop} onBack={noop} />
  ),
});

registerFrame({
  id: '3c',
  title: 'Age stop',
  render: () => <AgeStopScreen />,
});

registerFrame({
  id: '3d',
  title: 'Sign in · Apple, Google, email link',
  render: () => (
    <SignInScreen
      showApple
      onApple={noop}
      onGoogle={noop}
      onEmail={noop}
      onBack={noop}
      onTerms={noop}
      onPrivacy={noop}
    />
  ),
});

registerFrame({
  id: '3e',
  title: 'Check your email',
  render: () => <LinkSentScreen email={EMAIL} onOpenMail={noop} onResend={noop} onBack={noop} />,
});

registerFrame({
  id: '3f',
  title: 'Link expired',
  render: () => (
    <LinkExpiredScreen email={EMAIL} onSendNew={noop} onUseDifferent={noop} onBack={noop} />
  ),
});

registerFrame({
  id: '3g',
  title: 'Pets · cat and dog picked',
  render: () => (
    <PetsScreen
      initial={[
        { animal: 'cat', name: 'Miso' },
        { animal: 'dog', name: 'Bran' },
      ]}
      focusedRow={1}
      onContinue={noop}
      onBack={noop}
    />
  ),
});

registerFrame({
  id: '3h',
  title: 'Pets · none',
  render: () => <PetsScreen initialNone onContinue={noop} onBack={noop} />,
});

const homeArea = (query: string, notFound: boolean) => (
  <HomeAreaScreen
    query={query}
    onQueryChange={noop}
    onSearch={noop}
    notFound={notFound}
    radiusM={DEFAULT_RADIUS_M}
    onRadiusChange={noop}
    onSave={noop}
    onSkip={noop}
    onBack={noop}
    searchFocused={notFound}
  />
);

registerFrame({ id: '3i', title: 'Home area', render: () => homeArea('', false) });
registerFrame({
  id: '3j',
  title: 'Home area · town not found',
  render: () => homeArea('Ballynahinchh', true),
});

registerFrame({
  id: '3k',
  title: 'First scan · camera primer',
  render: () => (
    <FirstScanScreen homeAreaSkipped onAllowCamera={noop} onNotNow={noop} onBack={noop} />
  ),
});
