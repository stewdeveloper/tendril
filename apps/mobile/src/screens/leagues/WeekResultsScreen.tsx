import { leaguesCopy, rankOfLine, type WeekResult } from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, RowsCard, type Row } from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface WeekResultsScreenProps {
  /** Null while it loads, or when it could not. */
  result: WeekResult | null;
  /** The result could not be loaded: a calm line stands in for it. */
  failed?: boolean;
  onContinue: () => void;
}

const word = (tier: string) => tier.charAt(0).toUpperCase() + tier.slice(1);

/**
 * The week's result (4aw, 4ax): where you finished and what earned it, or a quiet week with no
 * blame. If the result can't load, the screen still says so and lets you carry on.
 */
export function WeekResultsScreen({ result, failed = false, onContinue }: WeekResultsScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const quiet = result != null && (result.rank == null || result.of == null || result.points === 0);
  const rows: Row[] =
    result && !quiet
      ? [
          { key: 'points', title: leaguesCopy.points, right: String(result.points) },
          ...(result.bestFind
            ? [
                {
                  key: 'best',
                  title: leaguesCopy.bestFind,
                  subtitle: result.bestFind.name,
                  right: word(result.bestFind.rarity),
                },
              ]
            : []),
        ]
      : [];
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.spacer} />
        <AppText variant="sub" color="textSecondary">
          {leaguesCopy.weekResults}
        </AppText>
        {result && !quiet ? (
          <AppText variant="moment" accessibilityRole="header" style={styles.title}>
            {rankOfLine(result.rank!, result.of!)}
          </AppText>
        ) : null}
        {quiet ? (
          <>
            <AppText variant="moment" accessibilityRole="header" style={styles.title}>
              {leaguesCopy.quietWeek}
            </AppText>
            <AppText variant="body" lines="body-24">
              {leaguesCopy.quietWeekLine}
            </AppText>
          </>
        ) : null}
        {failed && !result ? (
          <AppText variant="body" lines="body-24">
            {leaguesCopy.resultsFailed}
          </AppText>
        ) : null}
        {rows.length > 0 ? <RowsCard rows={rows} /> : null}
        <View style={styles.spacer} />
        <View style={styles.pulled}>
          <Button label={leaguesCopy.continue} onPress={onContinue} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  title: { marginBottom: -10 },
  spacer: { flex: 1 },
  // The frame pulls the button 8 pt closer to what is above it than the page's rhythm.
  pulled: { marginTop: -8 },
});
