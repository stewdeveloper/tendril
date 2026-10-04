import { aoife, type LeagueBoard } from '@tendril/core';
import { AddFriendsScreen } from '../../screens/leagues/AddFriendsScreen';
import { LeaguesScreen, type LeaguesScreenProps } from '../../screens/leagues/LeaguesScreen';
import { WeekResultsScreen } from '../../screens/leagues/WeekResultsScreen';
import { registerFrame } from '../registry';
import { TabScreenFrame } from '../TabScreenFrame';

/** Frames 4aq to 4ax: the Leagues tab, Add friends and the week's results. */

const noop = () => {};
const handlers = {
  avatarLetter: 'A',
  onSegment: noop,
  onAddFriends: noop,
  onScan: noop,
  onAvatar: noop,
} as const;

const noBoard = (board: LeagueBoard): LeagueBoard => ({ ...board, joined: false, rows: [] });
const noFriends: LeagueBoard = {
  ...aoife.friends,
  size: 1,
  rows: aoife.friends.rows.filter((r) => r.isYou).map((r) => ({ ...r, rank: 1 })),
};

const leagues = (props: Pick<LeaguesScreenProps, 'segment'> & Partial<LeaguesScreenProps>) => (
  <TabScreenFrame active="leagues">
    <LeaguesScreen {...handlers} league={aoife.league} friends={aoife.friends} {...props} />
  </TabScreenFrame>
);

registerFrame({
  id: '4aq',
  title: 'League · this week',
  render: () => leagues({ segment: 'league' }),
});
registerFrame({
  id: '4ar',
  title: 'League · before any points',
  render: () => leagues({ segment: 'league', league: noBoard(aoife.league) }),
});
registerFrame({
  id: '4as',
  title: 'Friends',
  render: () => leagues({ segment: 'friends' }),
});
registerFrame({
  id: '4at',
  title: 'Friends · none yet',
  render: () => leagues({ segment: 'friends', friends: noFriends }),
});

const addFriends = {
  ownHandle: 'aoifegrows',
  requested: false,
  focused: true,
  onQuery: noop,
  onAdd: noop,
  onInvite: noop,
  onBack: noop,
} as const;

registerFrame({
  id: '4au',
  title: 'Add friends · handle found',
  // The design's friend has 37 species; the fixture's handle directory has its own count.
  render: () => (
    <AddFriendsScreen
      {...addFriends}
      query="@siobhanplants"
      result={{ handle: 'siobhanplants', plantdexCount: 37 }}
    />
  ),
});
registerFrame({
  id: '4av',
  title: 'Add friends · no one has that handle',
  render: () => <AddFriendsScreen {...addFriends} query="@aoifegrow" result="not_found" />,
});
registerFrame({
  id: '4aw',
  title: 'Week results · 4th of 20',
  render: () => <WeekResultsScreen result={aoife.weekResult} onContinue={noop} />,
});
registerFrame({
  id: '4ax',
  title: 'Week results · a quiet week',
  render: () => (
    <WeekResultsScreen
      result={{ rank: null, of: null, points: 0, bestFind: null }}
      onContinue={noop}
    />
  ),
});
