import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import Index from '../../app/index';
import { useSession } from '../../session/SessionProvider';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));
jest.mock('../../session/SessionProvider', () => ({ useSession: jest.fn() }));

const mockRedirect = Redirect as unknown as jest.Mock;
const mockUseSession = useSession as jest.Mock;
const redirectedTo = () => mockRedirect.mock.calls.at(-1)?.[0].href;

describe('Index', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a ready session to Today', async () => {
    mockUseSession.mockReturnValue({ status: 'ready', ageBlocked: false });
    await render(<Index />);
    expect(redirectedTo()).toBe('/today');
  });

  it.each(['signed_out', 'onboarding'])(
    'sends a %s session to the welcome screen',
    async (status) => {
      mockUseSession.mockReturnValue({ status, ageBlocked: false });
      await render(<Index />);
      expect(redirectedTo()).toBe('/welcome');
    },
  );

  it('sends an age-blocked session to the stop, never the welcome screen', async () => {
    mockUseSession.mockReturnValue({ status: 'signed_out', ageBlocked: true });
    await render(<Index />);
    expect(redirectedTo()).toBe('/age-stop');
  });
});
