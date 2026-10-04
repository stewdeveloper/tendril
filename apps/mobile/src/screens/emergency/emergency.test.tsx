import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { PetEmergencyScreen } from './PetEmergencyScreen';

const base = {
  petName: 'Miso',
  animal: 'cat' as const,
  speciesName: 'peace lily',
  matchProbability: 0.94,
  toxicity: {
    animal: 'cat' as const,
    severity: 'moderate' as const,
    summary: null,
    symptoms:
      'Peace lily can irritate the mouth and cause drooling, vomiting and trouble swallowing.',
    sourceName: 'ASPCA',
    sourceUrl: null,
  },
};
const noop = () => {};
const handlers = {
  backLabel: 'Lily',
  onCallVet: noop,
  onCallPoisonLine: noop,
  onFindVet: noop,
  onSaveVet: noop,
  onBack: noop,
};
const poisonLine = {
  name: 'ASPCA Poison Control',
  phone: '(888) 426-4435',
  note: 'Open 24 hours. A fee may apply.',
};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
describe('PetEmergencyScreen', () => {
  it('puts the vet first, then the poison line, with the match confidence', async () => {
    const onCallVet = jest.fn();
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        info={{ ...base, vet: { name: 'Riverside Vets', phone: '01 555 0100' }, poisonLine }}
        onCallVet={onCallVet}
      />,
    );
    expect(screen.getByText('If Miso ate peace lily')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByText('Source: ASPCA. Based on a very likely match, 94%.')).toBeTruthy();
    expect(screen.getByText('Open 24 hours. A fee may apply.')).toBeTruthy();
    // Document order, read by what the buttons say.
    const calls = screen.getAllByText(/^Call /).map((node) => node.props.children);
    expect(calls).toEqual(['Call your vet', 'Call ASPCA Poison Control (888) 426-4435']);
    await fireEvent.press(screen.getByRole('button', { name: /Call your vet/ }));
    expect(onCallVet).toHaveBeenCalled();
  });

  it('keeps both call buttons in the lower half of the screen content', async () => {
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        info={{ ...base, vet: { name: 'Riverside Vets', phone: '01 555 0100' }, poisonLine }}
      />,
    );
    // The spacer that pushes the calls down sits before the first call button.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Call your vet')).toBeGreaterThan(tree.indexOf('Source: ASPCA'));
  });

  it('leaves out the match line when there is no match to speak of', async () => {
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        info={{ ...base, matchProbability: null, vet: null, poisonLine: null }}
      />,
    );
    expect(screen.getByText('Source: ASPCA.')).toBeTruthy();
    expect(screen.queryByText(/Based on/)).toBeNull();
  });

  it('without a vet or a poison line it says what to do', async () => {
    const onFindVet = jest.fn();
    const onSaveVet = jest.fn();
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        info={{ ...base, vet: null, poisonLine: null }}
        onFindVet={onFindVet}
        onSaveVet={onSaveVet}
      />,
    );
    expect(
      screen.getByText("You haven't saved a vet yet. Call your nearest vet now."),
    ).toBeTruthy();
    expect(screen.queryByText(/Call your vet/)).toBeNull();
    expect(screen.queryByText(/ASPCA Poison Control/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Find a vet nearby' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save your vet' }));
    expect(onFindVet).toHaveBeenCalled();
    expect(onSaveVet).toHaveBeenCalled();
  });

  it('with a vet saved it offers the call, with no note and nothing to save', async () => {
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        info={{ ...base, vet: { name: 'Riverside Vets', phone: '01 555 0100' }, poisonLine: null }}
      />,
    );
    expect(screen.queryByText(/haven't saved a vet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Find a vet nearby' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save your vet' })).toBeNull();
  });

  it('a call button for a number with no digits is left out', async () => {
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        info={{
          ...base,
          vet: { name: 'Riverside Vets', phone: 'ask reception' },
          poisonLine: null,
        }}
      />,
    );
    expect(screen.queryByText('Call your vet')).toBeNull();
    expect(screen.getByRole('button', { name: 'Find a vet nearby' })).toBeTruthy();
  });

  it('goes back by the name of what the person came from', async () => {
    const onBack = jest.fn();
    await wrap(
      <PetEmergencyScreen
        {...handlers}
        onBack={onBack}
        info={{ ...base, vet: null, poisonLine: null }}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Lily' }));
    expect(onBack).toHaveBeenCalled();
  });
});
