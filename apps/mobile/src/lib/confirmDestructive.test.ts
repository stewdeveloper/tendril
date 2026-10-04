import { Alert, Platform } from 'react-native';
import { confirmDestructive } from './confirmDestructive';

const options = {
  title: 'Delete your account?',
  message: 'This deletes your plants, finds, photos and points for good.',
  confirmLabel: 'Delete account',
};

describe('confirmDestructive', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS });
    jest.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  describe('on native', () => {
    const press = (label: string) => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        buttons?.find((b) => b.text === label)?.onPress?.();
      });
      return alert;
    };

    it('asks with a destructive confirm button and a cancel button, and resolves true on confirm', async () => {
      const alert = press('Delete account');
      await expect(confirmDestructive(options)).resolves.toBe(true);
      expect(alert).toHaveBeenCalledWith(
        options.title,
        options.message,
        [
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Delete account', style: 'destructive' }),
        ],
        expect.objectContaining({ cancelable: true }),
      );
    });

    it('resolves false on cancel', async () => {
      press('Cancel');
      await expect(confirmDestructive(options)).resolves.toBe(false);
    });

    it('resolves false when the alert is dismissed without a choice (Android back)', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b, opts) => opts?.onDismiss?.());
      await expect(confirmDestructive(options)).resolves.toBe(false);
    });

    it('takes a custom cancel label', async () => {
      const alert = press('Keep it');
      await expect(confirmDestructive({ ...options, cancelLabel: 'Keep it' })).resolves.toBe(false);
      expect(alert.mock.calls[0]?.[2]?.[0]?.text).toBe('Keep it');
    });
  });

  describe('on web', () => {
    const onWeb = (answer: boolean) => {
      Object.defineProperty(Platform, 'OS', { value: 'web' });
      const confirm = jest.fn(() => answer);
      (globalThis as { window?: unknown }).window = { confirm };
      jest.spyOn(Alert, 'alert');
      return confirm;
    };

    it('uses window.confirm with the title and message, and never Alert.alert', async () => {
      const confirm = onWeb(true);
      await expect(confirmDestructive(options)).resolves.toBe(true);
      expect(confirm).toHaveBeenCalledWith(`${options.title}\n\n${options.message}`);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('resolves false when the person declines', async () => {
      onWeb(false);
      await expect(confirmDestructive(options)).resolves.toBe(false);
    });
  });
});
