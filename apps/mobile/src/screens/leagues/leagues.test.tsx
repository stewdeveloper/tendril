import { aoife, type LeagueBoard } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { AddFriendsScreen, type AddFriendsScreenProps } from './AddFriendsScreen';
import { LeaguesScreen, type LeaguesScreenProps } from './LeaguesScreen';
import { WeekResultsScreen } from './WeekResultsScreen';

const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

const leaguesBase: LeaguesScreenProps = {
  segment: 'league',
  league: aoife.league,
  friends: aoife.friends,
  avatarLetter: 'A',
  onSegment: noop,
  onAddFriends: noop,
  onScan: noop,
  onAvatar: noop,
};
const board = (over: Partial<LeagueBoard>): LeagueBoard => ({ ...aoife.league, ...over });

const addBase: AddFriendsScreenProps = {
  query: '',
  result: null,
  ownHandle: 'aoifegrows',
  requested: false,
  onQuery: noop,
  onAdd: noop,
  onInvite: noop,
  onBack: noop,
};

describe('LeaguesScreen', () => {
  it('this week: days left and your highlighted row', async () => {
    await wrap(<LeaguesScreen {...leaguesBase} />);
    expect(screen.getByText('3 days left · resets Monday')).toBeTruthy();
    expect(screen.getByText('You · @aoifegrows')).toBeTruthy();
    expect(screen.getByText('@hedgehopper')).toBeTruthy();
  });

  it('rows are not pressable in v1', async () => {
    await wrap(<LeaguesScreen {...leaguesBase} />);
    await fireEvent.press(screen.getByText('@hedgehopper'));
    expect(screen.queryAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Profile',
    ]);
  });

  it('before any points: the empty line names the board size, and Scan a plant scans', async () => {
    const onScan = jest.fn();
    await wrap(
      <LeaguesScreen
        {...leaguesBase}
        league={board({ joined: false, rows: [], size: 20 })}
        onScan={onScan}
      />,
    );
    expect(
      screen.getByText('Log a find to join this week’s board with 20 people near you.'),
    ).toBeTruthy();
    expect(screen.queryByText('3 days left · resets Monday')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('friends: rows and a secondary Add friends', async () => {
    const onAddFriends = jest.fn();
    await wrap(<LeaguesScreen {...leaguesBase} segment="friends" onAddFriends={onAddFriends} />);
    expect(screen.getByText('@siobhanplants')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add friends' }));
    expect(onAddFriends).toHaveBeenCalledTimes(1);
  });

  it('no friends: the empty line and Add friends', async () => {
    const onAddFriends = jest.fn();
    const alone = board({ rows: [{ ...aoife.friends.rows[1]!, rank: 1 }], size: 1 });
    await wrap(
      <LeaguesScreen
        {...leaguesBase}
        segment="friends"
        friends={alone}
        onAddFriends={onAddFriends}
      />,
    );
    expect(
      screen.getByText('No friends here yet. Invite someone to compare finds each week.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add friends' }));
    expect(onAddFriends).toHaveBeenCalledTimes(1);
  });

  it('switches segment and opens the profile from the avatar', async () => {
    const onSegment = jest.fn();
    const onAvatar = jest.fn();
    await wrap(<LeaguesScreen {...leaguesBase} onSegment={onSegment} onAvatar={onAvatar} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Friends' }));
    expect(onSegment).toHaveBeenCalledWith('friends');
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(onAvatar).toHaveBeenCalledTimes(1);
  });
});

describe('AddFriendsScreen', () => {
  it('searches only on submit, exact handle', async () => {
    const onQuery = jest.fn();
    await wrap(<AddFriendsScreen {...addBase} onQuery={onQuery} />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), '@siobhanplant');
    expect(onQuery).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Handle'), 'submitEditing');
    expect(onQuery).toHaveBeenCalledWith('@siobhanplant');
  });

  it('typing tells the parent so a stale result can go', async () => {
    const onEdit = jest.fn();
    await wrap(<AddFriendsScreen {...addBase} onEdit={onEdit} />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), '@s');
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('a blank handle does not search', async () => {
    const onQuery = jest.fn();
    await wrap(<AddFriendsScreen {...addBase} onQuery={onQuery} />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), '   ');
    await fireEvent(screen.getByLabelText('Handle'), 'submitEditing');
    expect(onQuery).not.toHaveBeenCalled();
  });

  it('found: one row with the species count and Add', async () => {
    const onAdd = jest.fn();
    await wrap(
      <AddFriendsScreen
        {...addBase}
        query="@siobhanplants"
        result={{ handle: 'siobhanplants', plantdexCount: 37 }}
        onAdd={onAdd}
      />,
    );
    expect(screen.getByText('@siobhanplants', { exact: true })).toBeTruthy();
    expect(screen.getByText('37 species')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add @siobhanplants' }));
    expect(onAdd).toHaveBeenCalledWith('siobhanplants');
  });

  it('after a request the action reads Requested and is disabled', async () => {
    const onAdd = jest.fn();
    await wrap(
      <AddFriendsScreen
        {...addBase}
        result={{ handle: 'siobhanplants', plantdexCount: 37 }}
        requested
        onAdd={onAdd}
      />,
    );
    const requested = screen.getByRole('button', { name: 'Requested' });
    expect(requested.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(requested);
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByText('Add')).toBeNull();
  });

  it('your own handle says "That\'s you." and offers no Add', async () => {
    await wrap(
      <AddFriendsScreen
        {...addBase}
        query="@AoifeGrows"
        result={{ handle: 'aoifegrows', plantdexCount: 37 }}
      />,
    );
    expect(screen.getByText("That's you.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add @/ })).toBeNull();
    expect(screen.queryByText('37 species')).toBeNull();
  });

  it('handle not found suggests an invite', async () => {
    const onInvite = jest.fn();
    await wrap(
      <AddFriendsScreen {...addBase} query="@aoifegrow" result="not_found" onInvite={onInvite} />,
    );
    expect(
      screen.getByText('No one has that handle. Check the spelling, or send an invite link.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send invite link' }));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('shows a failure notice and goes back', async () => {
    const onBack = jest.fn();
    await wrap(
      <AddFriendsScreen
        {...addBase}
        notice="Couldn't send that request. Try again."
        onBack={onBack}
      />,
    );
    expect(screen.getByText("Couldn't send that request. Try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Friends' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('WeekResultsScreen', () => {
  it('a week with points: rank, points and best find', async () => {
    const onContinue = jest.fn();
    await wrap(<WeekResultsScreen result={aoife.weekResult} onContinue={onContinue} />);
    expect(screen.getByText('Week results')).toBeTruthy();
    expect(screen.getByText('4th of 20')).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(screen.getByText('Foxglove')).toBeTruthy();
    expect(screen.getByText('Uncommon')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('a quiet week is calm', async () => {
    await wrap(
      <WeekResultsScreen
        result={{ rank: null, of: null, points: 0, bestFind: null }}
        onContinue={noop}
      />,
    );
    expect(screen.getByText('A quiet week')).toBeTruthy();
    expect(screen.getByText('No points this week. A new board starts Monday.')).toBeTruthy();
  });

  it('a result that could not load says so calmly and still continues', async () => {
    const onContinue = jest.fn();
    await wrap(<WeekResultsScreen result={null} failed onContinue={onContinue} />);
    expect(screen.getByText(/We couldn't load your week's results/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
