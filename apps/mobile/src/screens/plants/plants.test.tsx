import { aoife, type PlantSetup } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FIXTURE_TODAY } from '../../api/fixtureDate';
import { ThemeProvider } from '../../theme';
import { LabelAdoptionScreen } from './LabelAdoptionScreen';
import { MyPlantsScreen } from './MyPlantsScreen';
import { PlantDetailScreen } from './PlantDetailScreen';
import { PlantSetupScreen } from './PlantSetupScreen';

const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

const list = {
  households: aoife.households,
  householdId: 'our-flat',
  plants: aoife.plants,
  today: FIXTURE_TODAY,
  avatarLetter: 'A',
  onSwitch: noop,
  onOpen: noop,
  onAdd: noop,
  onScan: noop,
  onScanLabel: noop,
  onAvatar: noop,
};
const detail = (id: string) => ({
  plant: aoife.plantDetails[id]!,
  pets: aoife.household.pets,
  today: FIXTURE_TODAY,
  onBack: noop,
  onMore: noop,
  onCheckIn: noop,
  onPetAte: noop,
});

describe('My Plants', () => {
  it('groups plants by room, in the order the rooms first appear', async () => {
    await wrap(<MyPlantsScreen {...list} />);
    const headings = ['Living room', 'Kitchen', 'Bedroom'].map((name) => screen.getByText(name));
    expect(headings).toHaveLength(3);
    expect(screen.getByText('My Plants')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Monty, Swiss cheese plant/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a plant' })).toBeTruthy();
  });

  it('lists plants with no room last, under no heading', async () => {
    const noRoom = { ...aoife.plants[2]!, id: 'fern', nickname: 'Fern', room: null };
    const first = { ...aoife.plants[0]!, room: 'Hall' };
    await wrap(<MyPlantsScreen {...list} plants={[noRoom, first, aoife.plants[1]!]} />);
    const order = screen
      .getAllByText(/^(Hall|Monty|Kitchen|Spidey|Fern)$/)
      .map((node) => node.props.children);
    // The roomless plant comes after every room, under no heading.
    expect(order).toEqual(['Hall', 'Monty', 'Kitchen', 'Spidey', 'Fern']);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('switches household and opens a plant', async () => {
    const onSwitch = jest.fn();
    const onOpen = jest.fn();
    await wrap(<MyPlantsScreen {...list} onSwitch={onSwitch} onOpen={onOpen} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mam’s house' }));
    expect(onSwitch).toHaveBeenCalledWith('mams-house');
    await fireEvent.press(screen.getByRole('button', { name: /^Lily, Peace lily/ }));
    expect(onOpen).toHaveBeenCalledWith('lily');
  });

  it('adds a plant and opens the avatar', async () => {
    const onAdd = jest.fn();
    const onAvatar = jest.fn();
    await wrap(<MyPlantsScreen {...list} onAdd={onAdd} onAvatar={onAvatar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a plant' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(onAdd).toHaveBeenCalled();
    expect(onAvatar).toHaveBeenCalled();
  });

  it('with no plants offers both scans, and no switcher for a single household', async () => {
    const onScan = jest.fn();
    const onScanLabel = jest.fn();
    await wrap(
      <MyPlantsScreen
        {...list}
        households={[aoife.households[0]!]}
        plants={[]}
        onScan={onScan}
        onScanLabel={onScanLabel}
      />,
    );
    expect(
      screen.getByText('No plants yet. Scan one, or scan the label it came with.'),
    ).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a plant' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant label' }));
    expect(onScan).toHaveBeenCalled();
    expect(onScanLabel).toHaveBeenCalled();
  });
});

describe('plant detail', () => {
  it('shows Unknown for both pets and the confidence', async () => {
    await wrap(<PlantDetailScreen {...detail('monty')} />);
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.getByText('Dogs: Unknown')).toBeTruthy();
    expect(screen.getByText('Very likely, 96%')).toBeTruthy();
    expect(screen.getByText('Living room')).toBeTruthy();
    expect(screen.getByText('Next soil check')).toBeTruthy();
    expect(screen.getByText('Check the soil every 7 days')).toBeTruthy();
    expect(screen.getByText('Soil not dry yet')).toBeTruthy();
    expect(screen.getByText('30 Sep')).toBeTruthy();
  });

  it('checks in, goes back, opens the menu and asks which pet ate it', async () => {
    const onCheckIn = jest.fn();
    const onBack = jest.fn();
    const onMore = jest.fn();
    const onPetAte = jest.fn();
    await wrap(
      <PlantDetailScreen
        {...detail('monty')}
        onCheckIn={onCheckIn}
        onBack={onBack}
        onMore={onMore}
        onPetAte={onPetAte}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    expect(onCheckIn).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
    expect(onMore).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Miso' }));
    expect(onPetAte).toHaveBeenCalledWith('pet-miso');
  });

  it('a dead plant keeps its history and offers nothing to do', async () => {
    await wrap(<PlantDetailScreen {...detail('fern-dead')} />);
    expect(
      screen.getByText('Marked as died on 20 August: too dry. We use this to give better advice.'),
    ).toBeTruthy();
    expect(screen.getByText('Died · too dry')).toBeTruthy();
    expect(screen.getByText('20 Aug')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(screen.queryByText('Pet check')).toBeNull();
  });

  it('a plant that was given away says so, with its history', async () => {
    await wrap(<PlantDetailScreen {...detail('lily-given-away')} />);
    expect(screen.getByText('Given away on 12 September. Kept in your history.')).toBeTruthy();
    expect(screen.getByText('Added from a scan')).toBeTruthy();
    expect(screen.getByText('Peace lily · Spathiphyllum')).toBeTruthy();
  });
});

describe('plant setup', () => {
  const initial: PlantSetup = {
    nickname: 'Lily',
    room: null,
    light: 'unknown',
    potMaterial: 'unknown',
    potSizeCm: null,
    drainage: 'unknown',
    indoor: true,
  };
  const answered: PlantSetup = {
    ...initial,
    light: 'medium',
    potMaterial: 'plastic',
    drainage: 'yes',
  };

  it('saves the answers, with not-sure allowed', async () => {
    const onSave = jest.fn();
    await wrap(
      <PlantSetupScreen
        speciesName="Peace lily"
        initial={initial}
        onSave={onSave}
        onCancel={noop}
      />,
    );
    expect(screen.getByText('Set up Lily')).toBeTruthy();
    expect(
      screen.getByText(
        "Not sure is fine. We'll start with the species' basic schedule and you can change it later.",
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bright' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        nickname: 'Lily',
        light: 'bright',
        drainage: 'unknown',
        room: null,
      }),
    );
  });

  it('shows the not-sure note only while an answer is not sure', async () => {
    await wrap(
      <PlantSetupScreen
        speciesName="Peace lily"
        initial={answered}
        onSave={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByText(/Not sure is fine/)).toBeNull();
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Not sure' })[0]!);
    expect(screen.getByText(/Not sure is fine/)).toBeTruthy();
  });

  it('edits the nickname, and will not save a blank one', async () => {
    const onSave = jest.fn();
    await wrap(
      <PlantSetupScreen
        speciesName="Peace lily"
        initial={answered}
        onSave={onSave}
        onCancel={noop}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText('Nickname'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Big Lil');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Big Lil' }));
  });

  it('cancels', async () => {
    const onCancel = jest.fn();
    await wrap(
      <PlantSetupScreen
        speciesName="Peace lily"
        initial={answered}
        onSave={noop}
        onCancel={onCancel}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('with no nickname yet, titles the screen with the species', async () => {
    await wrap(
      <PlantSetupScreen
        speciesName="Peace lily"
        initial={{ ...initial, nickname: '' }}
        onSave={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText('Set up Peace lily')).toBeTruthy();
  });
});

describe('label adoption', () => {
  const props = {
    pets: aoife.household.pets,
    onAdd: noop,
    onScanPlant: noop,
    onBack: noop,
    onPetAte: noop,
  };

  it('says no identification is used, and names the grower and the verdicts', async () => {
    await wrap(<LabelAdoptionScreen {...props} label={aoife.label} />);
    expect(screen.getByText('No identification used.')).toBeTruthy();
    expect(screen.getByText('From the label · Greenhouse Growers')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByText('Dogs: Moderate')).toBeTruthy();
    expect(screen.getByText('Spathiphyllum')).toBeTruthy();
    expect(screen.getByText('Bright, indirect light')).toBeTruthy();
  });

  it('adds the plant, goes back, and asks which pet ate it', async () => {
    const onAdd = jest.fn();
    const onBack = jest.fn();
    const onPetAte = jest.fn();
    await wrap(
      <LabelAdoptionScreen
        {...props}
        label={aoife.label}
        onAdd={onAdd}
        onBack={onBack}
        onPetAte={onPetAte}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my plants' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onAdd).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bran' }));
    expect(onPetAte).toHaveBeenCalledWith('pet-bran');
  });

  it('an unknown code offers a scan of the plant itself', async () => {
    const onScanPlant = jest.fn();
    const onBack = jest.fn();
    await wrap(
      <LabelAdoptionScreen {...props} label={null} onScanPlant={onScanPlant} onBack={onBack} />,
    );
    expect(screen.getByText("We don't know this label. The code may be retired.")).toBeTruthy();
    expect(screen.getByText('You can still scan the plant itself.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan the plant' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onScanPlant).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
