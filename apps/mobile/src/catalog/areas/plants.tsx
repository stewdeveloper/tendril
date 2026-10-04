import { aoife, type PlantSetup } from '@tendril/core';
import { FIXTURE_TODAY } from '../../api/fixtureDate';
import { LabelAdoptionScreen } from '../../screens/plants/LabelAdoptionScreen';
import { MyPlantsScreen } from '../../screens/plants/MyPlantsScreen';
import { PlantDetailScreen } from '../../screens/plants/PlantDetailScreen';
import { PlantSetupScreen } from '../../screens/plants/PlantSetupScreen';
import { registerFrame } from '../registry';
import { TabScreenFrame } from '../TabScreenFrame';

/** Frames 2d and 4i to 4p: My Plants, plant detail, plant setup and label adoption. */

const noop = () => {};
// Frame 4i shows Spidey as next due tomorrow; the fixture has it a day overdue.
const spideyTomorrow = { ...aoife.plants[1]!, careState: 'ok' as const, nextCheckOn: '2026-10-04' };
const list = {
  households: aoife.households,
  householdId: 'our-flat',
  plants: [aoife.plants[0]!, spideyTomorrow, aoife.plants[2]!],
  today: FIXTURE_TODAY,
  avatarLetter: 'A',
  onSwitch: noop,
  onOpen: noop,
  onAdd: noop,
  onScan: noop,
  onScanLabel: noop,
  onAvatar: noop,
};
const detail = (id: string) => (
  <PlantDetailScreen
    plant={aoife.plantDetails[id]!}
    pets={aoife.household.pets}
    today={FIXTURE_TODAY}
    onBack={noop}
    onMore={noop}
    onCheckIn={noop}
    onPetAte={noop}
  />
);

registerFrame({
  id: '4i',
  title: 'My Plants · by room, household switcher',
  render: () => (
    <TabScreenFrame active="plants">
      <MyPlantsScreen {...list} />
    </TabScreenFrame>
  ),
});

registerFrame({
  id: '4j',
  title: 'My Plants · empty',
  render: () => (
    <TabScreenFrame active="plants">
      <MyPlantsScreen {...list} households={[aoife.households[0]!]} plants={[]} />
    </TabScreenFrame>
  ),
});

registerFrame({
  id: '2d',
  title: 'Plant detail · Monty, pet check unknown',
  statusBar: 'light',
  render: () => <TabScreenFrame active="plants">{detail('monty')}</TabScreenFrame>,
});

registerFrame({
  id: '4k',
  title: 'Plant detail · given away',
  statusBar: 'light',
  render: () => detail('lily-given-away'),
});

registerFrame({
  id: '4l',
  title: 'Plant detail · died',
  statusBar: 'light',
  render: () => detail('fern-dead'),
});

const setup: PlantSetup = {
  nickname: 'Lily',
  room: null,
  light: 'medium',
  potMaterial: 'plastic',
  potSizeCm: null,
  drainage: 'yes',
  indoor: true,
};
const setupScreen = (initial: PlantSetup) => (
  <PlantSetupScreen speciesName="Peace lily" initial={initial} onSave={noop} onCancel={noop} />
);

registerFrame({
  id: '4m',
  title: 'Add plant setup',
  render: () => setupScreen(setup),
});

registerFrame({
  id: '4n',
  title: 'Add plant setup · "Not sure" answers',
  render: () =>
    setupScreen({ ...setup, light: 'unknown', potMaterial: 'unknown', drainage: 'unknown' }),
});

const label = {
  pets: aoife.household.pets,
  onAdd: noop,
  onScanPlant: noop,
  onBack: noop,
  onPetAte: noop,
};

registerFrame({
  id: '4o',
  title: 'Label adoption',
  statusBar: 'light',
  render: () => <LabelAdoptionScreen {...label} label={aoife.label} />,
});

registerFrame({
  id: '4p',
  title: 'Label adoption · unknown or retired code',
  render: () => <LabelAdoptionScreen {...label} label={null} />,
});
