import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ThemeProvider } from '../theme';
import {
  ConfidenceLabel,
  PermissionPrimer,
  PetCheckCard,
  QuotaMeter,
  RarityBadge,
  StreakCalendar,
  StreakCounter,
  VerdictChip,
} from './index';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);
const lilyTox = aoife.speciesToxicity['peace-lily']!;

describe('ConfidenceLabel', () => {
  it('reads word first and spells percent for screen readers', async () => {
    await wrap(<ConfidenceLabel probability={0.94} />);
    expect(screen.getByText('Very likely, 94%')).toBeTruthy();
    expect(screen.getByLabelText('Very likely, 94 percent')).toBeTruthy();
  });
});

describe('VerdictChip', () => {
  it('names the animal and verdict in text and for screen readers', async () => {
    await wrap(<VerdictChip animal="cat" severity="moderate" />);
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByLabelText('Cats: moderate toxicity')).toBeTruthy();
  });
  it('switches chip text to #0E1A13 in dark mode', async () => {
    await wrap(<VerdictChip animal="dog" severity="none" />, 'dark');
    const text = screen.getByText('Dogs: No known toxicity');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: '#0E1A13' });
    expect(text.props.numberOfLines).toBeUndefined();
  });
  it('shows other pets as unknown even if data says none', async () => {
    await wrap(<VerdictChip animal="other" severity="none" />);
    expect(screen.getByText('Other pets: Unknown')).toBeTruthy();
  });
});

describe('PetCheckCard', () => {
  const pets = aoife.household.pets;
  it('one row per pet with the plain line and source, plus the match footer', async () => {
    const onPetAte = jest.fn();
    await wrap(
      <PetCheckCard
        pets={pets}
        toxicity={lilyTox}
        matchProbability={0.94}
        speciesName="Peace lily"
        onPetAte={onPetAte}
      />,
    );
    expect(screen.getByText('Miso and Bran')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByText('Dogs: Moderate')).toBeTruthy();
    expect(
      screen.getByText(
        /Moderate for cats\. Peace lily can irritate the mouth and cause drooling and vomiting\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Based on the match: Very likely, 94%')).toBeTruthy();
    expect(
      screen.queryByText('This depends on the match. Confirm the plant to be sure.'),
    ).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    // Two pets: the button asks which one first.
    expect(onPetAte).not.toHaveBeenCalled();
    expect(screen.getByText('Which pet?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bran' }));
    expect(onPetAte).toHaveBeenCalledWith(pets[1]!.id);
  });
  it('calls through at once with a single pet', async () => {
    const onPetAte = jest.fn();
    await wrap(
      <PetCheckCard
        pets={[pets[0]!]}
        toxicity={lilyTox}
        matchProbability={0.94}
        speciesName="Peace lily"
        onPetAte={onPetAte}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    expect(onPetAte).toHaveBeenCalledWith(pets[0]!.id);
    expect(screen.queryByText('Which pet?')).toBeNull();
  });
  it('shows Unknown everywhere when the match is not sure (2c)', async () => {
    await wrap(
      <PetCheckCard
        pets={pets}
        toxicity={lilyTox}
        matchProbability={0.3}
        speciesName="Peace lily"
        onPetAte={() => {}}
      />,
    );
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.getByText('Dogs: Unknown')).toBeTruthy();
    expect(screen.queryByText(/Moderate/)).toBeNull();
  });
  it('reads a none entry without a source as Unknown', async () => {
    await wrap(
      <PetCheckCard
        pets={[pets[0]!]}
        toxicity={[
          {
            animal: 'cat',
            severity: 'none',
            summary: null,
            symptoms: null,
            sourceName: null,
            sourceUrl: null,
          },
        ]}
        matchProbability={null}
        speciesName="Peace lily"
        onPetAte={() => {}}
      />,
    );
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.queryByText(/No known toxicity/)).toBeNull();
  });
  it('lets the pet row wrap at large text', async () => {
    await wrap(
      <PetCheckCard
        pets={[pets[0]!]}
        toxicity={lilyTox}
        matchProbability={0.94}
        speciesName="Peace lily"
        onPetAte={() => {}}
      />,
    );
    const row = screen.getAllByText('Miso').at(-1)?.parent?.parent;
    expect(StyleSheet.flatten(row?.props.style)).toMatchObject({ flexWrap: 'wrap' });
  });
  it('adds the likely-match note when the match is only likely', async () => {
    await wrap(
      <PetCheckCard
        pets={pets}
        toxicity={lilyTox}
        matchProbability={0.71}
        speciesName="Peace lily"
        onPetAte={() => {}}
      />,
    );
    expect(
      screen.getByText('This depends on the match. Confirm the plant to be sure.'),
    ).toBeTruthy();
  });
  it('unknown toxicity names the pet and never says safe', async () => {
    await wrap(
      <PetCheckCard
        pets={pets}
        toxicity={[]}
        matchProbability={0.96}
        speciesName="Swiss cheese plant"
        onPetAte={() => {}}
      />,
    );
    expect(
      screen.getByText('Not reviewed yet. Keep it away from Miso until we know more.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Not reviewed yet. Keep it away from Bran until we know more.'),
    ).toBeTruthy();
    expect(screen.queryByText(/safe/i)).toBeNull();
  });
  it('renders nothing with no pets', async () => {
    await wrap(
      <PetCheckCard
        pets={[]}
        toxicity={lilyTox}
        matchProbability={0.94}
        speciesName="Peace lily"
        onPetAte={() => {}}
      />,
    );
    expect(screen.queryByText('Pet check')).toBeNull();
  });
});

describe('progress components', () => {
  it('RarityBadge reads its tier', async () => {
    await wrap(<RarityBadge tier="rare" />);
    expect(screen.getByText('Rare')).toBeTruthy();
    expect(screen.getByLabelText('Rarity: Rare')).toBeTruthy();
  });
  it('QuotaMeter reads "7 of 10 left this month" and reveals the reset date on press', async () => {
    await wrap(<QuotaMeter quota={aoife.today.identifications} variant="bar" />);
    expect(screen.getByText('7 of 10 left this month')).toBeTruthy();
    await fireEvent.press(screen.getByText('7 of 10 left this month'));
    expect(screen.getByText('Resets 1 November')).toBeTruthy();
  });
  it('QuotaMeter card follows the Today tile (frame 2e)', async () => {
    await wrap(<QuotaMeter quota={aoife.today.identifications} variant="card" />);
    expect(screen.getByText('Identifications')).toBeTruthy();
    expect(screen.getByText('7 of 10 left')).toBeTruthy();
  });
  it('a broken streak turns grey, never red', async () => {
    await wrap(<StreakCounter days={0} label="day care streak" state="broken" size="stat" />);
    expect(StyleSheet.flatten(screen.getByText('0').props.style)).toMatchObject({
      color: '#56605A',
    });
  });
  it('StreakCalendar labels each day for screen readers', async () => {
    await wrap(<StreakCalendar marks={['checked', 'freeze', 'missed', 'empty']} />);
    expect(screen.getByLabelText('Checked in')).toBeTruthy();
    expect(screen.getByLabelText('Freeze used')).toBeTruthy();
    expect(screen.getByLabelText('Missed')).toBeTruthy();
    expect(screen.getByLabelText('No check-in')).toBeTruthy();
  });
  it('PermissionPrimer says why and always offers Not now', async () => {
    const onNotNow = jest.fn();
    await wrap(<PermissionPrimer kind="location" onContinue={() => {}} onNotNow={onNotNow} />);
    expect(screen.getByText('Use your location')).toBeTruthy();
    expect(
      screen.getByText('To place your finds. Others only ever see an area, never a pin.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onNotNow).toHaveBeenCalled();
  });
  it('PermissionPrimer takes its own title, body, button labels and extra content', async () => {
    const onContinue = jest.fn();
    const onNotNow = jest.fn();
    await wrap(
      <PermissionPrimer
        kind="camera"
        title="Your first scan"
        body="Point the camera at any plant."
        continueLabel="Allow camera"
        notNowLabel="Maybe later"
        onContinue={onContinue}
        onNotNow={onNotNow}
      >
        <Text>Three tips</Text>
      </PermissionPrimer>,
    );
    expect(screen.getByRole('header')).toHaveTextContent('Your first scan');
    expect(screen.getByText('Point the camera at any plant.')).toBeTruthy();
    expect(screen.getByText('Three tips')).toBeTruthy();
    expect(screen.queryByText('Use the camera')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow camera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Maybe later' }));
    expect(onContinue).toHaveBeenCalled();
    expect(onNotNow).toHaveBeenCalled();
  });
  it('PermissionPrimer keeps its default copy and labels when none are given', async () => {
    await wrap(<PermissionPrimer kind="camera" onContinue={() => {}} onNotNow={() => {}} />);
    expect(screen.getByText('Use the camera')).toBeTruthy();
    expect(
      screen.getByText('To photograph plants. Photos stay private unless you share one.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });
});
