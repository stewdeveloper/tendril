import { leaguesCopy, normaliseHandle, plantdexSpecies } from '@tendril/core';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BackBar, Button, Note, RowsCard, Snackbar, TextField } from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface AddFriendsScreenProps {
  /** The text the field starts with. */
  query: string;
  /** The one person an exact handle found, `'not_found'`, or null before any search. */
  result: { handle: string; plantdexCount: number } | null | 'not_found';
  /** The signed-in person's own handle, so searching for yourself is answered kindly. */
  ownHandle: string;
  /** A request to `result` has been sent. */
  requested: boolean;
  /** A transient line (a request that failed). */
  notice?: string | null;
  /** Forces the focused ring (the catalog frames show it without a real focus). */
  focused?: boolean;
  /** The text changed: the parent drops a result that no longer matches the field. */
  onEdit?: () => void;
  /** Called on submit only, never per keystroke, with the text as typed. */
  onQuery: (query: string) => void;
  onAdd: (handle: string) => void;
  onInvite: () => void;
  onBack: () => void;
}

/**
 * Add friends (4au, 4av): find one person by their exact handle. The search runs when the person
 * submits, never as they type, and only ever shows the one match, so handles can't be enumerated.
 */
export function AddFriendsScreen(props: AddFriendsScreenProps) {
  const { result, ownHandle, requested } = props;
  const { c } = useTheme();
  const insets = useInsets();
  const [text, setText] = useState(props.query);
  const submit = () => {
    if (normaliseHandle(text) === '') return;
    props.onQuery(text);
  };
  const notFound = result === 'not_found';
  const found = result && result !== 'not_found' ? result : null;
  const isYou = found != null && found.handle.toLowerCase() === ownHandle.toLowerCase();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label={leaguesCopy.segmentFriends} onPress={props.onBack} />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {leaguesCopy.addFriends}
        </AppText>
        <TextField
          label={leaguesCopy.handleLabel}
          value={text}
          onChangeText={(t) => {
            setText(t);
            props.onEdit?.();
          }}
          focused={props.focused}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={submit}
        />
        {found ? (
          <RowsCard>
            <View style={[styles.row, { borderBottomColor: c.divider }]}>
              <View style={styles.text}>
                <AppText variant="body">{`@${found.handle}`}</AppText>
                <AppText variant="sub" color="textSecondary" style={styles.subtitle}>
                  {isYou ? leaguesCopy.thatsYou : plantdexSpecies(found.plantdexCount)}
                </AppText>
              </View>
              {isYou ? null : requested ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={leaguesCopy.requested}
                  accessibilityState={{ disabled: true }}
                  disabled
                  style={styles.action}
                >
                  <AppText variant="caption" color="textSecondary">
                    {leaguesCopy.requested}
                  </AppText>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${leaguesCopy.add} @${found.handle}`}
                  onPress={() => props.onAdd(found.handle)}
                  style={styles.action}
                >
                  <AppText variant="caption" color="primary">
                    {leaguesCopy.add}
                  </AppText>
                </Pressable>
              )}
            </View>
          </RowsCard>
        ) : null}
        {notFound ? <Note text={leaguesCopy.handleNotFound} /> : null}
        <View style={styles.spacer} />
        <View style={styles.pulled}>
          <Button
            label={leaguesCopy.sendInvite}
            variant={notFound ? 'primary' : 'secondary'}
            onPress={props.onInvite}
          />
        </View>
      </ScrollView>
      {props.notice ? <Snackbar text={props.notice} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  // The frame tucks the back row and the title closer to what follows than the page rhythm.
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  spacer: { flex: 1 },
  pulled: { marginTop: -8 },
  // The same row as RowsCard's: 12/16 padding, 12 pt between, the hairline under it.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  text: { flex: 1, minWidth: 0 },
  subtitle: { lineHeight: 20 },
  // 44 pt to touch; the negative margin keeps the row at its drawn height.
  action: {
    minHeight: 44,
    minWidth: 44,
    marginVertical: -4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
