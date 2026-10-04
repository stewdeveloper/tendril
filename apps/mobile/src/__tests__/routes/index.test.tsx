import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import Index from '../../app/index';
import { useSession } from '../../session/SessionProvider';

jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));
jest.mock('../../session/SessionProvider', () => ({ useSession: jest.fn() }));

const mockRedirect = Redirect as unknown as jest.Mock;
const mockUseSession = useSession as jest.Mock;
const destination = jest.fn();
const clearDestination = jest.fn();
const redirectedTo = () => mockRedirect.mock.calls.at(-1)?.[0].href;

describe('Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    destination.mockReturnValue('/today');
  });

  it('sends a ready session to Today', async () => {
    mockUseSession.mockReturnValue({
      status: 'ready',
      ageBlocked: false,
      destination,
      clearDestination,
    });
    await render(<Index />);
    expect(redirectedTo()).toBe('/today');
  });

  it.each(['signed_out', 'onboarding'])(
    'sends a %s session to the welcome screen',
    async (status) => {
      mockUseSession.mockReturnValue({ status, ageBlocked: false, destination, clearDestination });
      await render(<Index />);
      expect(redirectedTo()).toBe('/welcome');
    },
  );

  it('sends an age-blocked session to the stop, never the welcome screen', async () => {
    mockUseSession.mockReturnValue({
      status: 'signed_out',
      ageBlocked: true,
      destination,
      clearDestination,
    });
    await render(<Index />);
    expect(redirectedTo()).toBe('/age-stop');
  });

  it('sends a ready session to where onboarding asked, then clears it', async () => {
    destination.mockReturnValue('/camera');
    mockUseSession.mockReturnValue({
      status: 'ready',
      ageBlocked: false,
      destination,
      clearDestination,
    });
    await render(<Index />);
    expect(redirectedTo()).toBe('/camera');
    expect(clearDestination).toHaveBeenCalled();
  });

  it('sends a ready session to the label scanner, query and all', async () => {
    destination.mockReturnValue('/camera?mode=label');
    mockUseSession.mockReturnValue({
      status: 'ready',
      ageBlocked: false,
      destination,
      clearDestination,
    });
    await render(<Index />);
    expect(redirectedTo()).toBe('/camera?mode=label');
    expect(clearDestination).toHaveBeenCalled();
  });

  it('keeps the destination until the session is ready', async () => {
    destination.mockReturnValue('/camera');
    mockUseSession.mockReturnValue({
      status: 'onboarding',
      ageBlocked: false,
      destination,
      clearDestination,
    });
    await render(<Index />);
    expect(redirectedTo()).toBe('/welcome');
    expect(clearDestination).not.toHaveBeenCalled();
  });
});
