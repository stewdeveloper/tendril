import { Alert, Platform } from 'react-native';

export interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  /** The destructive button, e.g. "Delete account". */
  confirmLabel: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
}

/**
 * Asks before something that can't be undone, and resolves true only if the person confirms.
 * Native shows an alert with a destructive button. Web has no working `Alert.alert` (react-native-web
 * leaves it empty), so it uses `window.confirm`. Screens call this and tests mock it, so the flow
 * can be exercised on every platform.
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
}: ConfirmDestructiveOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
