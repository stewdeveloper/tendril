import { aoife, type DiagnosisResult } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { LogFindSheet } from './LogFindSheet';
import { ResultScreen } from './ResultScreen';

const noop = () => {};
const h = {
  onClose: noop,
  onAddToPlants: noop,
  onLogFind: noop,
  onChoose: noop,
  onRetake: noop,
  onRetry: noop,
  onPetAte: noop,
  onPlaceType: noop,
  onSaveFind: noop,
  onTurnOnLocation: noop,
  onCloseLogFind: noop,
};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const pets = aoife.household.pets;
const scan = (key: string) => aoife.scanResults[key]!;

const diagnosis: DiagnosisResult = {
  id: 'dx-1',
  conditionName: 'Overwatering',
  probability: 0.72,
  explanation: 'Yellow lower leaves.',
  planChange: null,
};

describe('ResultScreen', () => {
  it('very likely: confidence first, pet check, both actions', async () => {
    const onAdd = jest.fn();
    const onLog = jest.fn();
    await wrap(
      <ResultScreen
        result={scan('peace-lily-very-likely')}
        pets={pets}
        logFind={null}
        {...h}
        onAddToPlants={onAdd}
        onLogFind={onLog}
      />,
    );
    expect(screen.getByText('Very likely, 94%')).toBeTruthy();
    expect(screen.getByText('Peace lily')).toBeTruthy();
    expect(screen.getByText('Spathiphyllum')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByText('Care basics')).toBeTruthy();
    expect(screen.getByText('Other possibilities')).toBeTruthy();
    expect(screen.getByText('Flamingo flower')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to My Plants' }));
    expect(onAdd).toHaveBeenCalledWith('peace-lily');
    await fireEvent.press(screen.getByRole('button', { name: 'Log a find' }));
    expect(onLog).toHaveBeenCalled();
  });

  it('very likely: the strip shows one thumbnail per photo and counts them', async () => {
    await wrap(
      <ResultScreen
        result={{ ...scan('peace-lily-very-likely'), photoUrls: ['', '', ''] }}
        pets={pets}
        logFind={null}
        {...h}
      />,
    );
    expect(screen.getByText('3 photos')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Photo \d$/ })).toHaveLength(3);
  });

  it('very likely: never claims anything is safe', async () => {
    await wrap(
      <ResultScreen result={scan('peace-lily-very-likely')} pets={pets} logFind={null} {...h} />,
    );
    expect(screen.queryByText(/\bsafe\b/i)).toBeNull();
  });

  it('a health check on the scan is a minimal card that defers advice to the plant page', async () => {
    await wrap(
      <ResultScreen
        result={{ ...scan('peace-lily-very-likely'), diagnosis }}
        pets={pets}
        logFind={null}
        {...h}
      />,
    );
    expect(screen.getByText('Health check')).toBeTruthy();
    expect(screen.getByText('Overwatering')).toBeTruthy();
    expect(screen.getByText('Likely, 72%')).toBeTruthy();
    expect(
      screen.getByText('Once you add this plant, the advice appears on its page.'),
    ).toBeTruthy();
  });

  it('no diagnosis, no health check card', async () => {
    await wrap(
      <ResultScreen result={scan('peace-lily-very-likely')} pets={pets} logFind={null} {...h} />,
    );
    expect(screen.queryByText('Health check')).toBeNull();
  });

  it('pet ate this reports the pet that ate it', async () => {
    const onPetAte = jest.fn();
    await wrap(
      <ResultScreen
        result={scan('peace-lily-very-likely')}
        pets={[pets[0]!]}
        logFind={null}
        {...h}
        onPetAte={onPetAte}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    expect(onPetAte).toHaveBeenCalledWith(pets[0]!.id);
  });

  it('likely: compares two, never settles a verdict, and adds the match note', async () => {
    const onChoose = jest.fn();
    await wrap(
      <ResultScreen
        result={scan('peace-lily-likely')}
        pets={pets}
        logFind={null}
        {...h}
        onChoose={onChoose}
      />,
    );
    expect(
      screen.getByText('Likely a peace lily, 71%. Compare these two before you add it.'),
    ).toBeTruthy();
    expect(screen.getByText('Flamingo flower')).toBeTruthy();
    expect(screen.getByText('Not sure, 22%')).toBeTruthy();
    expect(
      screen.getByText('This depends on the match. Confirm the plant to be sure.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to My Plants' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'This is a peace lily' }));
    expect(onChoose).toHaveBeenCalledWith('peace-lily');
  });

  it('not sure asks for a better photo instead of guessing', async () => {
    const onRetake = jest.fn();
    await wrap(
      <ResultScreen
        result={scan('not-sure')}
        pets={pets}
        logFind={null}
        {...h}
        onRetake={onRetake}
      />,
    );
    expect(screen.getByText('Not sure yet')).toBeTruthy();
    expect(screen.getByText('Try a close photo of one leaf or flower.')).toBeTruthy();
    expect(screen.getByText('Closest matches')).toBeTruthy();
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.getByText('Dogs: Unknown')).toBeTruthy();
    expect(
      screen.getByText('This depends on the match. Confirm the plant to be sure.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to My Plants' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Take a close photo' }));
    expect(onRetake).toHaveBeenCalled();
  });

  it('not a plant and error say no identification was used', async () => {
    const onRetake = jest.fn();
    const a = await wrap(
      <ResultScreen
        result={scan('not-a-plant')}
        pets={pets}
        logFind={null}
        {...h}
        onRetake={onRetake}
      />,
    );
    expect(screen.getByText('No plant found')).toBeTruthy();
    expect(screen.getByText("This didn't use an identification.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetake).toHaveBeenCalled();
    await a.unmount();
    const onRetry = jest.fn();
    const onClose = jest.fn();
    await wrap(
      <ResultScreen
        result={scan('error')}
        pets={pets}
        logFind={null}
        {...h}
        onRetry={onRetry}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(
      screen.getByText("We couldn't identify this one. It didn't use an identification."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('offline keeps the photos and offers OK', async () => {
    const onClose = jest.fn();
    await wrap(
      <ResultScreen result={scan('offline')} pets={pets} logFind={null} {...h} onClose={onClose} />,
    );
    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(
      screen.getByText("Your photos are saved. We'll identify them when you're back online."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('log a find with location off says it earns no points', async () => {
    await wrap(
      <ResultScreen
        result={scan('foxglove-find')}
        pets={pets}
        logFind={{ visible: true, placeType: 'wild', locationOn: false }}
        {...h}
      />,
    );
    expect(
      screen.getByText('Location is off. This find goes in your Plantdex without points.'),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Wild' })).toBeChecked();
  });
});

describe('LogFindSheet', () => {
  const sheet = (props: Partial<React.ComponentProps<typeof LogFindSheet>> = {}) => (
    <LogFindSheet
      visible
      placeType={null}
      locationOn
      onPlaceType={noop}
      onSave={noop}
      onTurnOnLocation={noop}
      onClose={noop}
      {...props}
    />
  );

  it('preselects nothing and holds Save find until a place is chosen', async () => {
    const onSave = jest.fn();
    await wrap(sheet({ onSave }));
    expect(screen.getByText('Where was it?')).toBeTruthy();
    for (const name of ['Shop', 'Garden or park', 'Wild'])
      expect(screen.getByRole('radio', { name })).not.toBeChecked();
    const save = screen.getByRole('button', { name: 'Save find' });
    expect(save).toBeDisabled();
    await fireEvent.press(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports the place chosen, as the domain value', async () => {
    const onPlaceType = jest.fn();
    await wrap(sheet({ onPlaceType }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Shop' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Garden or park' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Wild' }));
    expect(onPlaceType.mock.calls.map((c) => c[0])).toEqual(['shop', 'garden_park', 'wild']);
  });

  it('saves once a place is chosen, with the points note when location is on', async () => {
    const onSave = jest.fn();
    await wrap(sheet({ placeType: 'wild', onSave }));
    expect(
      screen.getByText(
        'Points come from in-app camera finds. No picking, no trespassing, and others only ever see an area.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn on location' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('with location off, Turn on location is offered', async () => {
    const onTurnOn = jest.fn();
    await wrap(sheet({ placeType: 'wild', locationOn: false, onTurnOnLocation: onTurnOn }));
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on location' }));
    expect(onTurnOn).toHaveBeenCalled();
  });
});
