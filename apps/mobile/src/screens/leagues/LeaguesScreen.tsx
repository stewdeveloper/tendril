import { leagueDaysLine, leagueEmptyLine, leaguesCopy, type LeagueBoard } from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  LeagueRow,
  RowsCard,
  ScreenHeader,
  SegmentedControl,
} from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export type LeaguesSegment = 'league' | 'friends';

export interface LeaguesScreenProps {
  segment: LeaguesSegment;
  league: LeagueBoard;
  friends: LeagueBoard;
  avatarLetter: string;
  onSegment: (segment: LeaguesSegment) => void;
  onAddFriends: () => void;
  onScan: () => void;
  onAvatar: () => void;
}

const SEGMENTS = [
  { value: 'league', label: leaguesCopy.segmentLeague },
  { value: 'friends', label: leaguesCopy.segmentFriends },
];

/**
 * The Leagues tab (4aq to 4at): this week's board near you, and the board of your friends. Rows are
 * plain in v1 (no profiles to open yet). Before any points, and with no friends, a calm line says
 * how to start. Props only: the route wires the data and the navigation.
 */
export function LeaguesScreen(props: LeaguesScreenProps) {
  const { segment, league, friends } = props;
  const { c } = useTheme();
  const insets = useInsets();
  const friendRows = friends.rows.filter((r) => !r.isYou);
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <ScreenHeader
          title={leaguesCopy.title}
          avatarLetter={props.avatarLetter}
          onAvatarPress={props.onAvatar}
        />
        <SegmentedControl
          options={SEGMENTS}
          value={segment}
          onChange={(v) => props.onSegment(v as LeaguesSegment)}
        />
        {segment === 'league' ? (
          league.joined && league.rows.length > 0 ? (
            <>
              <AppText variant="sub" color="textSecondary">
                {leagueDaysLine(league.daysLeft, league.resetsOn)}
              </AppText>
              <RowsCard>
                {league.rows.map((row) => (
                  <LeagueRow key={row.handle} row={row} />
                ))}
              </RowsCard>
            </>
          ) : (
            <>
              <EmptyState text={leagueEmptyLine(league.size)} />
              <View style={styles.pulled}>
                <Button label={leaguesCopy.scanPlant} onPress={props.onScan} />
              </View>
            </>
          )
        ) : friendRows.length > 0 ? (
          <>
            <RowsCard>
              {friends.rows.map((row) => (
                <LeagueRow key={row.handle} row={row} />
              ))}
            </RowsCard>
            <View style={styles.pulled}>
              <Button
                label={leaguesCopy.addFriends}
                variant="secondary"
                onPress={props.onAddFriends}
              />
            </View>
          </>
        ) : (
          <>
            <EmptyState text={leaguesCopy.emptyFriends} />
            <View style={styles.pulled}>
              <Button label={leaguesCopy.addFriends} onPress={props.onAddFriends} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  // The frame pulls a button 8 pt closer to what is above it than the page's rhythm.
  pulled: { marginTop: -8 },
});
