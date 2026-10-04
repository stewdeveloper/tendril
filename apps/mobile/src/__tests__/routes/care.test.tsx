import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi, type FixtureApiOptions } from '../../api/fixture/FixtureApi';
import DiagnosisRoute from '../../app/plants/[id]/diagnosis';
import PetEmergencyRoute from '../../app/pet-emergency';
import { resetImagePickerMock } from '../../testing/expoImagePickerMock';
import { ThemeProvider } from '../../theme';
import { paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());

const renderRoute = (node: React.ReactElement, api = new FixtureApi()) =>
  render(
    <ThemeProvider scheme="light">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <ApiProvider api={api}>{node}</ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
const apiWith = (options: FixtureApiOptions) => new FixtureApi(options);

beforeEach(() => {
  resetRouterMock();
  resetImagePickerMock();
  jest.restoreAllMocks();
});

describe('Diagnosis route', () => {
  beforeEach(() => {
    paramsMock.current = { id: 'monty' };
  });

  it('starts with photos, and checks only once there is one', async () => {
    await renderRoute(<DiagnosisRoute />);
    expect(await screen.findByText('Take photos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check its health' })).toBeDisabled();
  });

  it('takes a photo with the camera, then diagnoses and shows the result', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'diagnose');
    await renderRoute(<DiagnosisRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    expect(await screen.findByText('1 of 3 photos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Check its health' }));
    expect(await screen.findByText('Overwatering')).toBeTruthy();
    expect(spy).toHaveBeenCalledWith({ plantId: 'monty', photoUris: ['file:///camera-1.jpg'] });
    expect(screen.getByText('Likely, 72%')).toBeTruthy();
  });

  it('picks from the library up to three, no more', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg' },
        { uri: 'file:///b.jpg' },
        { uri: 'file:///c.jpg' },
        { uri: 'file:///d.jpg' },
      ],
    });
    await renderRoute(<DiagnosisRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose from library' }));
    expect(await screen.findByText('3 of 3 photos')).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 3, allowsMultipleSelection: true }),
    );
  });

  it('says so when camera access is refused', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await renderRoute(<DiagnosisRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    expect(
      await screen.findByText('Allow photo access in your phone settings to add photos.'),
    ).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('a backed-out camera adds nothing', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: null,
    });
    await renderRoute(<DiagnosisRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    await waitFor(() => expect(ImagePicker.launchCameraAsync).toHaveBeenCalled());
    expect(screen.getByText('0 of 3 photos')).toBeTruthy();
  });

  it('apply to care plan calls the hook, then goes back to the plant', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'applyDiagnosis');
    await renderRoute(<DiagnosisRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Check its health' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Apply to care plan' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const [diagnosisId] = spy.mock.calls[0]!;
    expect(diagnosisId).toMatch(/^diag-/);
    await waitFor(() => expect(routerMock.back).toHaveBeenCalled());
  });

  it('a plan that cannot be changed says so and stays', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'applyDiagnosis').mockRejectedValue(new Error('network'));
    await renderRoute(<DiagnosisRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Check its health' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Apply to care plan' }));
    expect(await screen.findByText("Couldn't change your plan. Try again.")).toBeTruthy();
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('a failed check says so and keeps the photos', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'diagnose').mockRejectedValue(new Error('network'));
    await renderRoute(<DiagnosisRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Check its health' }));
    expect(await screen.findByText("Couldn't check your plant. Try again.")).toBeTruthy();
    expect(screen.getByText('1 of 3 photos')).toBeTruthy();
  });

  it('not sure uses no diagnosis, and "Take a close photo" starts over', async () => {
    await renderRoute(<DiagnosisRoute />, apiWith({ scenario: 'not_sure' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Check its health' }));
    expect(await screen.findByText('Not sure yet')).toBeTruthy();
    expect(screen.getByText("This didn't use your diagnosis.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a close photo' }));
    expect(await screen.findByText('Take photos')).toBeTruthy();
    expect(screen.getByText('0 of 3 photos')).toBeTruthy();
  });

  it('at the cap it shows the used-up screen before any photo is taken', async () => {
    const api = apiWith({ scenario: 'limit_free' });
    const spy = jest.spyOn(api, 'diagnose');
    await renderRoute(<DiagnosisRoute />, api);
    expect(await screen.findByText("You've used this month's diagnosis")).toBeTruthy();
    expect(
      screen.getByText('More arrive on 1 November, or get 10 a month with Premium.'),
    ).toBeTruthy();
    expect(screen.queryByText('Take photos')).toBeNull();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Premium free for 7 days' }));
    expect(routerMock.push).toHaveBeenCalledWith('/paywall');
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(routerMock.back).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('used up on Premium offers no Premium', async () => {
    await renderRoute(<DiagnosisRoute />, apiWith({ scenario: 'limit_premium' }));
    expect(await screen.findByText("You've used your 10 diagnoses this month")).toBeTruthy();
    expect(screen.queryByText('Try Premium free for 7 days')).toBeNull();
  });
});

describe('Pet emergency route', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  it('asks for the pet and the plant it was given, and goes back by the plant name', async () => {
    paramsMock.current = { petId: 'pet-miso', plantId: 'lily' };
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'getEmergency');
    await renderRoute(<PetEmergencyRoute />, api);
    expect(await screen.findByText('If Miso ate peace lily')).toBeTruthy();
    expect(spy).toHaveBeenCalledWith({ petId: 'pet-miso', plantId: 'lily' });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Lily' }));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('asks for the species when it came from a label, and goes back by the species name', async () => {
    paramsMock.current = { petId: 'pet-miso', speciesId: 'peace-lily' };
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'getEmergency');
    await renderRoute(<PetEmergencyRoute />, api);
    expect(await screen.findByText('If Miso ate peace lily')).toBeTruthy();
    expect(spy).toHaveBeenCalledWith({ petId: 'pet-miso', speciesId: 'peace-lily' });
    expect(screen.getByRole('button', { name: 'Back to Peace lily' })).toBeTruthy();
  });

  it('Ireland has no poison line; no vet saved says what to do, and the buttons act', async () => {
    paramsMock.current = { petId: 'pet-miso', plantId: 'lily' };
    await renderRoute(<PetEmergencyRoute />);
    expect(
      await screen.findByText("You haven't saved a vet yet. Call your nearest vet now."),
    ).toBeTruthy();
    expect(screen.queryByText(/ASPCA Poison Control/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Find a vet nearby' }));
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=vet',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save your vet' }));
    expect(routerMock.push).toHaveBeenCalledWith('/settings/household');
  });

  it('the us scenario shows the ASPCA line, and calling it dials the number', async () => {
    paramsMock.current = { petId: 'pet-miso', plantId: 'lily' };
    await renderRoute(<PetEmergencyRoute />, apiWith({ scenario: 'us' }));
    const button = await screen.findByRole('button', {
      name: 'Call ASPCA Poison Control (888)\u00A0426\u20114435',
    });
    expect(screen.getByText('Open 24 hours. A fee may apply.')).toBeTruthy();
    await fireEvent.press(button);
    expect(Linking.openURL).toHaveBeenCalledWith('tel:8884264435');
  });

  it('a missing pet id shows the safe actions and asks for nothing', async () => {
    paramsMock.current = {};
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'getEmergency');
    await renderRoute(<PetEmergencyRoute />, api);
    expect(screen.getByText('Call your nearest vet now.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Find a vet nearby' }));
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=vet',
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('a lookup that fails still shows the safe actions', async () => {
    paramsMock.current = { petId: 'nope', plantId: 'lily' };
    await renderRoute(<PetEmergencyRoute />);
    expect(await screen.findByText('Call your nearest vet now.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find a vet nearby' })).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('while it loads the actions are already there, with a spinner', async () => {
    paramsMock.current = { petId: 'pet-miso', plantId: 'lily' };
    await renderRoute(<PetEmergencyRoute />, new FixtureApi({ latencyMs: 50 }));
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find a vet nearby' })).toBeTruthy();
    expect(await screen.findByText('If Miso ate peace lily')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('with a vet saved the vet is called first', async () => {
    paramsMock.current = { petId: 'pet-miso', plantId: 'lily' };
    const api = apiWith({ scenario: 'us' });
    // The fixture has no way to save a vet yet (the household screen adds it), so serve one.
    const real = api.getEmergency.bind(api);
    jest.spyOn(api, 'getEmergency').mockImplementation(async (input) => ({
      ...(await real(input)),
      vet: { name: 'Riverside Vets', phone: '+353 1 555 0100' },
    }));
    await renderRoute(<PetEmergencyRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Call your vet' }));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+35315550100');
    expect(screen.getAllByText(/^Call /).map((n) => n.props.children)[0]).toBe('Call your vet');
  });
});
