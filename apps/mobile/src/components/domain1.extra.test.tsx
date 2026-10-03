import { aoife, type Pet, type ToxicityEntry } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import {
  Button,
  ConfidenceLabel,
  PermissionPrimer,
  PetCheckCard,
  QuotaMeter,
  RarityBadge,
  StreakCalendar,
  StreakCounter,
} from './index';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);
const flat = (el: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

const easter = aoife.speciesToxicity['easter-lily']!;
const miso: Pet = { id: 'p1', animal: 'cat', name: 'Miso' };

describe('PetCheckCard details', () => {
  it('the source is an underlined link that reports its url', async () => {
    const onSourcePress = jest.fn();
    await wrap(
      <PetCheckCard
        pets={[miso]}
        toxicity={aoife.speciesToxicity['peace-lily']!}
        matchProbability={null}
        speciesName="Peace lily"
        onPetAte={() => {}}
        onSourcePress={onSourcePress}
      />,
    );
    const link = screen.getByRole('link', { name: 'ASPCA' });
    expect(flat(link)).toMatchObject({ textDecorationLine: 'underline', color: '#2E6B4E' });
    await fireEvent.press(link);
    expect(onSourcePress).toHaveBeenCalledWith(expect.stringContaining('peace-lily'));
    // No match to depend on (plant detail): no footer, no note.
    expect(screen.queryByText(/Based on the match/)).toBeNull();
  });

  it('a severe line stays word for word, with the source on its own link line', async () => {
    const onSourcePress = jest.fn();
    await wrap(
      <PetCheckCard
        pets={[miso]}
        toxicity={easter}
        matchProbability={0.94}
        speciesName="Easter lily"
        onPetAte={() => {}}
        onSourcePress={onSourcePress}
      />,
    );
    expect(screen.getByText('Cats: Severe')).toBeTruthy();
    // "Call your vet now." is the last thing in the line: nothing is appended to it.
    expect(screen.getByText(/Call your vet now\.$/)).toBeTruthy();
    expect(screen.queryByText(/Call your vet now\. Source/)).toBeNull();
    const link = screen.getByRole('link', { name: 'Source: ASPCA' });
    await fireEvent.press(link);
    expect(onSourcePress).toHaveBeenCalledWith(expect.stringContaining('easter-lily'));
  });

  it('no known toxicity links the name core already put in the line, and adds nothing', async () => {
    const onSourcePress = jest.fn();
    const bran: Pet = { id: 'p2', animal: 'dog', name: 'Bran' };
    await wrap(
      <PetCheckCard
        pets={[bran]}
        toxicity={easter}
        matchProbability={null}
        speciesName="Easter lily"
        onPetAte={() => {}}
        onSourcePress={onSourcePress}
      />,
    );
    expect(
      screen.getByText(
        'No known toxicity to dogs (ASPCA). Eating any plant can still cause vomiting or an upset stomach.',
      ),
    ).toBeTruthy();
    // The name appears once in the row, and that one is the link.
    expect(screen.queryByText(/ASPCA[\s\S]*ASPCA/)).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'ASPCA' }));
    expect(onSourcePress).toHaveBeenCalledWith(expect.stringContaining('easter-lily'));
  });

  it('without a handler the source is plain text, not a link', async () => {
    await wrap(
      <PetCheckCard
        pets={[miso]}
        toxicity={aoife.speciesToxicity['peace-lily']!}
        matchProbability={null}
        speciesName="Peace lily"
        onPetAte={() => {}}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Source: ASPCA\.$/)).toBeTruthy();
  });

  it('an unreviewed row cites no source even when the entry names one', async () => {
    const unreviewed: ToxicityEntry[] = [
      {
        animal: 'cat',
        severity: 'unknown',
        summary: null,
        symptoms: null,
        sourceName: 'ASPCA',
        sourceUrl: 'https://example.org/x',
      },
    ];
    await wrap(
      <PetCheckCard
        pets={[miso]}
        toxicity={unreviewed}
        matchProbability={null}
        speciesName="Bluebell"
        onPetAte={() => {}}
        onSourcePress={() => {}}
      />,
    );
    expect(
      screen.getByText('Not reviewed yet. Keep it away from Miso until we know more.'),
    ).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/ASPCA/)).toBeNull();
  });

  it('other pets read as unknown, and a pet without a name is "your" pet', async () => {
    const pets: Pet[] = [{ id: 'p9', animal: 'other', name: null }];
    const toxicity: ToxicityEntry[] = easter;
    await wrap(
      <PetCheckCard
        pets={pets}
        toxicity={toxicity}
        matchProbability={null}
        speciesName="Easter lily"
        onPetAte={() => {}}
      />,
    );
    expect(screen.getByText('Other pets: Unknown')).toBeTruthy();
    expect(screen.getByText('Your pet')).toBeTruthy();
    expect(
      screen.getByText('Not reviewed yet. Keep it away from your pet until we know more.'),
    ).toBeTruthy();
  });
});

describe('badges and labels', () => {
  it('ConfidenceLabel draws not sure as an outline and compact drops the icon', async () => {
    await wrap(<ConfidenceLabel probability={0.41} />);
    const pill = screen.getByLabelText('Not sure, 41 percent');
    expect(flat(pill)).toMatchObject({ backgroundColor: 'transparent', borderColor: '#7F8983' });
    await wrap(<ConfidenceLabel probability={0.72} compact />);
    expect(flat(screen.getByLabelText('Likely, 72 percent'))).toMatchObject({
      backgroundColor: '#E6F0EA',
      paddingLeft: 8.5,
    });
  });

  it.each([
    ['common', 'Common'],
    ['uncommon', 'Uncommon'],
    ['legendary', 'Legendary'],
  ] as const)('RarityBadge words the %s tier', async (tier, word) => {
    await wrap(<RarityBadge tier={tier} />);
    expect(screen.getByLabelText(`Rarity: ${word}`)).toBeTruthy();
  });
});

describe('quota and streaks', () => {
  it('the camera pill reveals the reset date too, and a used-up meter says so', async () => {
    const usedUp = { ...aoife.today.identifications, used: 10 };
    await wrap(<QuotaMeter quota={usedUp} variant="pill" />);
    expect(screen.getByText('0 of 10 left this month')).toBeTruthy();
    expect(screen.queryByText('Resets 1 November')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '0 of 10 left this month' }));
    expect(screen.getByText('Resets 1 November')).toBeTruthy();
    // A second press hides it again.
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.queryByText('Resets 1 November')).toBeNull();
  });

  it('the card tile reads its heading and count for a screen reader', async () => {
    await wrap(<QuotaMeter quota={aoife.today.identifications} variant="card" />);
    expect(screen.getByRole('button', { name: 'Identifications, 7 of 10 left' })).toBeTruthy();
  });

  it('a streak counter keeps the streak colour; last day and freeze are not announced twice', async () => {
    await wrap(<StreakCounter days={12} label="day care streak" state="last_day" size="tile" />);
    expect(flat(screen.getByText('12'))).toMatchObject({ color: '#A36100' });
    // The screen draws the "needs one check-in today" line, so the counter doesn't repeat it.
    expect(screen.getByLabelText('12 day care streak')).toBeTruthy();
  });

  it('winter mode is spoken, since nothing on screen says it', async () => {
    await wrap(<StreakCounter days={3} label="week discovery streak" state="winter" />);
    expect(screen.getByLabelText('3 week discovery streak. Winter mode is on.')).toBeTruthy();
  });

  it('StreakCalendar copes with a last row shorter than seven days', async () => {
    await wrap(
      <StreakCalendar
        marks={[
          'checked',
          'checked',
          'checked',
          'checked',
          'checked',
          'checked',
          'checked',
          'freeze',
        ]}
      />,
    );
    expect(screen.getAllByLabelText('Checked in')).toHaveLength(7);
    expect(screen.getAllByLabelText('Freeze used')).toHaveLength(1);
  });
});

describe('PermissionPrimer and Button', () => {
  it('has copy for every permission and Continue goes on', async () => {
    const onContinue = jest.fn();
    await wrap(<PermissionPrimer kind="camera" onContinue={onContinue} onNotNow={() => {}} />);
    expect(screen.getByText('Use the camera')).toBeTruthy();
    expect(
      screen.getByText('To photograph plants. Photos stay private unless you share one.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
    await wrap(<PermissionPrimer kind="notifications" onContinue={() => {}} onNotNow={() => {}} />);
    expect(screen.getByText('Care reminders')).toBeTruthy();
    expect(
      screen.getByText('So we can tell you when to check the soil. We never send marketing.'),
    ).toBeTruthy();
  });

  it('a compact Button is 48 pt tall', async () => {
    await wrap(<Button label="Check in" compact onPress={() => {}} />);
    expect(flat(screen.getByRole('button', { name: 'Check in' }))).toMatchObject({
      minHeight: 48,
    });
  });
});
