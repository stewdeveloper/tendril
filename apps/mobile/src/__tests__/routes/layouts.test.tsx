import { render, screen } from '@testing-library/react-native';
import OnboardingLayout from '../../app/(onboarding)/_layout';
import TabsLayout from '../../app/(tabs)/_layout';
import PlantsLayout from '../../app/(tabs)/plants/_layout';
import { useSession } from '../../session/SessionProvider';
import { ThemeProvider } from '../../theme';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());
jest.mock('expo-router/js-tabs', () => jest.requireActual('./mockRouter').mockJsTabs());
jest.mock('../../session/SessionProvider', () => ({ useSession: jest.fn() }));

const mockUseSession = useSession as jest.Mock;
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const texts = () => screen.queryAllByText(/:/).map((n) => String(n.props.children));

describe('OnboardingLayout', () => {
  it('walks the whole flow until someone says they are under 13', async () => {
    mockUseSession.mockReturnValue({ ageBlocked: false });
    await wrap(<OnboardingLayout />);
    expect(texts()).toEqual([
      'screen:welcome',
      'screen:age',
      'screen:sign-in',
      'screen:link-sent',
      'screen:link-expired',
      'screen:pets',
      'screen:home-area',
      'screen:first-scan',
      'screen:age-stop',
    ]);
  });

  it('leaves only the stop once age-blocked, so there is no way back', async () => {
    mockUseSession.mockReturnValue({ ageBlocked: true });
    await wrap(<OnboardingLayout />);
    expect(texts()).toEqual(['screen:age-stop']);
  });
});

describe('TabsLayout', () => {
  it('lists the five tabs in order, My Plants as a nested stack', async () => {
    await wrap(<TabsLayout />);
    expect(texts()).toEqual([
      'tab:today/index',
      'tab:plants',
      'tab:scan',
      'tab:collection/index',
      'tab:leagues/index',
    ]);
  });
});

describe('PlantsLayout', () => {
  it('stacks a plant page on the list, inside the My Plants tab', async () => {
    await wrap(<PlantsLayout />);
    expect(texts()).toEqual(['screen:index', 'screen:[id]/index']);
  });
});
