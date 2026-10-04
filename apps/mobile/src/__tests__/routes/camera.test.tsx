import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi, type FixtureScenario } from '../../api/fixture/FixtureApi';
import CameraRoute from '../../app/camera';
import ScanTabRoute from '../../app/(tabs)/scan';
import { preparePhoto } from '../../services/photos';
import {
  cameraProps,
  permission,
  requestPermission,
  resetCameraMock,
  takePictureAsync,
} from '../../testing/expoCameraMock';
import { launchImageLibraryAsync, resetImagePickerMock } from '../../testing/expoImagePickerMock';
import { ThemeProvider } from '../../theme';
import { paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());
// The photo service is tested on its own; here it hands the uri back with a marker.
jest.mock('../../services/photos', () => ({
  preparePhoto: jest.fn(async (uri: string, width: number, height: number) => ({
    uri: `prepared:${uri}`,
    base64: '',
    sha256: '',
    width,
    height,
  })),
}));

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
const scenario = (name: string) => new FixtureApi({ scenario: name as FixtureScenario });

const shutter = async () =>
  fireEvent.press(await screen.findByRole('button', { name: 'Take photo' }));

describe('Camera route', () => {
  beforeEach(() => {
    resetRouterMock();
    resetCameraMock();
    resetImagePickerMock();
    (preparePhoto as jest.Mock).mockClear();
  });

  it('shows the live camera with the quota from the API and nothing in the tray', async () => {
    await renderRoute(<CameraRoute />);
    expect(await screen.findByText('7 of 10 left this month')).toBeTruthy();
    expect(screen.getByTestId('camera-view')).toBeTruthy();
    expect(screen.getByText('0 of 5')).toBeTruthy();
  });

  it('the shutter takes a photo, prepares it and adds it to the tray', async () => {
    await renderRoute(<CameraRoute />);
    await shutter();
    expect(await screen.findByText('1 of 5')).toBeTruthy();
    expect(takePictureAsync).toHaveBeenCalledTimes(1);
    expect(preparePhoto).toHaveBeenCalledWith('file:///shutter-1.jpg', 4000, 3000);
  });

  it('identifies the photos with their organs, then opens the result', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'identify');
    await renderRoute(<CameraRoute />, api);
    await shutter();
    await screen.findByText('1 of 5');
    await fireEvent.press(screen.getByRole('radio', { name: 'Flower' }));
    await shutter();
    await screen.findByText('2 of 5');
    await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({
      photoUris: ['prepared:file:///shutter-1.jpg', 'prepared:file:///shutter-1.jpg'],
      organs: ['leaf', 'flower'],
      captureSource: 'camera',
      healthCheck: false,
    });
    const target = routerMock.replace.mock.calls[0]![0] as string;
    expect(target).toMatch(/^\/scan\/obs-/);
  });

  it('a gallery photo marks the scan as a gallery capture, within the room left in the tray', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'identify');
    await renderRoute(<CameraRoute />, api);
    await shutter();
    await screen.findByText('1 of 5');
    await fireEvent.press(screen.getByRole('button', { name: 'Gallery' }));
    expect(await screen.findByText('2 of 5')).toBeTruthy();
    expect(launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 4,
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0]![0]).toMatchObject({ captureSource: 'gallery' });
  });

  it('a removed photo leaves the tray', async () => {
    await renderRoute(<CameraRoute />);
    await shutter();
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove photo 1' }));
    expect(await screen.findByText('0 of 5')).toBeTruthy();
  });

  it('the health toggle adds a diagnosis to the identify', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'identify');
    await renderRoute(<CameraRoute />, api);
    await fireEvent.press(await screen.findByRole('switch', { name: 'Check its health' }));
    await shutter();
    await screen.findByText('1 of 5');
    await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls[0]![0]).toMatchObject({ healthCheck: true });
  });

  it('a failed identify says so and keeps the photos', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'identify').mockRejectedValue(new Error('network'));
    await renderRoute(<CameraRoute />, api);
    await shutter();
    await screen.findByText('1 of 5');
    await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
    expect(await screen.findByText("Couldn't identify that. Try again.")).toBeTruthy();
    expect(screen.getByText('1 of 5')).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('closing goes back, or to Today with nothing to go back to', async () => {
    await renderRoute(<CameraRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Close' }));
    expect(routerMock.back).toHaveBeenCalled();
    routerMock.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/today');
  });

  describe('at the identification cap (R2)', () => {
    it('opens the limit sheet and never calls identify', async () => {
      const api = scenario('limit_free');
      const spy = jest.spyOn(api, 'identify');
      await renderRoute(<CameraRoute />, api);
      expect(await screen.findByText('Limit reached')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Try Premium' })).toBeTruthy();
      await shutter();
      await screen.findByText('1 of 5');
      await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
      expect(spy).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it('Try Premium opens the paywall; Not now leaves the camera', async () => {
      await renderRoute(<CameraRoute />, scenario('limit_free'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Try Premium' }));
      expect(routerMock.push).toHaveBeenCalledWith('/paywall');
      await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
      expect(routerMock.back).toHaveBeenCalled();
    });

    it('Premium at its cap sees OK alone', async () => {
      await renderRoute(<CameraRoute />, scenario('limit_premium'));
      expect(await screen.findByRole('button', { name: 'OK' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try Premium' })).toBeNull();
    });

    it('a refusal from the server opens the sheet too', async () => {
      const api = new FixtureApi();
      jest.spyOn(api, 'identify').mockRejectedValue(new Error('quota_exceeded'));
      await renderRoute(<CameraRoute />, api);
      await shutter();
      await screen.findByText('1 of 5');
      jest.spyOn(api, 'getQuota').mockResolvedValue({
        kind: 'identification',
        used: 10,
        limit: 10,
        resetsOn: '2026-11-01',
        plan: 'free',
      });
      await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
      expect(await screen.findByText('Limit reached')).toBeTruthy();
    });
  });

  describe('camera permission', () => {
    it('asks when it has not been asked', async () => {
      permission.current = { granted: false, status: 'undetermined', canAskAgain: true };
      await renderRoute(<CameraRoute />);
      await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
    });

    it('denied shows the camera-off screen, and Open Settings opens the settings', async () => {
      permission.current = { granted: false, status: 'denied', canAskAgain: false };
      const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
      await renderRoute(<CameraRoute />);
      expect(await screen.findByText('The camera is off for Tendril.')).toBeTruthy();
      expect(screen.queryByTestId('camera-view')).toBeNull();
      expect(requestPermission).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('denied still identifies gallery photos', async () => {
      permission.current = { granted: false, status: 'denied', canAskAgain: false };
      const api = new FixtureApi();
      const spy = jest.spyOn(api, 'identify');
      await renderRoute(<CameraRoute />, api);
      await fireEvent.press(await screen.findByRole('button', { name: 'Choose from gallery' }));
      expect(await screen.findByText('Choose photos')).toBeTruthy();
      expect(launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({ selectionLimit: 5 }),
      );
      await fireEvent.press(await screen.findByRole('button', { name: 'Remove photo 1' }));
      expect(screen.getByRole('button', { name: 'Identify' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Identify' }));
      await waitFor(() => expect(spy).toHaveBeenCalled());
      expect(spy.mock.calls[0]![0]).toMatchObject({
        captureSource: 'gallery',
        photoUris: ['prepared:file:///library-1.jpg'],
      });
    });
  });

  describe('label scanning (R16)', () => {
    beforeEach(() => {
      paramsMock.current = { mode: 'label' };
    });
    afterEach(() => {
      delete process.env.EXPO_PUBLIC_WEB_HOST;
    });
    const scan = async (data: string) => {
      await screen.findByText('Point the camera at the QR code on your Tendril plant label.');
      await act(async () => cameraProps.current.onBarcodeScanned({ type: 'qr', data }));
    };

    it('scans QR codes with the hint, and has no photo controls', async () => {
      await renderRoute(<CameraRoute />);
      await screen.findByText('Point the camera at the QR code on your Tendril plant label.');
      expect(cameraProps.current.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
      expect(screen.queryByRole('button', { name: 'Take photo' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Identify' })).toBeNull();
    });

    it('a Tendril label opens its adoption screen', async () => {
      await renderRoute(<CameraRoute />);
      await scan('https://tendril.app/l/abcd-1234');
      await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/l/ABCD-1234'));
    });

    it('a deep link and a bare code work too', async () => {
      await renderRoute(<CameraRoute />);
      await scan('tendril://l/wxyz-9999');
      await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/l/WXYZ-9999'));
    });

    it('opens the label once even if the scanner reports it again', async () => {
      await renderRoute(<CameraRoute />);
      await scan('https://tendril.app/l/abcd-1234');
      await act(async () =>
        cameraProps.current.onBarcodeScanned({
          type: 'qr',
          data: 'https://tendril.app/l/abcd-1234',
        }),
      );
      await waitFor(() => expect(routerMock.replace).toHaveBeenCalled());
      expect(routerMock.replace).toHaveBeenCalledTimes(1);
    });

    it('another QR code says it is not a Tendril label, and does not navigate', async () => {
      await renderRoute(<CameraRoute />);
      await scan('https://example.com/l/ABCD-1234');
      expect(await screen.findByText("That's not a Tendril label.")).toBeTruthy();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it('takes the web host from EXPO_PUBLIC_WEB_HOST', async () => {
      process.env.EXPO_PUBLIC_WEB_HOST = 'staging.tendril.test';
      await renderRoute(<CameraRoute />);
      await scan('https://tendril.app/l/ABCD-1234');
      expect(await screen.findByText("That's not a Tendril label.")).toBeTruthy();
      await act(async () =>
        cameraProps.current.onBarcodeScanned({
          type: 'qr',
          data: 'https://staging.tendril.test/l/ABCD-1234',
        }),
      );
      await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/l/ABCD-1234'));
    });

    it('denied says so in label terms, with no gallery', async () => {
      permission.current = { granted: false, status: 'denied', canAskAgain: false };
      await renderRoute(<CameraRoute />);
      expect(await screen.findByText('Turn it on in Settings to scan plant labels.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Choose from gallery' })).toBeNull();
    });

    it('does not need the identification quota: at the cap the label scanner still works', async () => {
      await renderRoute(<CameraRoute />, scenario('limit_free'));
      await screen.findByText('Point the camera at the QR code on your Tendril plant label.');
      expect(screen.queryByText('Limit reached')).toBeNull();
    });
  });
});

describe('Scan tab route (4af, 4ag)', () => {
  beforeEach(() => resetRouterMock());

  it('at the cap shows the Scan header with the free Limit reached sheet', async () => {
    await renderRoute(<ScanTabRoute />, scenario('limit_free'));
    expect(await screen.findByText('Limit reached')).toBeTruthy();
    expect(screen.getByText('Scan')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try Premium' }));
    expect(routerMock.push).toHaveBeenCalledWith('/paywall');
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/today');
  });

  it('Premium at its cap shows the premium copy and OK alone', async () => {
    await renderRoute(<ScanTabRoute />, scenario('limit_premium'));
    expect(
      await screen.findByText(
        "You've used your 60 identifications this month. More arrive on 1 November.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try Premium' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/today');
  });

  it('under the cap sends the person on to the camera', async () => {
    await renderRoute(<ScanTabRoute />);
    expect(await screen.findByText('redirect:/camera')).toBeTruthy();
  });
});
