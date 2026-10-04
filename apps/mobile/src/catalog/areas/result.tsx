import { aoife, type ScanResult } from '@tendril/core';
import { ResultScreen, type ResultScreenProps } from '../../screens/scan/ResultScreen';
import { registerFrame } from '../registry';

/** Frames 2a, 2c and 4v to 4aa: the scan result in all its states, and the "Log a find" sheet; plus 2a-health. */

const noop = () => {};
const handlers = {
  onClose: noop,
  onAddToPlants: noop,
  onLogFind: noop,
  onChoose: noop,
  onRetake: noop,
  onRetry: noop,
  onPetAte: noop,
  onSourcePress: noop,
  onPlaceType: noop,
  onSaveFind: noop,
  onTurnOnLocation: noop,
  onCloseLogFind: noop,
};
const pets = aoife.household.pets;
const scan = (key: string): ScanResult => aoife.scanResults[key]!;

const result = (
  id: string,
  title: string,
  scanKey: string,
  props: Partial<ResultScreenProps> = {},
  photoUrls: string[] = [],
) =>
  registerFrame({
    id,
    title,
    statusBar: 'light',
    render: () => (
      <ResultScreen
        result={{ ...scan(scanKey), photoUrls }}
        pets={pets}
        logFind={null}
        {...handlers}
        {...props}
      />
    ),
  });

// The design's strip shows three photos, drawn as placeholders (the screen counts the URLs it is given).
result('2a', 'Result · very likely, with the pet check (scrolls)', 'peace-lily-very-likely', {}, [
  '',
  '',
  '',
]);

// The camera's health check had a result: the scan shows its minimal card. No design frame has it.
registerFrame({
  id: '2a-health',
  title: 'Result · very likely, with a health check',
  statusBar: 'light',
  render: () => (
    <ResultScreen
      result={{
        ...scan('peace-lily-very-likely'),
        photoUrls: ['', '', ''],
        diagnosis: {
          id: 'dx-catalog',
          conditionName: 'Overwatering',
          probability: 0.72,
          explanation: 'Yellow lower leaves and soft stems often mean the roots are staying wet.',
          planChange: null,
        },
      }}
      pets={pets}
      logFind={null}
      {...handlers}
    />
  ),
});

result('2c', 'Result · not sure, asks for a better photo', 'not-sure');
result('4v', 'Result · likely, compare before adding', 'peace-lily-likely');
result('4w', 'Result · not a plant', 'not-a-plant');
result('4x', 'Result · offline', 'offline');
result('4y', 'Result · error', 'error');

// The sheet frames show the foxglove find behind the scrim.
result('4z', 'Log a find · sheet', 'foxglove-find', {
  presentation: 'overlay',
  logFind: { visible: true, placeType: 'wild', locationOn: true },
});
result('4aa', 'Log a find · location off', 'foxglove-find', {
  presentation: 'overlay',
  logFind: { visible: true, placeType: 'wild', locationOn: false },
});
