import { aoife } from '@tendril/core';
import { SetCompleteScreen } from '../../screens/collection/SetCompleteScreen';
import { NewSpeciesScreen } from '../../screens/scan/NewSpeciesScreen';
import { registerFrame } from '../registry';

/** Frames 4ab to 4ae and 4al: the new-species moment and set completion. Settled, so captures never race the entrance. */

const noop = () => {};
const species = (
  key: string,
  outcome: string,
  label: string,
  reduceMotion = false,
  note = false,
) => (
  <NewSpeciesScreen
    species={aoife.species[key]!}
    outcome={aoife.outcomes[outcome]!}
    photoLabel={label}
    reduceMotion={reduceMotion}
    showReduceMotionNote={note}
    settled
    onContinue={noop}
  />
);

registerFrame({
  id: '4ab',
  title: 'New species',
  render: () => species('foxglove', 'foxglove-awarded', 'Your photo: foxglove'),
});
registerFrame({
  id: '4ac',
  title: 'New species · Reduce Motion (static card)',
  render: () => species('foxglove', 'foxglove-awarded', 'Your photo: foxglove', true, true),
});
registerFrame({
  id: '4ad',
  title: 'New species · points pending review',
  render: () => species('bluebell', 'bluebell-held', 'Your photo: bluebell'),
});
registerFrame({
  id: '4ae',
  title: 'New species · no points (gallery)',
  render: () => species('primrose', 'primrose-gallery', 'Gallery photo: primrose'),
});
registerFrame({
  id: '4al',
  title: 'Sets · set completed',
  render: () => (
    <SetCompleteScreen
      setName="Easy-care houseplants"
      total={6}
      onShare={noop}
      onContinue={noop}
      onBack={noop}
    />
  ),
});
