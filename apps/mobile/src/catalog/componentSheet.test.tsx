import { render, screen } from '@testing-library/react-native';
import { CatalogFrame } from './CatalogFrame';
import './componentSheet';
import { getFrame, listFrames } from './registry';

const SHEETS = 'abcdefghijklmnopqr'.split('').map((letter) => `5${letter}`);
const NAMES: Record<string, string> = {
  '5a': 'Confidence label',
  '5b': 'Pet check card',
  '5c': 'Pet verdict chip',
  '5d': 'Rarity badge',
  '5e': 'Plant card',
  '5f': 'Task row',
  '5g': 'Check-in sheet',
  '5h': 'Quota meter',
  '5i': 'Streak counter',
  '5j': 'League row',
  '5k': 'Plantdex tile',
  '5l': 'Find marker',
  '5m': 'Plan card',
  '5n': 'Permission primer',
  '5o': 'Button',
  '5p': 'Sheet',
  '5q': 'Empty state',
  '5r': 'Snackbar',
};

const ids = () => listFrames().map((f) => f.id);

describe('component sheet', () => {
  it('registers one page for each of the 18 components, 5a to 5r', () => {
    expect(SHEETS).toHaveLength(18);
    for (const id of SHEETS) expect(getFrame(id)).toBeDefined();
  });

  it('every continuation page continues a registered page', () => {
    const continuations = ids().filter((id) => /^5[a-r]-\d+$/.test(id));
    expect(continuations.length).toBeGreaterThan(0);
    for (const id of continuations) expect(getFrame(id.split('-')[0]!)).toBeDefined();
  });

  it('registers nothing else under 5', () => {
    expect(ids().filter((id) => id.startsWith('5') && !/^5[a-r](-\d+)?$/.test(id))).toEqual([]);
  });

  it.each(SHEETS)('%s renders under its heading', async (id) => {
    await render(<CatalogFrame entry={getFrame(id)!} />);
    expect(screen.getByRole('header', { name: NAMES[id]! })).toBeTruthy();
  });

  it.each(ids().filter((id) => /^5[a-r]-\d+$/.test(id)))(
    '%s renders, headed "(continued)" unless it is the bare full-height sheet',
    async (id) => {
      await render(<CatalogFrame entry={getFrame(id)!} />);
      if (id === '5p-2') {
        expect(screen.getByRole('header', { name: 'Log a find' })).toBeTruthy();
      } else {
        expect(
          screen.getByRole('header', { name: `${NAMES[id.split('-')[0]!]!} (continued)` }),
        ).toBeTruthy();
      }
    },
  );

  it('lists the states in captions, with no celebration anywhere', async () => {
    await render(<CatalogFrame entry={getFrame('5f')!} />);
    expect(screen.getByText('Due, with the Check in action')).toBeTruthy();
    expect(screen.queryByText(/great|well done|nice/i)).toBeNull();
  });
});
