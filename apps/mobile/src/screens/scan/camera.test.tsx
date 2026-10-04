import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme';
import { CameraDeniedScreen } from './CameraDeniedScreen';
import { CameraScreen, type CameraScreenProps } from './CameraScreen';
import { GalleryScreen } from './GalleryScreen';
import { LabelScanScreen } from './LabelScanScreen';
import { LimitSheet } from './LimitSheet';
import { ScanTabScreen } from './ScanTabScreen';

const noop = () => {};
// The camera draws itself dark, so rendering it under the light scheme proves it does not follow.
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const dq = {
  kind: 'diagnosis' as const,
  used: 0,
  limit: 1,
  resetsOn: '2026-11-01',
  plan: 'free' as const,
};
const camera = (over: Partial<CameraScreenProps> = {}) => (
  <CameraScreen
    preview={<Text>preview</Text>}
    quota={aoife.today.identifications}
    organ="leaf"
    photos={[]}
    healthCheck={false}
    diagnosisQuota={dq}
    onOrgan={noop}
    onShutter={noop}
    onRemovePhoto={noop}
    onGallery={noop}
    onToggleHealth={noop}
    onIdentify={noop}
    onClose={noop}
    {...over}
  />
);

describe('CameraScreen', () => {
  it('shows quota, organ chips, tray count and gallery note; Identify disabled with no photos', async () => {
    await wrap(camera());
    expect(screen.getByText('7 of 10 left this month')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Leaf' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Flower' })).not.toBeChecked();
    expect(screen.getByText('0 of 5')).toBeTruthy();
    expect(screen.getByText("Gallery photos get identified but don't earn points.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Identify' })).toBeDisabled();
  });

  it('caps the tray at 5 photos', async () => {
    const onShutter = jest.fn();
    await wrap(camera({ photos: ['1', '2', '3', '4', '5'], onShutter }));
    expect(screen.getByText('5 of 5')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(onShutter).not.toHaveBeenCalled();
  });

  it('takes a photo, picks an organ, opens the gallery and closes', async () => {
    const onShutter = jest.fn();
    const onOrgan = jest.fn();
    const onGallery = jest.fn();
    const onClose = jest.fn();
    await wrap(camera({ onShutter, onOrgan, onGallery, onClose }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Whole plant' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gallery' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onShutter).toHaveBeenCalledTimes(1);
    expect(onOrgan).toHaveBeenCalledWith('whole');
    expect(onGallery).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('identifies once there is a photo, and each tray photo can be removed', async () => {
    const onIdentify = jest.fn();
    const onRemovePhoto = jest.fn();
    await wrap(camera({ photos: ['a', 'b'], onIdentify, onRemovePhoto }));
    expect(screen.getByText('2 of 5')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
    expect(onIdentify).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo 2' }));
    expect(onRemovePhoto).toHaveBeenCalledWith(1);
  });

  it('the health toggle says what it uses, and turns on', async () => {
    const onToggleHealth = jest.fn();
    await wrap(camera({ onToggleHealth }));
    expect(screen.getByText('Uses your 1 diagnosis this month')).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'Check its health' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(onToggleHealth).toHaveBeenCalledWith(true);
  });

  it('with the diagnosis used up the toggle is off and disabled, and says so', async () => {
    const onToggleHealth = jest.fn();
    await wrap(camera({ diagnosisQuota: { ...dq, used: 1 }, onToggleHealth }));
    expect(screen.getByText('Diagnosis used this month')).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'Check its health' });
    expect(toggle).toBeDisabled();
    await fireEvent.press(toggle);
    expect(onToggleHealth).not.toHaveBeenCalled();
  });

  it('shows an identify error and the busy state', async () => {
    await wrap(camera({ photos: ['a'], error: "Couldn't identify that. Try again.", busy: true }));
    expect(screen.getByText("Couldn't identify that. Try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Identify, loading' })).toBeDisabled();
  });
});

describe('LimitSheet', () => {
  const free = {
    kind: 'identification' as const,
    used: 10,
    limit: 10,
    resetsOn: '2026-11-01',
    plan: 'free' as const,
  };

  it('free users see the preview offer; premium at the cap sees only the reset date', async () => {
    const a = await wrap(<LimitSheet visible quota={free} onTryPremium={noop} onClose={noop} />);
    expect(screen.getByText('Limit reached')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try Premium' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    await a.unmount();
    await wrap(
      <LimitSheet
        visible
        quota={{ ...free, used: 60, limit: 60, plan: 'premium' }}
        onTryPremium={noop}
        onClose={noop}
      />,
    );
    expect(
      screen.getByText(
        "You've used your 60 identifications this month. More arrive on 1 November.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try Premium' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('draws the free copy from 4af, inline when the catalog asks for an overlay', async () => {
    await wrap(
      <LimitSheet presentation="overlay" visible quota={free} onTryPremium={noop} onClose={noop} />,
    );
    expect(screen.getByTestId('sheet-overlay')).toBeTruthy();
    expect(
      screen.getByText(
        "You've used your 10 free identifications this month. More arrive on 1 November, or get 60 a month with Premium.",
      ),
    ).toBeTruthy();
  });

  it('Try Premium, Not now and OK each call back', async () => {
    const onTryPremium = jest.fn();
    const onClose = jest.fn();
    const a = await wrap(
      <LimitSheet visible quota={free} onTryPremium={onTryPremium} onClose={onClose} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Try Premium' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onTryPremium).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    await a.unmount();
    await wrap(
      <LimitSheet
        visible
        quota={{ ...free, plan: 'premium', limit: 60, used: 60 }}
        onTryPremium={onTryPremium}
        onClose={onClose}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onTryPremium).toHaveBeenCalledTimes(1);
  });
});

describe('CameraDeniedScreen (4t)', () => {
  it('says the camera is off, keeps gallery photos open and goes to Settings', async () => {
    const onOpenSettings = jest.fn();
    const onChooseGallery = jest.fn();
    const onClose = jest.fn();
    await wrap(
      <CameraDeniedScreen
        onOpenSettings={onOpenSettings}
        onChooseGallery={onChooseGallery}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('The camera is off for Tendril.')).toBeTruthy();
    expect(
      screen.getByText('Turn it on in Settings to scan plants. Gallery photos still work.'),
    ).toBeTruthy();
    expect(screen.getByText("Gallery photos get identified but don't earn points.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onChooseGallery).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('without a gallery (the label scanner) offers Settings alone', async () => {
    await wrap(
      <CameraDeniedScreen
        body="Turn it on in Settings to scan plant labels."
        onOpenSettings={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText('Turn it on in Settings to scan plant labels.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose from gallery' })).toBeNull();
    expect(screen.queryByText("Gallery photos get identified but don't earn points.")).toBeNull();
  });
});

describe('GalleryScreen (4u)', () => {
  it('with no photos shows the library placeholder, and Identify is off', async () => {
    const onChoose = jest.fn();
    await wrap(
      <GalleryScreen
        photos={[]}
        onChoose={onChoose}
        onRemovePhoto={noop}
        onIdentify={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText('Choose photos')).toBeTruthy();
    expect(screen.getByText('Up to 5 photos of the same plant.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Identify' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('with photos lists them, lets one go, and identifies', async () => {
    const onRemovePhoto = jest.fn();
    const onIdentify = jest.fn();
    await wrap(
      <GalleryScreen
        photos={['a', 'b']}
        onChoose={noop}
        onRemovePhoto={onRemovePhoto}
        onIdentify={onIdentify}
        onClose={noop}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(onRemovePhoto).toHaveBeenCalledWith(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Identify' }));
    expect(onIdentify).toHaveBeenCalledTimes(1);
  });

  it('stops offering more at five photos', async () => {
    await wrap(
      <GalleryScreen
        photos={['1', '2', '3', '4', '5']}
        onChoose={noop}
        onRemovePhoto={noop}
        onIdentify={noop}
        onClose={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Add photos' })).toBeNull();
  });
});

describe('LabelScanScreen', () => {
  it('shows the hint, and only says "not a Tendril label" after a wrong code', async () => {
    const a = await wrap(<LabelScanScreen preview={<Text>preview</Text>} onClose={noop} />);
    expect(
      screen.getByText('Point the camera at the QR code on your Tendril plant label.'),
    ).toBeTruthy();
    expect(screen.queryByText("That's not a Tendril label.")).toBeNull();
    await a.unmount();
    await wrap(<LabelScanScreen preview={<Text>preview</Text>} notTendrilLabel onClose={noop} />);
    expect(screen.getByText("That's not a Tendril label.")).toBeTruthy();
  });
});

describe('ScanTabScreen', () => {
  it('is the Scan header with the profile avatar', async () => {
    const onAvatar = jest.fn();
    await wrap(<ScanTabScreen avatarLetter="A" onAvatar={onAvatar} />);
    expect(screen.getByText('Scan')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(onAvatar).toHaveBeenCalledTimes(1);
  });
});
