import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useFriends, useLeague, useProfile } from '../../../api/hooks';
import { useStartScan } from '../../../components';
import { LeaguesScreen, type LeaguesSegment } from '../../../screens/leagues/LeaguesScreen';

/** The Leagues tab: this week's board and the friends board. */
export default function LeaguesRoute() {
  const router = useRouter();
  const [segment, setSegment] = useState<LeaguesSegment>('league');
  const league = useLeague();
  const friends = useFriends();
  const profile = useProfile();
  const startScan = useStartScan();
  if (!league.data || !friends.data) return null;
  return (
    <LeaguesScreen
      segment={segment}
      league={league.data}
      friends={friends.data}
      avatarLetter={profile.data?.displayName.charAt(0).toUpperCase() ?? ''}
      onSegment={setSegment}
      onAddFriends={() => router.push('/leagues/add-friends')}
      onScan={startScan}
      onAvatar={() => router.push('/profile')}
    />
  );
}
